# Loja de diamantes — etapa 1: itens de perfil

Data: 12/11/2026 · Cartão: "Expandir as funcionalidades de utilização dos diamantes no Storyverse"
(https://trello.com/c/8QJe6x2N) · Repositórios: `story-verse-web` (este) e `story-verse-api`.

Marcação: **[decidido]** veio do dono do produto nesta conversa; **[escolha minha]** é decisão de
quem escreveu este documento e pode ser revista; o resto é descrição do que já existe.

---

## 1. Intenção

Hoje os diamantes só servem para salvar a sequência de leitura (10 💎), comprar pacotes de mensagens
com personagens (30–100 💎) e enviar presentes (5–50 💎). Com tão poucos usos, juntar diamantes não
tem graça e a moeda vale pouco. O cartão pede transformar os diamantes numa moeda com utilidade em
várias áreas do app, de forma **evolutiva**: novas categorias de produto devem entrar sem refazer a
economia.

O cartão lista cinco áreas (loja, personalização de perfil, roleplay, destaque, colecionáveis).
**[decidido]** Elas viram etapas separadas. Esta é a **etapa 1: a loja (a base genérica) com a
primeira categoria, itens de perfil.** Ordem combinada para depois: colecionáveis/limitados →
recursos de roleplay → destaque na plataforma.

O que importa ao dono do produto: que outros leitores **vejam** o que a pessoa comprou (por isso a
moldura acompanha a foto em todo lugar) e que a administração consiga lançar itens novos sozinha,
sem depender de deploy.

## 2. Objetivos

1. Loja dentro do app, integrada ao saldo de diamantes que já existe.
2. Quatro tipos de item de perfil **[decidido]**:
   - **Moldura** da foto, em três níveis **[decidido]**: comum = anel de cor; rara = moldura
     ilustrada; épica = moldura animada.
   - **Insígnia**: uma escolhida aparece ao lado do nome; todas as compradas ficam numa estante no
     perfil **[decidido]** (opções A e B das telas).
   - **Capa do perfil**: faixa ilustrada no topo do perfil, atrás da foto **[decidido]** (opção C;
     o tema de página inteira ficou de fora).
   - **Nome colorido**: o nome aparece com cor/gradiente especial **[decidido]** (opção E).
3. Admin cria itens novos enviando imagens, define preço, nível e disponibilidade **[decidido]**.
4. Primeiro lote de itens desenhado por quem implementa **[decidido]**.
5. Critérios de aceite do cartão: acessar a loja; preços em diamantes; compra só com saldo; saldo
   atualizado; itens comprados disponíveis para uso; sem cobrança duplicada; histórico consultável.

## 3. Não objetivos (desta etapa)

- Comprar diamantes com dinheiro **[decidido]**: por enquanto eles só se ganham usando o app. Nada
  de Stripe, preço em reais ou reembolso nesta loja.
- Recursos de roleplay, destaque pago, itens sazonais/limitados com estoque (próximas etapas — mas o
  modelo de dados não pode impedi-los; ver §6.1).
- Tema de perfil inteiro (fundo e cores da página) e outros efeitos visuais além do nome colorido.
- Devolver, revender, trocar ou presentear itens da loja **[escolha minha]**.
- Mudar como se ganha diamantes ou os valores atuais de recompensa.

## 4. Antiobjetivos (falharia mesmo funcionando)

- Cobrar duas vezes por toque duplo, rede ruim ou duas abas.
- Item comprado que some, não aparece ou não pode ser equipado.
- Cosmético que atrapalha a leitura do app: nome colorido ilegível no fundo escuro, moldura animada
  se mexendo no chat, insígnia que empurra o layout das listas.
- Admin conseguir publicar arquivo perigoso (SVG com script, arquivo que mente o tipo) ou quebrar a
  tela de todos com uma imagem enorme.
- Loja inalcançável para quem lê pouco (só itens caros) ou sem graça para quem junta muito (tudo
  barato).

## 5. O que já existe (pontos de apoio)

- **Carteira e extrato** (API, Postgres): `apply_diamonds(user, amount, reason, ref)` trava a carteira
  a cada lançamento e é idempotente por `(reason, ref)` — devolve `null` se o lançamento já existia.
  O motivo `purchase` já está previsto no extrato (`src/lib/diamonds.ts`, `DiamondReason`), mas não
  é usado. RPCs `my_wallet` e `my_diamond_history`.
- **Padrão de compra idempotente**: `buy_ai_pack(p_pack, p_ref)` (V10) e `send_gift` (V9) recebem um
  `ref` (UUID gerado no cliente) e devolvem `duplicate: true` se repetido. Seguir o mesmo padrão.
- **RPC**: o site chama `rpc(session, nome, args)`; a API despacha em
  `story-verse-api/.../rpc/RpcService.java` (switch por nome → função SQL). Regras de negócio e
  checagens ficam nas funções SQL, com RLS e `auth.uid()` vindo de `DbSession.setUser`.
- **Migrações**: Flyway na API; a última é `V53__chat_message_report_count.sql`. A próxima é V54
  (conferir no momento de criar, pode haver outras na frente).
- **Armazenamento**: `StorageBucket` na API. `PROFILE_MEDIA` é público, 2 MB, aceita
  webp/jpeg/png. Endpoints em `/api/v1/storage/{bucket}/object` e leitura pública em
  `/api/v1/storage/public/{bucket}/{*path}`.
- **Avatares e capas**: a pessoa pode usar um avatar pronto (`src/avatars.tsx`, desenhos SVG no
  código) **ou enviar uma foto** (256×256), e pode **enviar uma foto de capa** (1500×500) — ver
  `src/lib/profileMedia.ts` e `updateProfileData(session, { name, avatar, photo, cover, bio })` em
  `src/App.tsx` (~linha 1820). A moldura tem de funcionar sobre os dois tipos de avatar. Grupos
  também têm `photo`. O avatar aparece no perfil, ranking, listas de pessoas
  (`src/features/social/PeopleParts.tsx`), chat e telas dos grupos (`src/features/groups/*`),
  convites e notificações (`src/features/notifications/NotificationBell.tsx`). As funções SQL que
  devolvem listas de pessoas já trazem o avatar de cada uma.
- **Loja atual**: `DiamondShopPage` em `src/App.tsx` (~linha 2875) mostra saldo, Salva-ofensiva,
  como ganhar, roleta e extrato. Presentes e pacotes de mensagens têm suas próprias telas.
- **Admin**: seções em `src/features/admin/*` com `AdminNav`; o admin já gerencia catálogo de livros
  e áudio (`CatalogSection`, `CatalogBookForm` etc.), que servem de modelo para formulário, prévia e
  upload.
- **Perfil privado** (PR #220): quem não segue um perfil privado vê só o básico.
- **Ganho típico** (código atual): meta de leitura 2 💎/dia (10 min), roleta 5–100 💎/dia (média ~25
  se as fatias forem equiprováveis — o sorteio real está em `spin_daily_wheel`, V48/V49), pódio do
  ranking semanal paga extra. Um leitor diário junta ~200 💎/semana.

## 6. Como funciona

### 6.1 Modelo da loja (genérico)

Um catálogo único de itens, cada um com **categoria** (nesta etapa: `frame`, `badge`, `cover`,
`name_color`), nível (`common`, `rare`, `epic`), nome, descrição, preço em diamantes, estado
(rascunho / à venda / fora de venda) e os dados visuais do tipo (imagens ou cores). Uma tabela de
**posse** (quem tem qual item, quando comprou, por quanto) e uma de **itens equipados** (no máximo um
por categoria equipável por pessoa).

Requisito de evolução: roleplay, destaque e limitados devem entrar como **novas categorias** (e,
para limitados, campos opcionais de janela de venda e estoque) sem mudar a compra, a posse nem o
extrato. **[escolha minha]** Deixar previstos desde já, mesmo sem uso nesta etapa, os campos
opcionais `available_from`, `available_until` e `stock` (nulos = sem limite) — custam pouco e evitam
migração de dados depois. O builder pode discordar se achar que complicam.

### 6.2 Comprar

- A pessoa abre a loja, vê os itens por tipo, com nome, descrição, nível e preço, e uma **prévia
  aplicada no próprio avatar** (moldura/insígnia/nome) ou no próprio perfil (capa) antes de comprar.
- Sem saldo suficiente, o botão de comprar fica desligado e mostra quanto falta.
- Item já comprado aparece como "Seu" com botão de equipar, nunca de comprar de novo.
- A compra é uma função SQL no padrão de `buy_ai_pack`: recebe item e `ref` gerado no cliente; numa
  transação confere item à venda (e janela/estoque, se houver), confere que a pessoa ainda não tem o
  item, debita via `apply_diamonds(uid, -preço, 'purchase', ref)`, grava a posse. Repetir o mesmo
  `ref` devolve o resultado anterior com `duplicate: true` e não cobra. Comprar o mesmo item com
  `ref` diferente é recusado ("você já tem este item") sem cobrar.
- **[escolha minha]** O preço cobrado é o do momento da compra, gravado na posse; mudar o preço
  depois não afeta quem já comprou.
- Depois da compra o saldo na tela atualiza com o valor devolvido pelo servidor (sem recarregar).
- **[escolha minha]** Perguntar "Equipar agora?" logo após comprar.

### 6.3 Extrato

O lançamento entra no extrato existente com o motivo `purchase`. O texto do extrato deve dizer o
item: "Compra: Moldura Folhas de outono". Hoje o rótulo é fixo ("Compra de diamantes",
`diamondEntryLabel`) e o `ref` é o UUID da compra — o builder decide como chegar ao nome do item
(ex.: a função de extrato juntar com a posse pelo `ref`). Atenção: "Compra de diamantes" passaria a
ser enganoso; trocar o texto.

### 6.4 Equipar e onde aparece

- Em "Meus itens" (dentro da loja ou do perfil — escolha do builder), a pessoa equipa ou tira um
  item de cada tipo: uma moldura, uma insígnia ao lado do nome, uma capa, uma cor de nome. Trocar é
  grátis e quantas vezes quiser. Equipar item que não é seu é recusado no banco.
- **Moldura, insígnia ao lado do nome e nome colorido** aparecem **em todo lugar onde o avatar
  aparece** **[decidido]**: perfil, ranking (semanal e geral), listas de seguidores/seguindo/
  sugestões, busca de pessoas, chat dos grupos (incluindo roleplay), informações do grupo,
  convites e notificações. Para isso, as funções que devolvem pessoas passam a devolver também o
  equipado de cada uma. **[escolha minha]** Sugestão: uma estrutura compacta e única
  ("cosmetics": ids/urls de moldura, insígnia e cor), montada por uma função SQL reutilizada, em vez
  de colunas soltas em cada função; o site resolve num componente único de avatar com moldura.
- **Roleplay** **[escolha minha]**: nas mensagens de roleplay o que aparece é o personagem (nome e
  retrato do personagem, `rp_character`), não a pessoa. Para não quebrar a imersão, as mensagens de
  personagem **não** levam moldura, insígnia nem nome colorido; a fala do narrador também não. Os
  cosméticos aparecem nas partes do grupo de roleplay que mostram a pessoa (lista de membros,
  informações do grupo, convites). Nos grupos de chat comum, as mensagens levam os cosméticos.
- **Atualização** **[escolha minha]**: não precisa ser ao vivo. Uma troca de moldura aparece para os
  outros quando a tela deles carrega os dados de novo (abrir o chat, recarregar a lista). Nenhum
  evento novo no fluxo ao vivo do chat; as mensagens que já chegam ao vivo podem trazer os
  cosméticos do autor se for barato, senão usam os dados de membros já carregados. Atenção: as
  rotas dos grupos são REST em Java, não `rpc` — os cosméticos precisam entrar também nessas
  respostas.
- **Assinatura** **[escolha minha, segue o que já existe]**: as RPCs (incluindo diamantes, presentes
  e pacotes) já ficam atrás do `BillingAccessFilter` — só quem tem acesso (assinatura ou acesso
  grátis concedido) usa a loja. Nada de checagem nova. Se a assinatura de alguém acabar, os itens
  dele continuam na conta e continuam aparecendo para os outros; ele só não compra nem troca até
  voltar a ter acesso.
- **Capa comprada × capa enviada** **[decidido]**: é uma ou outra. A pessoa escolhe qual capa o
  perfil mostra — a foto de capa que ela enviou ou uma capa comprada — e pode voltar para a dela a
  qualquer momento sem perder a comprada nem a enviada. Equipar uma capa da loja não apaga a foto
  de capa enviada. O valor da capa da loja é a arte exclusiva.
- **Capa e estante de insígnias** aparecem **só no perfil** **[decidido]**. A estante mostra todas as
  insígnias que a pessoa tem.
- **Moldura animada** **[escolha minha]**: anima no perfil e na prévia da loja; no chat, listas,
  ranking e notificações usa a versão parada. Respeitar `prefers-reduced-motion` (sempre parada).
- **Perfil privado** **[escolha minha]**: quem não pode ver o perfil ainda vê moldura, insígnia ao
  lado do nome e nome colorido (acompanham o avatar, que já é visível hoje), mas não vê capa nem
  estante.
- Tamanhos pequenos: a moldura não pode aumentar o espaço ocupado pelo avatar nas listas (desenhar
  por cima/em volta sem empurrar o layout); a insígnia ao lado do nome tem tamanho fixo e não quebra
  linha de nomes longos (o nome trunca antes).
- **Nome colorido legível**: o admin escolhe as cores; o sistema deve impedir (ou avisar fortemente)
  cores com contraste insuficiente contra o fundo escuro do app. O app tem temas (o padrão dourado
  `#14110e` e um verde `#0e1612` em `src/index.css`); conferir nos dois.

### 6.5 Admin

Nova seção no admin, no mesmo estilo de `CatalogSection`:

- Lista de itens com filtros por tipo e estado; criar, editar, pôr à venda, tirar de venda.
  **[escolha minha]** Item já vendido não pode ser apagado, só tirado de venda (quem comprou
  continua com ele e usando).
- Campos: tipo, nível, nome, descrição, preço, e o visual do tipo:
  - **Moldura**: imagem PNG ou WebP com fundo transparente, quadrada, que é desenhada em volta do
    avatar. Nível épico (animada): duas imagens — animada (WebP animado) e parada (PNG/WebP)
    **[escolha minha]**.
  - **Insígnia**: imagem PNG/WebP quadrada com transparência.
  - **Capa**: imagem PNG/WebP/JPEG na proporção da faixa do topo do perfil.
  - **Nome colorido**: uma cor ou um gradiente de 2–3 cores escolhidas num seletor; sem imagem.
- **Nada de SVG enviado** **[escolha minha]**: SVG pode carregar script. Só formatos raster, com
  conferência do tipo real do arquivo (não só a extensão/cabeçalho), limite de tamanho e de
  dimensões.
- **Prévia antes de publicar**: o item aplicado num avatar de exemplo, no tamanho do perfil e no do
  chat (e a capa num perfil de exemplo), para pegar moldura desalinhada ou insígnia ilegível.
- Ações do admin entram na auditoria que o admin já tem (`AdminAuditService`).
- **[escolha minha]** Imagens dos itens num armazenamento público próprio (novo valor em
  `StorageBucket`, ex. `shop-items`, público, só admin escreve), separado de `PROFILE_MEDIA`, que é
  dos usuários. Tamanho máximo a definir pelo builder (sugestão: 1 MB por imagem, 3 MB para a
  animada).

### 6.6 Preços **[escolha minha]**

Faixas de partida, ajustáveis pelo admin item a item:

| Nível | Faixa | Equivale a (leitor diário) |
|---|---|---|
| Comum | 50–150 💎 | alguns dias |
| Raro | 300–600 💎 | 2–3 semanas |
| Épico | 800+ 💎 | mais de um mês |

### 6.7 Primeiro lote **[decidido que o builder desenha]**

Desenhado no estilo das telas mostradas na conversa (fundo escuro, dourado `#e4b86a`, tons de leitura
— folhas, páginas, estrelas, lua, chaves, corujas). Os mockups aprovados estão em
`.superpowers/brainstorm/1579-1794503455/content/` (`molduras.html`, `insignias-temas.html`) — usar
como referência visual, não como especificação de pixel. **[escolha minha]** Tamanho do lote:

- Molduras: 3 comuns (anéis em cores diferentes), 2 raras (ilustradas), 1 épica (animada).
- Insígnias: 6 a 8.
- Capas: 3.
- Nomes coloridos: 3 (1 cor sólida, 2 gradientes).

O lote entra pelos mesmos caminhos que o admin usa (os itens são linhas do catálogo com imagens no
armazenamento), para provar que o admin consegue fazer o mesmo. Como colocá-lo em QA e produção
(migração com os dados + arquivos, script, ou cadastro pela própria tela do admin) fica a cargo do
builder, desde que seja repetível e não exija passo manual esquecível na produção.

## 7. Restrições

- Arquitetura atual: regras e saldo **só no banco** (funções SQL com RLS); o site pede e mostra.
- Nada de mudar os valores atuais de recompensa nem o comportamento de presentes, pacotes e
  Salva-ofensiva.
- Fluxo de trabalho do projeto: branch a partir da `develop` nos dois repositórios, PR para a
  `develop`; o PR da API (com a migração) é mergeado antes do do site. Testes no QA
  (`https://qa.storyverse.2.29.42.104.sslip.io/`) antes de abrir/mergear os PRs.
- Site: React 19 + Vite + TypeScript, Vitest; `src/App.tsx` já tem ~9.600 linhas — código novo vai
  em `src/features/shop/` (ou similar), não no `App.tsx`, exceto o mínimo para ligar a rota.
- API: Java 25 / Spring com JdbcClient, Flyway, testes de integração rodando com RLS ativa (um bug
  recente passou porque o teste rodava sem RLS — ver PR story-verse-api#135).
- Acessibilidade: avatar com moldura continua com o rótulo da pessoa; insígnia com nome acessível;
  animação respeita `prefers-reduced-motion`.

## 8. O que fica para o builder

- Nomes de tabelas, funções e RPCs; formato exato da estrutura "cosmetics".
- Onde fica "Meus itens"; layout da loja dentro do padrão visual do app.
- Como renderizar a moldura em volta do avatar em todos os tamanhos.
- Limites exatos de tamanho/dimensão das imagens e como validar o tipo real.
- Como colocar o primeiro lote nos ambientes.
- Se os campos opcionais de janela/estoque (§6.1) entram já ou na etapa dos limitados.
