# Revisão geral — segurança, viabilidade e UI/UX — 09/11/2026

Briefing para correção. Cada item é independente e traz: onde está, evidência, correção sugerida e
como saber que ficou pronto.

## Contexto

- **Site:** este repositório (`story-magic`, React + Vite, PWA). Produção publica a `main`.
- **API:** `C:\Users\werne\WebstormProjects\story-verse-api` (Spring Boot, Java 25, Postgres com RLS).
  Na data da revisão, `main` e `develop` da API estavam iguais.
- **Produção:** VPS única, Caddy na frente. Site em `storyverse.2.29.42.104.sslip.io`, API em
  `api.storyverse.2.29.42.104.sslip.io`. QA em `qa.storyverse…` e `api.qa.storyverse…`.
- **Cobrança ligada** em produção (Stripe, R$ 9,90/mês, 7 dias de teste, Pix avulso).
- **Como foi verificado:** leitura de código dos dois repositórios, chamadas `GET` sem login no QA e
  na produção, navegação deslogada no site de produção. **Não** houve login em conta, acesso à VPS
  nem leitura do banco.
- **Regras do projeto:** correções vão para a `develop` por PR; produção só pela `main`. Mudanças no
  `deploy/edge/Caddyfile` precisam ser aplicadas na VPS à mão (o arquivo do repositório é a fonte,
  mas o deploy do site não o copia).

## Ordem sugerida

1. S1 (bypass dos filtros) — API, pequeno, urgente.
2. V1 (acervo) — decisão do dono do produto antes de qualquer código.
3. S3 (microfone) e S4 (audiolivro aberto) — pequenos.
4. S5 (excluir conta × assinatura), S6 (CPF), S2/V2 (domínio próprio).
5. Resto.

---

## Segurança

### S1 · Alto · Bypass do paywall e do rate limit por URL codificada (API)

**Onde**
- `story-verse-api/src/main/java/com/storyverse/api/config/RequestSecurityFilter.java:25-33`
- `story-verse-api/src/main/java/com/storyverse/api/billing/BillingAccessFilter.java:47-48` e `exempt()` em `:88-105`
- `story-verse-api/src/main/java/com/storyverse/api/catalog/CatalogService.java:65-66` (`text()` só autentica)

**Problema.** Os dois filtros decidem com `request.getRequestURI()`, que é a URL crua, sem
decodificar. O Spring MVC decodifica antes de casar a rota. Então:

- `/%61pi/v1/...` não começa com `/api/` para os filtros, mas o MVC atende como `/api/v1/...`.
  Resultado: nenhuma checagem de assinatura e nenhum limite por IP (300/min geral, 30/min em
  `/auth/*`, 5/h em `/auth/signup`).
- `exempt()` libera `GET /api/v1/catalog/**` exceto o que termina em `/text`. `/text;x=1` (parâmetro
  de matriz) e `/tex%74` não terminam em `/text` para o filtro, mas casam a rota do texto. E
  `CatalogService.text()` não confere assinatura por conta própria.

**Evidência (QA, sem login, 09/11).** O filtro responde `{"error":"Não autenticado."}`; o MVC
responde `{"error":"Não autenticado.","code":null}`. A presença de `"code"` mostra quem respondeu.

```
GET /api/v1/groups                     -> {"error":"Não autenticado."}              (filtro)
GET /%61pi/v1/groups                   -> {"error":"Não autenticado.","code":null}  (MVC: filtro pulado)
GET /api/v1/catalog/books/x/text       -> {"error":"Não autenticado."}              (filtro)
GET /api/v1/catalog/books/x/text;x=1   -> {"error":"Não autenticado.","code":null}  (MVC: tratado como isento)
GET /api/v1/catalog/books/x/tex%74     -> {"error":"Não autenticado.","code":null}  (MVC: tratado como isento)
```

Não foi testado com uma conta logada sem assinatura; a conclusão de que o conteúdo é entregue vem
da leitura do código (os controladores só chamam `auth.authenticate`).

**Correção sugerida**
1. Nos dois filtros, decidir sobre o caminho **decodificado e normalizado**, o mesmo que o MVC usa
   (por exemplo `UrlPathHelper.getPathWithinApplication` com remoção do conteúdo após `;`, ou
   `ServletRequestPathUtils`). Alternativa mais simples e segura: responder 400 a qualquer requisição
   cujo caminho cru contenha `%`, `;`, `//` ou `\` — o site não usa nenhum desses em caminhos (conferir
   antes: os parâmetros vão na query string, que não entra nessa regra).
2. Defesa em profundidade: `CatalogService.text()` deve chamar `billing.requireAccess(user)`, como
   `CatalogAudioService.publicStream()` já faz. A regra de assinatura não deve depender só do filtro.
3. Considerar inverter a lógica do `BillingAccessFilter`: em vez de `!path.startsWith("/api/")` deixar
   passar, tratar todo caminho como protegido, exceto a lista isenta.

**Pronto quando**
- Testes de integração novos: conta sem assinatura recebe 402 em `/%61pi/v1/groups`,
  `/api/v1/catalog/books/{key}/text;x`, `/api/v1/catalog/books/{key}/tex%74` (ou 400, se a opção for
  rejeitar). Teste unitário de `exempt()` cobrindo as mesmas variações.
- O limite de cadastro por IP dispara também por `/%61pi/v1/auth/signup`.
- As cinco chamadas acima, repetidas no QA, respondem todas no formato do filtro (ou 400).

---

### S2 · Alto · Domínio sslip.io: cookies e sessão compartilham "site" com terceiros

**Onde:** infraestrutura (domínio), `AuthCookieService.java` (cookie `storyverse_refresh`, `SameSite=Lax`,
`Path=/api/v1/auth`, sem `Domain`).

**Problema.** `sslip.io` não consta na Public Suffix List (conferido em 09/11 no arquivo oficial).
Para o navegador, o domínio registrável é `sslip.io`, então **qualquer** host `*.sslip.io`, de qualquer
pessoa, é same-site com o Storyverse:

- `SameSite=Lax` não barra requisições vindas de outro host sslip.io (logout forçado, rotação do
  refresh).
- Outro host pode gravar um cookie `storyverse_refresh` com `Domain=sslip.io; Path=/api/v1/auth`. Se a
  vítima não tiver sessão, o app chama `/auth/refresh`, recebe a sessão do atacante e a pessoa passa a
  usar (importar livros, pagar) a conta dele.
- Além disso: o serviço de DNS é de terceiros e os certificados dividem o limite da Let's Encrypt com
  todos os usuários do sslip.io.

**Correção sugerida.** Registrar um domínio próprio e migrar site e API (ver V2). Enquanto isso não
acontece, mitigação barata na API: prefixar o cookie com `__Host-` (exige `Secure`, `Path=/` e sem
`Domain`; um cookie plantado por outro host com `Domain=` não pode usar esse nome) e, em
`/auth/refresh` e `/auth/logout`, recusar requisições cujo cabeçalho `Origin` exista e não esteja em
`APP_CORS_ALLOWED_ORIGINS`. Atenção: `__Host-` obriga `Path=/`, então o cookie passa a ir em toda
chamada à API; aceitar o cookie antigo por um período de transição.

**Pronto quando:** site e API respondem em domínio próprio com redirecionamento do endereço antigo;
ou, na mitigação, testes cobrindo o novo nome do cookie e a recusa por `Origin`.

---

### S3 · Médio · Microfone bloqueado em produção (áudio nos grupos)

**Onde:** `deploy/edge/Caddyfile:40` (produção) e `:123` (QA):
`Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"`.
O gravador está em `src/features/groups/AudioRecorder.tsx:51-60` (`getUserMedia({ audio })`).

**Problema.** `microphone=()` proíbe o microfone para a própria página. O navegador nega o
`getUserMedia` sem nem mostrar o pedido de permissão, e a ajuda de `src/lib/micPermission.ts` manda
a pessoa mexer nas configurações do navegador, o que não resolve.

**Evidência.** Em produção, `document.featurePolicy.allowsFeature('microphone')` devolve `false`. Não
tentei gravar um áudio (exigiria login).

**Correção.** Trocar para `microphone=(self)` nos dois blocos, aplicar na VPS e recarregar o Caddy.
Rodar `deploy/edge/check-caddyfile.sh` se ele validar esse cabeçalho. Opcional: em `micPermission.ts`,
detectar bloqueio por política e mostrar outra mensagem.

**Pronto quando:** em produção e no QA `allowsFeature('microphone')` é `true` e um áudio é gravado e
enviado num grupo.

---

### S4 · Médio · Audiolivro inteiro aberto sem login

**Onde:** `story-verse-api/src/main/java/com/storyverse/api/audio/CatalogAudioService.java`, método
`publicStream` (linhas ~111-135): só exige sessão e assinatura quando `chapterIndex > 1`.

**Problema.** O capítulo 1 é a amostra pública. Quando o audiolivro tem um capítulo só, ele inteiro é
a amostra. Em produção, "A Culpa É Das Estrelas" tem `chapterCount: 1` e 25.916 s (7 h 12 min):
qualquer visitante recebe a URL assinada do R2 para o arquivo completo.

**Correção sugerida.** Uma destas:
- amostra limitada por tempo (ex.: só libera o capítulo 1 sem login se `duration_seconds` ≤ 15 min ou
  se a edição tiver mais de um capítulo); ou
- campo explícito de "amostra pública" por edição, desligado por padrão.

Ajustar o texto de `/ouvir` ("O primeiro capítulo é aberto") conforme a regra escolhida.

**Pronto quando:** teste cobre edição de capítulo único respondendo 401 sem sessão; a tela mostra o
convite para entrar em vez de erro.

---

### S5 · Médio · Excluir a conta não cancela a assinatura no Stripe

**Onde:** `story-verse-api/src/main/java/com/storyverse/api/account/AccountService.java:101-113`
(apaga arquivos e chama `delete_my_account()`, sem tocar no Stripe).
`StripeGateway.java` não tem método de cancelamento. Os Termos (`src/features/legal/LegalPage.tsx`,
seção 7) avisam: "Excluir a conta não cancela sozinho uma assinatura no cartão".

**Problema.** Depois de excluir, a pessoa continua sendo cobrada e não tem mais como entrar para abrir
o portal do Stripe. O webhook seguinte ainda falha com "Cliente do Stripe sem conta vinculada" (500), e
o Stripe fica reenviando.

**Correção sugerida.** Em `AccountService.delete`, antes de apagar: se houver assinatura `active`,
`trialing` ou `past_due`, cancelar no Stripe (novo `StripeGateway.cancelSubscription`, imediato). Se o
Stripe falhar, abortar a exclusão com mensagem clara, para não deixar cobrança órfã. No site, avisar
no diálogo de exclusão que a assinatura será cancelada. Atualizar a seção 7 dos Termos. No
`BillingWebhookService.sync`, tratar cliente sem conta como evento ignorado (200), não erro.

**Pronto quando:** teste de integração com gateway falso confirma o cancelamento na exclusão e o
aborto em falha; Termos e diálogo atualizados.

---

### S6 · Médio · CPF completo do titular em todas as páginas

**Onde:** `src/features/legal/holder.ts:2` (`LEGAL_HOLDER`), usado no rodapé da home
(`src/App.tsx:8575`) e em `src/features/legal/LegalPage.tsx:26` e `:128`.

**Problema.** Nome completo e CPF sem máscara ficam visíveis a qualquer visitante e a robôs, o que
facilita fraude de identidade. A identificação do fornecedor é exigência legal para venda online,
então a saída não é simplesmente apagar.

**Correção sugerida (decisão do dono).** Abrir CNPJ (MEI) e publicar o CNPJ no lugar. Enquanto isso,
tirar o CPF do rodapé da home e manter só nas páginas legais. Confirmar com um contador/advogado o
que é obrigatório exibir; isto não é parecer jurídico.

**Pronto quando:** `holder.ts` atualizado e os testes de `LegalPage.test.tsx` ajustados.

---

### S7 · Médio · Upload segura lock global e conexão do banco durante o envio

**Onde:** `story-verse-api/src/main/java/com/storyverse/api/storage/StorageService.java:55-104`. O método
é `@Transactional` e pega `access.lock("storage-capacity")` (lock consultivo global, linha 70) antes
de ler o corpo (`copyBounded`, linha 86).

**Problema (leitura de código, não testado).** A transação, a conexão do pool (20 no total) e o lock
global ficam presos enquanto o cliente envia até 50 MB. Um envio lento bloqueia todos os outros
uploads; cerca de vinte envios lentos simultâneos esgotam o pool e param a API inteira.

**Correção sugerida.** Receber o arquivo para o temporário **fora** da transação (validando tamanho e
assinatura), e só então abrir a transação curta que pega os locks, confere a cota com o tamanho real
e faz o `ATOMIC_MOVE`. Limitar uploads simultâneos por conta.

**Pronto quando:** teste mostra que um upload em andamento (stream bloqueado) não impede outro upload
de outra conta; os testes de cota concorrente existentes continuam passando.

---

### S8 · Baixo · Proxy `/gutenberg/*` aberto para qualquer caminho

**Onde:** `deploy/edge/Caddyfile:47-56` (produção) e bloco equivalente do QA; espelho em
`vite.config.ts`.

**Problema.** Qualquer caminho de `www.gutenberg.org` e `aleph.pglaf.org` é servido como se fosse da
origem do Storyverse (entra em `'self'` na CSP) e a VPS vira proxy público, o que pode levar o
Gutenberg a bloquear o IP. O mesmo raciocínio já foi aplicado ao `/openlibrary` em 04/11.

**Correção.** Restringir aos caminhos que o app usa. O service worker indica quais são
(`public/sw.js`): `/gutenberg/cache/epub/<id>/pg<id>.txt`, as capas `.jpg` da mesma pasta e a busca
`/gutenberg-search`. Conferir `src/lib/gutenberg.ts` antes de fechar a lista. Forçar `Content-Type`
de texto/imagem na resposta, como foi feito no `/openlibrary`.

**Pronto quando:** `/gutenberg/ebooks/1` responde 404 e abrir um livro do Gutenberg continua funcionando.

---

### S9 · Baixo · `/community/submissions` expõe dados internos sem login

**Onde:** `story-verse-api/src/main/java/com/storyverse/api/community/CommunityRepository.java:22-32`
(`listApproved`). A rota `GET /api/v1/community/submissions` é pública.

**Problema.** A resposta inclui `user_id`, `submitter_name`, `text_path`, `rights_note` e `status`.
Conferido em produção.

**Correção.** Tirar `user_id` e `text_path` da listagem pública (o texto deve ser pedido por `id`, com
o caminho resolvido no servidor). Antes, conferir em `src/lib/community.ts` quem usa esses campos; o
dono do envio precisa de outro sinal para "é meu" (ex.: booleano `mine` quando há sessão).

**Pronto quando:** a resposta sem login não traz `user_id` nem `text_path` e a estante da comunidade
continua abrindo os livros.

---

### S10 · Baixo · Itens de manutenção

- **Sessões nunca são podadas.** `SessionRepository` só limpa `session_token_history`. A passada de QA de
  07/11 viu 52 sessões ativas numa conta. Criar tarefa agendada que apaga sessões com
  `refresh_expires_at` vencido ou revogadas há mais de N dias.
- **Teto global de IA.** `AI_DAILY_GLOBAL_LIMIT=0` no `deploy/storyverse/.env.example` significa sem
  teto. O valor real da produção não foi visto. Definir um teto compatível com o orçamento.
- **401/402/403 esperados viram erro no Sentry** (pendência já anotada em
  `docs/qa/2026-11-07-passada-geral-ui-ux.md`).
- **Backup.** `deploy/backup.sh` só copia para fora se `STORYVERSE_BACKUP_REMOTE` estiver definido e o
  dump não é criptografado. Não foi verificado na VPS. Confirmar cópia externa e fazer um teste de
  restauração.

---

## Viabilidade

### V1 · Crítico · Acervo de produção com obras protegidas por direito autoral

**Evidência (produção, sem login, 09/11).** `GET /api/v1/catalog/books` devolve 50 títulos, entre eles
Stephen King (*A dança da morte*, *Dança macabra*, *Christine*), Rebecca Yarros (série Empyriano),
Sarah J. Maas, Ali Hazelwood, Lynn Painter, Tolkien (*O Hobbit*), Raphael Montes, Matt Haig, Freida
McFadden. `GET /api/v1/catalog/audio` lista *A Culpa É Das Estrelas* (John Green) com
`rights: free_license` e `licenseNote: "LibriVox · domínio público"`, o que não corresponde à obra.
Envios da comunidade aparecem com `rights: public_domain`.

Ao mesmo tempo, o site afirma domínio público em três lugares: rodapé da home ("Textos em domínio
público do Project Gutenberg"), `/biblioteca` ("Clássicos e obras livres…", "Textos em domínio público
e obras livres") e a seção 4 dos Termos.

**Por que importa.** O serviço cobra assinatura para dar acesso a esses textos. Isso expõe o titular
(pessoa física) a ação de direito autoral, a pedido de retirada junto ao provedor da VPS e ao
encerramento da conta Stripe. Nenhuma correção técnica compensa esse risco. Isto não é parecer
jurídico; vale consultar um advogado.

**Decisão necessária (do dono do produto), antes de qualquer código**
- Retirar do acervo público o que não é domínio público ou licenciado. O modelo defensável é:
  domínio público (Gutenberg, Domínio Público) + arquivo importado pelo próprio leitor, que fica só
  na estante dele.
- Definir o que acontece com envios da comunidade: hoje o campo `rights` é declarado por quem envia
  e a moderação aprovou obras claramente protegidas.

**Trabalho de código decorrente (depois da decisão)**
- Ação em lote no admin para ocultar/arquivar por autor ou por origem.
- Na moderação de envios e no cadastro do acervo: campo obrigatório de justificativa de direitos
  (fonte, ano de morte do autor ou licença) e aviso quando o autor não está numa lista de domínio
  público.
- Canal de denúncia de direito autoral nas páginas legais.

---

### V2 · Alto · Domínio próprio

Além do S2: um endereço com IP não passa confiança para quem vai pagar; o remetente dos e-mails não
pode ter SPF/DKIM num domínio próprio; e os dados do PWA (livros offline no IndexedDB, instalação,
inscrições de push, cookie de sessão) são presos à origem, então cada usuário novo no endereço atual
aumenta o custo da migração.

**Trabalho:** registrar o domínio; novos blocos no Caddyfile; `APP_PUBLIC_URL`, `APP_PUBLIC_API_URL`,
`APP_CORS_ALLOWED_ORIGINS`, `VITE_API_URL` no workflow de deploy; `app.media_origin` no banco; CSP;
webhook e URLs de retorno no Stripe; redirecionamento 301 do endereço antigo; aviso aos usuários de
que precisam entrar e reinstalar o app. Os valores padrão com sslip.io estão espalhados em
`application.yaml`, `docker-compose.yml`, `BillingAccessFilter`, `CorsConfig` e `PushService`.

---

### V3 · Médio · Operação e manutenção

- **VPS única e compartilhada** com QA, Umami e o staging de outro produto; API limitada a 768 MB e
  1 CPU, banco a 512 MB (`deploy/storyverse/docker-compose.yml`). Sem redundância. Aceitável no tamanho
  atual; separar QA/staging da produção quando houver assinantes pagantes.
- **Arquivos gigantes no site:** `src/App.tsx` com 9.566 linhas e `src/App.css` com 11.573. O bundle
  principal tem 663 KB e o Admin → Site registrou LCP p75 de 4,4 s no QA. Extrair a home, o leitor e
  o chat para `src/features/*` com carregamento sob demanda, como já é feito com admin e grupos.
- **Modelo de receita:** pelo registro de 28/10, eram 13 contas e 10 com acesso grátis sem prazo. O
  produto ainda não foi validado com pagantes; o diferencial (conversa com personagens sem spoiler)
  é real e funciona com obras em domínio público.

---

## UI/UX

Observado no site de produção, deslogado, em desktop (~800 px) e celular (375×812). Telas logadas
não foram vistas nesta rodada; a passada de 07/11 (`docs/qa/2026-11-07-passada-geral-ui-ux.md`)
cobre essas.

### U1 · Metadados crus na vitrine
A home e `/biblioteca` mostram "Morte_DiaValePenaViver_FINAL.indd · Autor não informado",
"CLARISSA PINKOLA ESTES · V" e "FLORES, Coiote QueDeusTeriaPiedadeDeNos[2025]". 12 dos 50 livros
estão sem descrição e 13 sem gênero.
**Sugestão:** na aprovação de envios (`src/features/admin/SubmissionsModeration.tsx`) e na publicação
do catálogo, exigir título, autor e gênero e alertar quando o título parece nome de arquivo
(extensão, sublinhados, colchetes). Corrigir os itens já publicados.

### U2 · Três vitrines com os mesmos livros
Na home (`src/App.tsx`, por volta de `:8397`, `:8412` e `:8495`): "Novidades da biblioteca",
"Novidades / Acabou de chegar" e "Da comunidade" repetem as mesmas capas.
**Sugestão:** uma vitrine de novidades só; "Da comunidade" apenas se tiver conteúdo diferente.

### U3 · Subpáginas sem marca nem navegação
`/biblioteca`, `/ouvir`, `/assinar` e as páginas legais têm só um botão "Voltar"/"Biblioteca". Quem
chega por link direto não vê a marca nem como entrar ou criar conta.
**Sugestão:** reaproveitar o cabeçalho da home (logo, Livros, Áudio, Login, Criar conta) nessas rotas.

### U4 · Sem prévia de link nem presença em busca
`index.html` não tem `meta description` nem Open Graph/Twitter Card; `/robots.txt` devolve o HTML do
app (não existe o arquivo); não há sitemap. Link colado no WhatsApp sai sem imagem nem resumo.
**Sugestão:** descrição e tags OG estáticas no `index.html` com uma imagem em `public/`;
`public/robots.txt`. Prévia por livro exige gerar HTML por rota (pré-render no build ou resposta
do Caddy/API para robôs) e pode ficar para depois do domínio próprio.

### U5 · Texto técnico na oferta
`src/features/billing/SubscribePage.tsx:170`: "O acesso é validado no servidor". Não diz nada ao
leitor. "Cancele quando quiser pelo portal do Stripe" também pressupõe que a pessoa conhece o Stripe.
**Sugestão:** "Cancele quando quiser, em Minha assinatura." e remover a frase do servidor.

### U6 · Convite para instalar antes de a pessoa conhecer o produto
No celular, a faixa "Baixe o app do Storyverse" (`src/App.tsx:8144`) aparece no topo da primeira
visita e empurra o conteúdo.
**Sugestão:** mostrar depois do primeiro capítulo aberto ou da segunda visita.

### U7 · Afirmações que o conteúdo contradiz
Rodapé, `/biblioteca` e Termos dizem "domínio público" ao lado de capas de autores vivos. Resolver
junto com V1: ou o acervo muda, ou o texto muda.

### Correção ao relatório do chat
No resumo anterior eu disse que os carrosséis fazem o leitor de tela ler cada livro duas vezes. Está
errado: as cópias têm `aria-hidden` (`src/App.tsx:8450`). O que vale conferir é se os botões dentro
das cópias saem da ordem de tabulação (`inert` ou `tabIndex={-1}`); isso não foi verificado.

---

## O que não foi coberto

- Fluxos logados (leitor, chat, grupos, perfil, assinatura, admin) nesta rodada.
- VPS, firewall, `.env` real, banco de produção, backups.
- Teste do bypass S1 com conta autenticada sem assinatura.
- Varredura de dependências Maven da API.
- Teste de carga.
