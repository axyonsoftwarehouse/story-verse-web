# Relatório de segurança — Web + API — 21/10/2026

## Escopo

- **Web:** `C:\Users\werne\WebstormProjects\story-magic` (React + TypeScript + Vite, PWA, SQL legado de Supabase, deploy VPS/Vercel).
- **API:** `C:\Users\werne\WebstormProjects\story-verse-api` (Spring Boot 4.1.1, Java 25, JDBC, Flyway, Postgres 16).
- **Infra/config versionada:** Caddy, Docker Compose, Dockerfiles, workflows GitHub Actions, scripts de deploy/backup.
- **Fora do escopo dinâmico:** VPS real, banco de produção, políticas efetivamente aplicadas, DNS/TLS, sistema operacional, WAF, Sentry/provedores de IA e testes de intrusão.

## Veredito

**O projeto está acima da média em fundamentos de segurança, mas não pode ser declarado “em conformidade com OWASP”.**

Não encontrei **RCE, SQL injection, bypass direto de autenticação ou path traversal** nas rotas revisadas. Os controles centrais existem: RLS, autorização no servidor, tokens opacos com hash, rotação de refresh, escopos de arquivo por conta, cotas, auditoria e redação de telemetria.

Porém, há **cinco lacunas de prioridade alta** que impedem afirmar conformidade com OWASP Top 10/ASVS L2:

1. **Replay de créditos de IA** permite chamadas pagas ilimitadas.
2. **Tokens de sessão no `localStorage`** permitem roubo de sessão por XSS.
3. **CSP incompleta** (sem `script-src`/`default-src`) agrava o risco de XSS.
4. **Promoção de administrador por e-mail** em script operacional.
5. **Defaults de conexão com o banco como owner**, que desativam a RLS se o Compose não for usado.

Além disso, a suíte de testes do frontend falhou localmente (6 de 78), o que compromete o gate de qualidade da CI.

**Maturidade estimada:** entre ASVS L1 e L2; **não** L2 completo.

---

## Status das correções (branch `fix/seguranca-p1`, 21/10/2026)

| Item | Status | O que foi feito |
|---|---|---|
| P1-01 replay de crédito de IA | **Corrigido** | `AiBudget` rejeita `requestId` duplicado com `409 AI_REQUEST_REPLAYED`; teste de regressão adicionado. |
| P1-02 tokens em `localStorage` | **Corrigido** | Refresh em cookie `HttpOnly`/`Secure`/`SameSite`; access token só em memória; resposta HTTP sem refresh; chave antiga é apagada. O caminho legado do Supabase (só desenvolvimento) mantém o comportamento antigo. |
| P1-03 CSP incompleta | **Corrigido** | CSP completa e headers no Caddy e no `vercel.json`; `COOP`, `Permissions-Policy`, `Referrer-Policy`; PDF.js 6 sem eval. |
| P1-04 admin por e-mail | **Corrigido** | `promote-admin.sh` agora exige UUID existente e e-mail confirmado; grava auditoria. |
| P1-05 defaults de banco owner | **Corrigido** | Default `storyverse_api`; `RuntimeRoleGuard` falha o boot se o runtime for owner/superuser/bypassrls. |
| P2-01 senha mínima | **Corrigido (blocklist local)** | Mínimo 8, limite do BCrypt, blocklist local de senhas comuns/vazadas e rejeição de senha contendo e-mail/nome. HIBP não está integrado; a lista é embarcada e atualizada com o código. |
| P2-02 enumeração/timing | **Corrigido (produção)** | Cadastro com confirmação responde igual para conta existente/inexistente (e envia aviso ao dono); login usa BCrypt fictício. O modo dev com confirmação desligada ainda usa 409. |
| P2-03 lockout de conta | **Mitigado** | Limite de falhas passou a contar só o erro; senha correta não é bloqueada por tentativas de terceiros. Rate limit por IP/conta e falta CAPTCHA continuam como risco residual. |
| P2-04 `select *` em aprovados | **Corrigido** | Colunas explícitas, sem `review_note`/`reviewed_by`. |
| P2-05 `cover_url` arbitrária | **Corrigido** | `CoverUrlPolicy` aceita só caminhos locais do Storage, Open Library/Archive e host público da API; bloqueia esquemas perigosos, credenciais e hosts desconhecidos. |
| P2-06 reuso de refresh token | **Corrigido (com trade-off)** | Refresh token antigo revoga a família de sessões e retorna `AUTH_REFRESH_REUSED`; histórico separa `access` e `refresh` (V11). Clientes concorrentes precisam serializar (o web usa `navigator.locks`); retry com o token antigo após resposta perdida encerra a sessão. |
| P2-07 rate limit em memória | **Corrigido (com fallback)** | Contador persistente em `api_rate_limits` (V12), compartilhado entre instâncias, com janela atômica e fallback local se o banco falhar; pool do Hikari ajustado. |
| P2-08 upload confia no Content-Type | **Corrigido** | API valida assinatura real de JPEG/PNG/WebP/gzip e rejeita texto com bytes de controle/NUL. |
| P2-09 tokens de e-mail em URL | **Corrigido** | Links usam `#token=` (não vai para logs); `?token=` antigo continua aceito na transição. |
| P2-10 tradução remota sem aviso | **Mitigado** | Livros locais/importados só enviam trechos a Google/MyMemory após consentimento explícito; Gutenberg/comunidade (públicos) não pedem. Se o tradutor local falhar, o livro privado **não** cai no remoto sem aceite. A tradução continua remota depois do consentimento. |
| P2-11 supply chain | **Parcial** | Dependabot (npm/Maven/actions/Docker), `npm audit` no CI, Actions pinadas por SHA, CLI Vercel fixada, imagens por digest, SBOM CycloneDX (API/web), Trivy (relatório) e assinatura keyless da imagem da API com cosign. Faltam scan Maven bloqueante e assinatura do SBOM. |
| P2-12 alertas de segurança | **Mitigado** | `SecurityEvents` (sem PII) para reuso de refresh, reset/troca de senha e exclusão de conta; tag `security.event` no Sentry. Runbook em `docs/ALERTAS_SEGURANCA.md`; as regras no painel ainda precisam ser ativadas. |
| P2-13 exclusão/exportação | **Corrigido** | API exporta JSON e arquivos em ZIP (`/account/export` e `/account/export/files`), exclui com senha e função `security definer` (V13), remove arquivos e limpa dados locais do aparelho. UI em Ajustes baixa JSON/ZIP, exige senha/confirmação e limpa dados locais. |
| Gate de testes web | **Corrigido** | `vitest.config.ts` usa `pool: "vmThreads"` e timeout maior; 87/87 testes passam. |

Verificação desta rodada: API compila e passa **55 testes unitários** (22 de integração pulados por falta de Postgres local); web passa **87/87 testes**, lint com 0 erros e build de produção concluído. As novas funções de voz (Piper/ONNX) foram consideradas na CSP; os modelos são baixados de Hugging Face/CDNs e a síntese ocorre no aparelho.

### Pré-requisitos de deploy da sessão por cookie

- API com `APP_AUTH_REFRESH_COOKIE_SECURE=true` e `SameSite=Lax` quando web/API estão no mesmo site (produção). Para desenvolvimento cross-site (`localhost` → API remota), usar `SameSite=None` **com HTTPS**.
- CORS com credenciais e origem exata (`APP_CORS_ALLOWED_ORIGINS`); nunca `*`.
- Usuários com sessão antiga no `localStorage` precisarão entrar de novo uma vez: a chave com tokens é removida de propósito.
- A CSP cobre os hosts atuais (API, Sentry, tradução, Open Library, Gutenberg, Wikipedia/Wiktionary, Vercel Analytics, Piper/ONNX). Ao adicionar um serviço externo, incluir a origem em `connect-src`/`img-src`.
- Aplicar as migrations V11 (histórico de refresh por tipo), V12 (`api_rate_limits`) e V13 (`delete_my_account`) antes de subir esta versão da API.
- Configurar `APP_PUBLIC_API_URL` com o host público real da API para as capas enviadas pelo app; `APP_COMMUNITY_COVER_HOSTS` permite acrescentar outros hosts de capa.
- Com `APP_RATE_LIMIT_PERSISTENT=true`, o rate limit usa o Postgres; em falha do banco há fallback local, então um incidente de banco reduz a proteção entre instâncias.

---

## 1. Arquitetura e fronteiras de confiança

```
Navegador (React/PWA)
  ├─ localStorage/IndexedDB: sessão, progresso, conversas, livros
  ├─ Service Worker: shell, livros, imagens
  ├─ API própria (HTTPS, Bearer opaco) ──> Spring Boot ──> Postgres (RLS)
  ├─ Arquivos: API /api/v1/storage/... ──> disco local na VPS
  └─ Terceiros: Google Fonts, Vercel Analytics, Sentry, IA, Google Tradutor/MyMemory,
                 Gutenberg/Open Library, geração de retratos
```

Fronteiras relevantes:

- **Web → API:** Bearer token; CORS sem credenciais; não há CSRF clássico.
- **API → banco:** papel de runtime deve ser `storyverse_api`, sem `superuser`/`bypassrls`, sujeito a RLS via `auth.uid()` (`app.user_id`).
- **API → disco:** cada usuário só grava na própria pasta; `profile-media` é público.
- **API → terceiros:** URLs de IA são constantes no servidor; não há SSRF com URL controlada pelo usuário.
- **Web → terceiros:** tradução remota envia texto do livro para Google/MyMemory; retratos e capas consultam serviços externos.

---

## 2. Matriz OWASP Top 10 (2021)

| Categoria | Situação | Comentário |
|---|---|---|
| **A01 Broken Access Control** | Parcial | RLS, checagens no servidor e pastas por usuário são bons. Há exposição excessiva em `listApproved`, URL de capa sem validação e inconsistência `admins` × `user_roles`. |
| **A02 Cryptographic Failures** | Parcial | TLS/HSTS, BCrypt, tokens opacos com SHA-256. Porém access/refresh ficam em `localStorage`. |
| **A03 Injection** | Bom | JDBC parametrizado, React escapa conteúdo, sem `dangerouslySetInnerHTML`/`eval` no app, path traversal bloqueado, limites de ZIP/EPUB. |
| **A04 Insecure Design** | Parcial | Economia e leitura foram para o servidor; porém o replay de crédito de IA permite uso pago ilimitado. |
| **A05 Security Misconfiguration** | Parcial | Cabeçalhos básicos existem, mas CSP não possui `script-src`/`default-src`; `vercel.json` não define cabeçalhos; defaults de banco são inseguros. |
| **A06 Vulnerable Components** | Parcial/desconhecido | `npm audit` = 0. Dependências Java não foram varridas com scanner; actions e imagens não estão presas por SHA/digest. |
| **A07 Auth Failures** | Parcial | Rotação single-use, revogação e rate limit. Senha mínima de 6 caracteres, enumeração de conta, possível lockout e tokens em `localStorage`. |
| **A08 Software/Data Integrity** | Parcial | Imagem por SHA no deploy é boa. Faltam pinagem de actions/imagens, SBOM, assinatura e scan. Script de admin por e-mail. |
| **A09 Logging/Monitoring** | Parcial | Sentry sem PII e auditoria administrativa; faltam alertas de eventos de segurança e rate limit centralizado. |
| **A10 SSRF** | Bom | Proxies e provedores de IA usam destinos fixos; URLs de capa não são buscadas pelo servidor. |

---

## 3. Achados de prioridade alta (P1)

### P1-01 — Replay de crédito de IA permite uso pago ilimitado

**Componentes:** `story-verse-api` (`AiController`, `AiBudget`, migration `V10`).

**Evidência:**
- `src/main/java/com/storyverse/api/ai/AiController.java:78-85` usa `requestId` enviado pelo cliente.
- `src/main/java/com/storyverse/api/ai/AiBudget.java:77-86` chama `consume_ai_credit(:ref)` e prossegue quando `consumed=true`.
- `src/main/resources/db/migration/V10__ai_packs.sql:154-157` retorna `consumed=true, duplicate=true` quando o mesmo `ref` já foi usado.
- `V10__ai_packs.sql:157` não devolve a resposta anterior; apenas informa duplicidade.
- `AiController.java:95` chama o provedor de IA **depois** da reserva.

**Impacto:** depois de esgotar a cota gratuita diária, um cliente malicioso reutiliza um `requestId` já consumido. Cada nova chamada com o mesmo `ref` recebe `consumed=true`, **não debita crédito** e **executa uma nova geração**. Com `AI_DAILY_GLOBAL_LIMIT=0` (padrão), o custo é ilimitado (limitado apenas por 6 req/min/conta). É abuso de lógica de negócio e custo financeiro.

**Correção:**
- Tratar duplicidade como operação já concluída: retornar a resposta armazenada ou `409`, nunca chamar o provedor novamente.
- Persistir `(user_id, request_id) → resultado` com TTL, ou exigir um `requestId` novo e vincular ao hash do prompt.
- Adicionar teste de regressão: esgotar cota gratuita, comprar 1 crédito, repetir o mesmo `requestId` e confirmar que **não** há segunda geração nem crédito extra.

**Severidade:** Alta.

---

### P1-02 — Tokens de sessão em `localStorage`

**Componentes:** Web + contrato da API.

**Evidência:**
- `src/lib/auth.ts:186-189`: `storeSession()` grava a sessão inteira, incluindo `access_token` e `refresh_token`, via `userStorage`.
- `src/lib/dataOwner.ts:44`: `userStorage` usa `localStorage`.
- `src/lib/auth.ts:30-36`: o tipo `SupabaseSession` contém os dois tokens.
- A API devolve os tokens em JSON (`AuthResponse`/`AuthController`), sem cookie `HttpOnly`.
- O refresh dura 30 dias (`AuthService.java:24`).

**Impacto:** qualquer XSS no domínio do app lê o refresh token de 30 dias e assume a conta por completo; o access token de 30 minutos também é exposto. O risco é amplificado pela CSP incompleta (P1-03). A prática recomendada pelo OWASP/ASVS é refresh em cookie `HttpOnly; Secure; SameSite` e access token apenas em memória.

**Correção:**
- Migrar refresh para cookie `HttpOnly; Secure; SameSite=Strict/Lax`, com `Path=/api/v1/auth`, e access token em memória.
- Ajustar CORS para `allowCredentials=true` apenas com origem exata e adicionar proteção CSRF para o endpoint de refresh.
- Alternativa de transição: manter tokens em memória + refresh em `sessionStorage` de curta duração e CSP estrita; ainda assim não é o padrão ASVS.

**Severidade:** Alta.

---

### P1-03 — CSP incompleta e ausente em parte da infraestrutura

**Componentes:** Web/infra.

**Evidência:**
- `deploy/edge/Caddyfile:38`: `Content-Security-Policy "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"`.
- Não há `default-src`, `script-src`, `style-src`, `connect-src`, `img-src` ou `font-src`.
- `vercel.json` não possui seção `headers`.
- `index.html` carrega Google Fonts e o app carrega `@vercel/analytics`, Sentry, API, tradução e imagens externas.
- Não há `Cross-Origin-Opener-Policy` nem `Permissions-Policy`.

**Impacto:** a CSP atual não impede execução de script injetado; ela só bloqueia enquadramento, `object` e `base`. Combinada com tokens em `localStorage`, uma falha de XSS vira comprometimento total de sessão. Sem CSP no Vercel, qualquer deploy por lá fica sem defesa em profundidade.

**Correção:**
- CSP com nonce/hash para o script de entrada e `default-src 'self'`.
- `script-src 'self' 'nonce-…'` (e origem do Sentry/Analytics se necessário).
- `connect-src 'self' https://api.storyverse... https://*.sentry.io https://translate.googleapis.com https://api.mymemory.translated.net`.
- `img-src 'self' data: https:`, `font-src 'self' https://fonts.gstatic.com`, `style-src 'self' 'unsafe-inline'` (ou hash para o CSS inline do splash).
- `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`, `form-action 'self'`.
- Adicionar `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e os mesmos headers no `vercel.json`.

**Severidade:** Alta (defesa em profundidade; crítica quando combinada com P1-02).

---

### P1-04 — Promoção de administrador por e-mail em script operacional

**Componentes:** `deploy/promote-admin.sh`.

**Evidência:**
- `deploy/promote-admin.sh:13` recebe e-mail.
- `deploy/promote-admin.sh:21-24` insere em `public.admins` por `lower(email)`.
- `deploy/promote-admin.sh:29-32` insere `superadmin` em `public.user_roles` pelo mesmo e-mail.
- O script **não verifica** `email_confirmed_at`, nem exige UUID/titularidade verificada.
- Os próprios documentos (`docs/CORRECOES_SEGURANCA_2026-10-16.md:23`) dizem que a promoção deve usar UUID verificado, **nunca** apenas e-mail.
- `story-verse-api/src/test/resources/schema-postgres.sql:703-706` ainda contém um bootstrap antigo por e-mail (uso apenas de teste, mas é um padrão perigoso no repositório).

**Impacto:** se o operador promover um e-mail que não pertence a quem deveria (typo, conta antiga, e-mail compartilhado ou cadastro feito antes da confirmação), a conta errada recebe `superadmin`. É escalada de privilégio administrativo por um caminho operacional.

**Correção:**
- Substituir o parâmetro por **UUID** e exigir confirmação de e-mail antes de promover.
- Registrar a promoção em `admin_audit_log` com o ator e o UUID.
- Remover o bootstrap por e-mail do schema de teste e adicionar um teste que falhe se um script de promoção usar e-mail.

**Severidade:** Alta (operacional).

---

### P1-05 — Defaults de banco como owner desativam a RLS fora do Compose

**Componentes:** API/config.

**Evidência:**
- `story-verse-api/src/main/resources/application.yaml:6`: usuário padrão `storyverse` (owner das tabelas).
- `story-verse-api/.env.example:6`: `SPRING_DATASOURCE_USERNAME=storyverse`.
- `story-verse-api/README.md` orienta `SPRING_DATASOURCE_USERNAME=storyverse`.
- `deploy/storyverse/docker-compose.yml` usa corretamente `SPRING_DATASOURCE_USERNAME: storyverse_api`.
- `V4__runtime_role.sql:6-12` exige que o runtime não seja owner/superuser/bypassrls, mas **não há checagem em tempo de inicialização**.
- `CommunityService.java` ainda comenta “API conecta como dono do banco (sem RLS)”, o que evidencia o modo inseguro.

**Impacto:** se a API for executada fora do Compose (dev, outro deploy, `.env.example` copiado), ela conecta como owner e **a RLS deixa de ser aplicada**. Nesse modo, toda a autorização depende exclusivamente das checagens Java. Qualquer rota ou consulta que esqueça uma verificação vira IDOR/vazamento entre contas.

**Correção:**
- Trocar o default e os exemplos para `storyverse_api` e falhar o boot se o usuário atual for owner, superuser ou `bypassrls`.
- Exigir a senha do runtime e não ter fallback silencioso.
- Adicionar um health/readiness de segurança que confirme `has_table_privilege` e RLS ativa.

**Severidade:** Alta (configuração).

---

## 4. Achados de prioridade média (P2)

### P2-01 — Política de senha fraca

- `story-verse-api/src/main/java/com/storyverse/api/auth/AuthService.java:283-289` exige apenas **6 caracteres**.
- OWASP ASVS 2.1.1/NIST 800-63B pedem no mínimo **8** (e verificação contra senhas vazadas).
- Não há bloqueio de senhas comuns, nome/e-mail ou verificação de vazamento.
- BCrypt usa custo padrão (10); considerar 12 se o hardware permitir.

**Recomendação:** mínimo 8–12, lista de senhas comuns/vazadas, medidor de força; manter limite de 72 bytes do BCrypt.

**Severidade:** Média.

### P2-02 — Enumeração de conta no cadastro e diferença de tempo no login

- `AuthService.java:72-73` responde **409 “Este e-mail já está cadastrado”**.
- `AuthService.java:95-99` responde 401 genérico no login, mas a busca e o BCrypt criam diferença de tempo entre conta existente e inexistente.
- `AuthService.java:75-76` verifica existência **antes** de checar SMTP; com SMTP fora, e-mail existente retorna 409 e inexistente 503.

**Recomendação:** resposta genérica no cadastro (202), e-mail assíncrono, hash fictício no login para uniformizar tempo.

**Severidade:** Média.

### P2-03 — Possível bloqueio de conta via rate limit por conta

- `AuthService.java:91` aplica 15 tentativas/15 min por e-mail hasheado, **antes** de verificar a senha.
- Um atacante que conhece o e-mail pode esgotar o limite e impedir o login legítimo (429).

**Recomendação:** backoff progressivo, CAPTCHA após falhas, limite por IP+conta e não bloquear indefinidamente; considerar notificação ao usuário.

**Severidade:** Média.

### P2-04 — Exposição excessiva em `book_submissions` aprovados

- `CommunityRepository.java:22-25` faz `select * from public.book_submissions where status='approved'`.
- Isso devolve ao público `review_note`, `reviewed_by`, `user_id`, `text_path` e outros campos internos.
- `review_note` pode conter observações internas; `reviewed_by` expõe o admin.

**Recomendação:** DTO/colunas explícitas apenas com o necessário para a estante.

**Severidade:** Média.

### P2-05 — `cover_url` aceita qualquer URL

- `CommunityService.java:85` (criação), `:118` (revisão) e `:138-142` (troca de capa) limitam apenas o tamanho (300).
- O endpoint PATCH permite dono/admin gravar `javascript:`, `data:` ou URL externa arbitrária.
- O frontend renderiza como `<img>`, o que não executa `javascript:` em navegadores modernos, mas permite rastreamento, conteúdo externo e quebra de integridade.
- O RPC `set_submission_cover` original valida a pasta da pessoa; o PATCH não mantém a mesma regra.

**Recomendação:** exigir URL do próprio domínio e caminho `profile-media/<uid>/livros/...`, ou validar `https` + host permitido; preferir referência por caminho, não URL completa.

**Severidade:** Média.

### P2-06 — Ausência de detecção de reuso de refresh token

- `SessionRepository.java:43-47` busca apenas o hash atual; tokens antigos ficam no histórico (`:54`) mas não são usados para detectar replay.
- Se um refresh token roubado for usado antes do legítimo, a rotação invalida o legítimo, mas não revoga a sessão nem alerta.

**Recomendação:** ao receber token do histórico, revogar a sessão inteira e registrar evento; notificar o usuário.

**Severidade:** Média.

### P2-07 — Rate limiting apenas em memória e por instância

- `RateLimits.java:15-20` usa `HashMap` local, com teto de 10.000 chaves.
- Reinício zera limites; múltiplas instâncias multiplicam a cota; não há rate limit no Caddy.
- `AI_BUDGET` e quota de arquivos são no banco, mas login/cadastro/forum/IP não.

**Recomendação:** rate limit distribuído (Redis/Postgres) ou no edge (Caddy/Cloudflare), com chaves por IP real e conta.

**Severidade:** Média.

### P2-08 — Upload confia no `Content-Type` declarado

- `StorageService.java:46-50` e `207-219` validam apenas o header/extensão.
- `StorageBucket.java:10-14` permite `image/webp`, `image/jpeg`, `image/png`, `application/gzip`, `text/plain`.
- Não há verificação de magic bytes no servidor.
- `profile-media` é público.

**Impacto:** um cliente direto pode enviar HTML/JS/polyglot rotulado como imagem ou texto. O `nosniff` e os tipos de resposta reduzem a execução, mas a validação de conteúdo no servidor é uma defesa esperada.

**Recomendação:** sniffing de magic bytes, reencode de imagens no servidor (ou biblioteca de imagem), bloqueio de conteúdo ativo e limite de dimensões.

**Severidade:** Média (defesa em profundidade).

### P2-09 — Tokens de confirmação/recuperação em query string

- `MailService.java:53,67` monta links `/confirmar-email?token=...` e `/redefinir-senha?token=...`.
- O frontend limpa a URL depois (`auth.ts:409-411`), mas o primeiro request já passou por proxy/observabilidade; logs de acesso e histórico podem registrar o token.
- Não há `Referrer-Policy` no bloco da API; o site tem `strict-origin-when-cross-origin`.

**Recomendação:** token em fragmento (`#`) ou troca por POST; garantir `Referrer-Policy: no-referrer` na página de confirmação; revisar logs de Caddy/Vercel.

**Severidade:** Média.

### P2-10 — Tradução remota envia texto do livro a terceiros

- `src/lib/translate.ts:115-117` envia parágrafos para `translate.googleapis.com`.
- `src/lib/translate.ts:125-127` envia para `api.mymemory.translated.net`.
- O recurso é usado para livros; se o livro for importado/privado, o conteúdo sai do dispositivo sem aviso explícito.
- A arquitetura do web diz que dados locais não devem ser enviados sem decisão explícita de privacidade.

**Recomendação:** aviso/consentimento antes da primeira tradução remota; preferir tradutor local; documentar quais dados vão a quais serviços; permitir desligar.

**Severidade:** Média (privacidade).

### P2-11 — Cadeia de suprimentos e CI sem scan

- Actions presas por tag (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-java@v4`, `github-script@v7`).
- `npm install -g vercel@latest` no deploy web.
- Imagens `maven:3.9.16-eclipse-temurin-25`, `eclipse-temurin:25-jre-noble`, `postgres:16-alpine`, `caddy:2` por tag, não digest.
- Nenhum dos dois repositórios roda `npm audit`/OWASP Dependency-Check/CodeQL/SBOM/assinatura no CI.
- A voz neural baixa o modelo do Hugging Face e o motor/WASM de `cdnjs.cloudflare.com`/`cdn.jsdelivr.net`; a CSP restringe as origens, mas não há SRI/self-host desses artefatos.

**Recomendação:** pinar por SHA/digest, Dependabot/Renovate, `npm audit --audit-level=high`, OWASP Dependency-Check no Maven, CodeQL, SBOM (Syft) e assinatura (cosign); avaliar self-host do modelo/voz.

**Severidade:** Média.

### P2-12 — Falta de monitoramento/alerta de eventos de segurança

- Sentry remove PII corretamente (`SentryPiiConfig`), e há auditoria administrativa (`admin_audit_log`).
- Não há alerta para: muitos logins falhos, troca de senha, revogação em massa, picos de 401/403/429, uso anômalo de IA, uploads suspeitos.
- Logs de e-mail podem conter endereço (`MailService` registra destinatário em erro).

**Recomendação:** eventos estruturados, alertas e retenção; mascarar e-mail em logs.

**Implementado:** `SecurityEvents` registra eventos sem PII (`auth.refresh_reuse`, `auth.password_reset`, `auth.password_changed`) e envia ao Sentry com a tag `security.event`. Regras de alerta recomendadas no painel: `security.event:auth.refresh_reuse` (qualquer ocorrência), pico de 5xx, picos de 401/403/429, falha de envio de e-mail e uso anômalo de IA. A configuração efetiva dos alertas continua sendo uma etapa de operação.

**Severidade:** Média.

### P2-13 — Sem exclusão de conta/exportação de dados (LGPD)

- Não há endpoint para excluir a conta ou exportar dados; `auth.users` tem cascata, mas o usuário não consegue exercer o direito.
- `reading_state`, conversas, arquivos e submissões são dados pessoais.

**Recomendação:** fluxo autenticado de exclusão/anonimização e exportação; documentar retenção.

**Severidade:** Média (privacidade/legal).

### P2-14 — Cabeçalhos ausentes no Vercel e `vercel.json` sem `headers`

- Produção declarada é VPS, mas o workflow web também publica na Vercel.
- Sem CSP/HSTS/`X-Frame-Options` etc. no `vercel.json`, um deploy Vercel fica sem as proteções do Caddy.

**Recomendação:** adicionar `headers` no `vercel.json` ou desativar o caminho Vercel em produção.

**Severidade:** Média (configuração).

---

## 5. Achados de prioridade baixa / observações (P3)

1. **`CommunityService.updateCover` e RLS:** o PATCH permite dono no Java (`:132-142`), mas a policy de UPDATE de `book_submissions` é só admin (`database/schema.sql:213-216`). O dono recebe 404; o frontend usa RPC `set_submission_cover` para o dono. É inconsistência funcional, não bypass.
2. **`StorageAccess.admin` usa `public.admins`**, enquanto `is_admin()` também considera `user_roles` superadmin. Um superadmin criado apenas em `user_roles` perde direitos de storage (falha fechada).
3. **`ForumRepository.topic/reply` não filtra status explicitamente**; a visibilidade depende da RLS. Funciona com RLS ativa, mas defesa em profundidade pede `status='published' or author/staff` na consulta.
4. **`DbErrors.message` devolve mensagens do Postgres** em alguns fluxos; podem expor nomes de constraints/colunas. Baixo.
5. **`RequestSecurityFilter` monta JSON por concatenação** (`:43`). As mensagens atuais são estáticas, mas o padrão é frágil.
6. **Login timing enumeration** (`AuthService.java:95-99`): hash fictício ajudaria.
7. **Corrida no cadastro**: `findByEmail` + `insert` sem tratar `unique_violation` pode devolver 500 em cadastros concorrentes.
8. **`MailService` registra e-mail em log de erro** (`log.error("Falha ao enviar e-mail para {}...")`).
9. **`deploy/migrate-supabase.sh`**: `psql "$SUPABASE_DB_URL"` e `curl -H "apikey: $SUPABASE_SECRET_KEY"` colocam segredos em `argv`, visíveis em `ps`/auditoria local. Script de migração; risco operacional.
10. **Backups sem criptografia**: `deploy/backup.sh` usa `umask 077`, checksums e destino externo opcional, mas o dump é texto/binário não criptografado; contém dados pessoais. Definir criptografia e retenção externa.
11. **`schema-postgres.sql` de teste com bootstrap admin por e-mail** (`:703-706`): não é produção, mas é um padrão que não deveria existir no repositório.
12. **`report_reading` legado** em `supabase/weekly-ranking.sql` e no schema de teste ainda aceita `p_days`; a produção usa a V3, que ignora totais do cliente. Risco residual se o caminho Supabase for reaplicado sem hardening.
13. **PDF.js sem `isEvalSupported: false`**: `src/lib/importBook.ts:456` chama `getDocument({ data: buf })`; o documento de correções diz “PDF sem avaliação dinâmica”, mas a opção não está definida. PDF.js não executa JavaScript do PDF por padrão, mas a afirmação não corresponde ao código.
14. **Chave do Gemini na query string** (`AiService.java`): enviada como `?key=...`; headers seriam preferíveis para evitar registro em logs/proxies.
15. **`ai_cache` futuro**: a tabela guarda `content jsonb` e a chave é `(kind, partes)`; se for usada para conteúdo por usuário sem incluir o `user_id`, pode misturar respostas entre contas. Hoje `AiService` não usa o cache.
16. **`X-Frame-Options`/CSP no bloco da API**: o bloco `api.*` do Caddy não tem `Referrer-Policy`; baixo para JSON, mas padronizar é simples.
17. **Google Fonts/Analytics**: terceiros recebem IP/UA; sem SRI para CSS. Baixo.
18. **`review-build.log` não versionado** na API: não é segredo, mas deve ser removido/ignorado.
19. **Global advisory lock em `reading_heartbeat`**: todo heartbeat usa `pg_advisory_xact_lock(664332)`; com muitos leitores, serializa escritas e pode virar gargalo/DoS. Consistência correta, performance preocupante.
20. **Sessões expiradas não são podadas**: `auth.sessions` cresce; o histórico é podado, a tabela principal não.

---

## 6. Controles positivos verificados

- **Sessão:** tokens opacos de 256 bits, apenas SHA-256 no banco (`TokenService`); access 30 min/refresh 30 dias; rotação single-use com `FOR UPDATE`; revogação de sessões na troca/reset de senha; `navigator.locks` no frontend.
- **E-mail:** tokens opacos, hash no banco, uso único (`EmailTokenRepository.consume`), invalidação do anterior, TTL.
- **Autorização:** RLS habilitada nas tabelas; funções `security definer` com `search_path` fixo; `REVOKE` de funções internas; papéis `user_roles`; auditoria.
- **Arquivos:** validação de caminho, bloqueio de `..`/symlink, pasta por usuário, quota por conta sob lock, escrita atômica, tipos permitidos.
- **Economia:** ranking por heartbeat de tempo real no servidor; totais do cliente ignorados; presentes/pacotes idempotentes por `ref` (o bug é só no consumo de crédito de IA).
- **Abuso:** rate limit por IP/conta, cota diária de IA, teto global opcional, semáforo de concorrência, SSE finito, limites de corpo (1 MB/5 MB/50 MB).
- **Frontend:** React sem `dangerouslySetInnerHTML`, sem `eval`, links externos com `noreferrer`; limites de EPUB/ZIP testados; CORS/telemetria com redação; build rejeita Supabase/loopback/chaves privadas.
- **Deploy:** API não-root, imagem por SHA, SSH com `known_hosts`, migrations com credencial separada, backup com checksum e permissão restrita.
- **Testes existentes:** rotação concorrente, logout com token rotacionado, RLS do runtime, quota concorrente, ZIP forjado, isolamento de conta, fluxo de fórum, tokens single-use.

---

## 7. Verificações executadas

### Web

- `npm audit --json`: **0 vulnerabilidades** (25 prod, 232 dev).
- `npm run lint`: **0 erros, 9 avisos** (hooks/fast-refresh).
- `npm test`: **21 arquivos, 87/87 testes passando** após `pool: "vmThreads"` e timeout de ambiente no Vitest.
  - Antes da correção de ambiente, os 6 testes de rede estouravam 5 s no Windows quando a suíte rodava inteira (passavam isolados).
- `npm run build`: passou (aviso de chunk > 500 kB).
- Revisão estática de `src`, SQL, PWA, `vercel.json`, Caddy, Compose, workflows e scripts de deploy.

### API

- Revisão estática de 75 arquivos Java, 10 migrations Flyway, `application.yaml`, Dockerfile, CI e deploy.
- Compilação e **55 testes unitários passando** com `-Dmaven.compiler.release=21`.
- Os **22 testes de integração** usam PostgreSQL descartável e foram pulados localmente (sem Docker/Postgres e sem JDK 25); a CI usa JDK 25 e PostgreSQL 16.
- **Não foi executado** OWASP Dependency-Check/Snyk/Trivy no Maven; não há SBOM.

### Não realizado

- DAST, pentest, fuzzing, teste de carga/DoS.
- Verificação das policies efetivamente aplicadas no banco de produção.
- Auditoria da VPS, TLS, firewall, Caddy instalado, Sentry, SMTP, provedores de IA.
- Teste de restauração de backup.
- Revisão linha a linha de `bookSync`, `cloudSync`, `gifts`, `aiPacks` e das correções anteriores; foram considerados os relatórios existentes.

---

## 8. Roadmap sugerido

### Imediato (P1)

1. Corrigir o replay de crédito de IA e adicionar teste de regressão.
2. Migrar refresh para cookie `HttpOnly` + access em memória; ajustar CORS/CSRF.
3. Publicar CSP completa (+ headers no Vercel).
4. Trocar `promote-admin.sh` para UUID + confirmação + auditoria.
5. Trocar defaults/exemplos para `storyverse_api` e falhar o boot se o runtime for owner/superuser/bypassrls.
6. Corrigir os testes do frontend e tornar o gate confiável.

### Curto prazo (P2)

7. Senha mínima 8–12 + lista de vazadas; resposta genérica no cadastro; hash fictício no login; repensar lockout.
8. DTO explícito para `book_submissions`; validar `cover_url`; magic bytes nos uploads.
9. Detecção de reuso de refresh; alertas de segurança; rate limit distribuído/edge.
10. Consentimento/aviso para tradução remota e IA; revisar retenção de logs com tokens.
11. Pinar actions/imagens; adicionar audits/SAST/SBOM/assinatura.
12. Exclusão/exportação de conta; criptografia de backup.

### Médio prazo

13. Revisar o lock global de heartbeat; particionar por semana/usuário quando necessário.
14. Remover o bootstrap por e-mail do schema de teste; alinhar `StorageAccess` com `user_roles`.
15. Rodar ASVS L2 formalmente e um teste de intrusão externo.
16. Testes de carga, restauração de backup e resposta a incidentes.

---

## 9. Limitações e ressalvas

- “Conformidade OWASP” não é um certificado; o correto é declarar o nível ASVS alvo e o resultado por requisito. Este relatório é uma revisão técnica, não uma certificação.
- A API Java foi auditada por leitura de código; não houve execução da suíte atual nem teste dinâmico.
- Os resultados do frontend são locais (Windows); a CI Linux pode diferir nos timeouts.
- O estado real da VPS, do Postgres, das policies e dos segredos não foi inspecionado.
- As correções de 16/10 estão em grande parte presentes, mas os documentos antigos não devem ser tratados como prova de conformidade do código atual.
