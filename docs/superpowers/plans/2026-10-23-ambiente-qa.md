# Ambiente de QA do Storyverse — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um ambiente de QA na mesma VPS, com site, API e banco separados da produção, publicado por branch e com contas de teste prontas, para testar funcionalidades (a começar pela estante) antes de chegar aos usuários.

**Architecture:** Uma segunda stack Docker Compose (`storyverse-qa`: Postgres + API) ao lado da de produção. O Caddy de borda que já existe ganha dois domínios novos e só é recarregado (sem reiniciar); a API de QA entra na rede `storyverse_default` para o Caddy alcançá-la, e o banco de QA fica numa rede só dele. O site de QA é publicado numa pasta irmã da produção dentro do volume que o Caddy já monta. Dois workflows novos (web e API) publicam no QA a partir do branch `qa` ou de qualquer ref escolhida à mão.

**Tech Stack:** Docker Compose, Caddy 2, GitHub Actions, PostgreSQL 16, Spring Boot (imagem da API em GHCR), Vite/React.

**Spec:** não há documento formal; os requisitos são os desta conversa (22–23/10/2026) e estão na seção "Requisitos" abaixo.

## Requisitos

- Stack separada (API + Postgres) na VPS atual, sem dados de produção.
- Domínios próprios para site e API.
- Deploy automático por branch (web e API).
- Dados de teste: contas prontas, uma com a estante liberada.
- Não derrubar nem alterar a produção do Storyverse nem o Foodie, que dividem a VPS.

## Global Constraints

- Domínios: site `https://qa.storyverse.2.29.42.104.sslip.io`, API `https://api.qa.storyverse.2.29.42.104.sslip.io`.
- Na VPS: stack em `/home/deploy/storyverse-qa` (projeto Compose `storyverse-qa`); site em `/home/deploy/storyverse/web/qa/{current,previous}` (o Caddy já monta `/home/deploy/storyverse/web` em `/srv/storyverse`).
- Limites: API de QA `mem_limit: 512m`, `cpus: 0.5`; banco de QA `mem_limit: 256m`, `cpus: 0.5` (a VPS tem 2 CPUs e ~1,3 GB livres, dividida com o Foodie).
- QA sem e-mail e sem IA paga: `APP_AUTH_REQUIRE_EMAIL_CONFIRMATION=false`, `SMTP_HOST` vazio, nenhuma chave de IA (chat em modo demonstração).
- Segredos só no `.env` da VPS (`/home/deploy/storyverse-qa/.env`), nunca no repositório. Senhas geradas com `openssl rand -base64 24`.
- Mesmos segredos de deploy do GitHub que a produção já usa (`VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `VPS_HOST`, `VPS_USER`). Nenhum segredo novo no GitHub.
- Nada nos workflows de produção (`deploy-storyverse.yml`, `deploy-api.yml`) muda de comportamento.
- Toda ação na VPS (Task 7) é feita com o ok do Werner no momento: o servidor é compartilhado.

## Decisões deste plano

1. **Sem reiniciar o Caddy.** Mudar volumes ou redes do contêiner `edge-caddy-1` exige recriá-lo, o que derruba por alguns segundos a produção e o Foodie. Por isso: o site de QA fica dentro do volume já montado (`web/qa/`) e a API de QA entra na rede `storyverse_default`, que o Caddy já alcança. Só o `Caddyfile` muda, aplicado com `caddy validate` + `caddy reload` (sem queda).
2. **Banco de QA isolado**: rede `qa-private` só da stack de QA. A API de QA fala com os dois; a produção não enxerga o banco de QA.
3. **Deploy por branch e por escolha**: os workflows de QA rodam em push no branch `qa` e por `workflow_dispatch` com o input `ref` (padrão `main`). Para testar um PR: `gh workflow run deploy-qa.yml -f ref=feat/minha-branch` — sem force-push em branch nenhum.
4. **Imagem da API de QA**: mesmo repositório GHCR, tag `qa-<sha>`; não sobrescreve as tags da produção.
5. **Migração não mergeada não trava o QA**: `SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS=*:missing` no QA (uma migração de um branch testado e depois descartado não impede a API de subir). Para voltar a um banco limpo, `reset-qa.sh` (Task 6).
6. **Papel `storyverse_api` com senha desde o primeiro boot**: um script de init do Postgres cria o papel com `API_DB_PASSWORD`; a V4 encontra o papel e só ajusta permissões (em produção isso foi manual).
7. **Contas de teste** `qa-leitor@example.com` (com `library`), `qa-sem-estante@example.com` (sem) e `qa-admin@example.com` (superadmin), todas com a senha `QA_TEST_PASSWORD` do `.env` de QA. `example.com` é reservado: nenhum e-mail real recebe nada.
8. **Ninguém confunde QA com produção**: faixa fixa "Ambiente de QA — dados de teste" no site quando `VITE_APP_ENV=qa`, e `X-Robots-Tag: noindex, nofollow` nos dois domínios de QA.
9. **CORS e cookies separados**: a API de QA só aceita `https://qa.storyverse…`; a de produção continua só com o site de produção. O cookie de refresh é por host (`api.qa…`), então sessões de QA e produção não se misturam.

## Review Focus

- **Deploy de QA atingindo a produção** (pasta, projeto Compose ou contêiner errados) → os scripts de QA recusam rodar fora de `storyverse-qa` e a publicação de QA não toca em `web/current` → testes nas Tasks 2 e 6.
- **`Caddyfile` inválido derrubando todos os sites no reload** → `caddy validate` antes de qualquer reload, no CI local e na VPS → Tasks 3 e 7.
- **Origem cruzada**: produção aceitando o site de QA (ou o contrário) → preflight CORS conferido nos dois sentidos → Task 7.
- **Memória**: a stack de QA pressionando a produção/Foodie → limites no Compose conferidos por `docker compose config` → Task 1; uso real conferido com `docker stats` → Task 7.
- **Migração de branch descartado** deixando a API de QA sem subir → padrão de ignore + reset → Tasks 1 e 6.

## Arquivos

| Repositório | Arquivo | Papel |
|---|---|---|
| story-magic | `deploy/storyverse-qa/docker-compose.yml` | stack de QA (db + api) |
| story-magic | `deploy/storyverse-qa/.env.example` | chaves do `.env` de QA (sem valores secretos) |
| story-magic | `deploy/storyverse-qa/initdb/00-runtime-role.sh` | papel `storyverse_api` com senha no primeiro boot |
| story-magic | `deploy/publish.sh` | publicar em uma pasta escolhida (produção ou `qa`) |
| story-magic | `deploy/edge/Caddyfile` | blocos dos dois domínios de QA |
| story-magic | `deploy/storyverse-qa/seed-qa.sh`, `reset-qa.sh` | contas de teste e banco limpo |
| story-magic | `.github/workflows/deploy-qa.yml` | build e publicação do site de QA |
| story-magic | `src/components/QaBanner.tsx` (+ teste) | faixa "Ambiente de QA" |
| story-magic | `docs/QA.md` | como usar e manter o QA |
| story-verse-api | `.github/workflows/deploy-api-qa.yml` | imagem `qa-<sha>` e atualização da API de QA |

Branches: `feat/ambiente-qa` nos dois repositórios, a partir da `main`.

---

### Task 1: Stack de QA (Compose, `.env` e papel do banco)

**Files:**
- Create: `deploy/storyverse-qa/docker-compose.yml`, `deploy/storyverse-qa/.env.example`, `deploy/storyverse-qa/initdb/00-runtime-role.sh`, `deploy/storyverse-qa/check-config.sh`
- O esquema inicial do banco **não** é copiado: o Compose monta `${QA_SCHEMA_FILE:-../storyverse/schema.sql}` (na VPS, o `schema.sql` que a produção já usa; no teste local, `story-verse-api/src/test/resources/schema-postgres.sql`).

**Interfaces:**
- Produces: projeto Compose `storyverse-qa` com serviços `db` e `api`; contêiner da API `storyverse-qa-api-1` na rede externa `storyverse_default` (alias usado pelo Caddy) e na rede `qa-private`; banco só em `qa-private`; volumes `storyverse-qa_db_data` e `storyverse-qa_media`.
- Produces: variáveis do `.env` de QA: `POSTGRES_DB=storyverse_qa`, `POSTGRES_USER=storyverse_qa`, `POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `API_IMAGE`, `QA_TEST_PASSWORD`, `SENTRY_DSN` (opcional), `SENTRY_ENVIRONMENT=qa`.

- [ ] **Step 1: Escrever o teste de configuração** — `deploy/storyverse-qa/check-config.sh`: roda `docker compose --project-name storyverse-qa --env-file .env.example config --format json` e falha (com `jq -e`) se qualquer uma destas não for verdade:

```bash
jq -e '(.services.api.mem_limit|tostring) == "536870912" and (.services.db.mem_limit|tostring) == "268435456"'
jq -e '.services.db.networks | keys == ["qa-private"]'
jq -e '.services.api.networks | keys | sort == ["edge","qa-private"]'
jq -e '.networks.edge.name == "storyverse_default" and .networks.edge.external == true'
jq -e '.services.api.environment.APP_CORS_ALLOWED_ORIGINS == "https://qa.storyverse.2.29.42.104.sslip.io"'
jq -e '.services.api.environment.APP_AUTH_REQUIRE_EMAIL_CONFIRMATION == "false"'
jq -e '.services.api.environment.SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS == "*:missing"'
jq -e '[.services.api.environment | to_entries[] | select(.key|test("GROQ|GEMINI|OPENROUTER|SMTP_HOST")) | .value] | all(. == "")'
jq -e '.services.api.container_name == "storyverse-qa-api-1"'
```

- [ ] **Step 2: Rodar e ver falhar** — `bash deploy/storyverse-qa/check-config.sh` → falha (`docker-compose.yml` não existe).
- [ ] **Step 3: Escrever os arquivos.** O Compose segue `deploy/storyverse/docker-compose.yml` (mesmas variáveis da API), com: domínios de QA em `APP_PUBLIC_URL`/`APP_PUBLIC_API_URL`/`APP_CORS_ALLOWED_ORIGINS`; `SENTRY_ENVIRONMENT: qa`; chaves de IA e SMTP fixas em `""`; `AI_DAILY_MESSAGE_LIMIT: 20`; o banco monta `${QA_SCHEMA_FILE:-../storyverse/schema.sql}` como `01-schema.sql` e `./initdb/00-runtime-role.sh`. O script de init cria `storyverse_api` com `login password '$API_DB_PASSWORD'` se não existir (usa `psql -v` e `:'pw'`, nunca interpolando a senha no SQL). `.env.example` lista as chaves com valores vazios e um comentário de como gerar cada senha.
- [ ] **Step 4: Rodar e ver passar** — `bash deploy/storyverse-qa/check-config.sh` → `OK`.
- [ ] **Step 5: Subir localmente (Docker Desktop)** — com um `.env` local de teste (senhas quaisquer, `API_IMAGE=ghcr.io/axyonsoftwarehouse/story-verse-api:<sha da main>`), criar a rede `docker network create storyverse_default` se não existir, `docker compose --project-name storyverse-qa up -d` e conferir `docker compose logs api | grep "Started ApiApplication"` e `curl -fsS localhost:<porta publicada só no teste>/api/v1/health/ready`. Derrubar com `down -v`. Se a imagem do GHCR for privada, pular este step e registrar no ledger.
- [ ] **Step 6: Commit** — `feat(qa): stack de QA (API e Postgres) separada da produção`

---

### Task 2: Publicação do site em pasta escolhida

**Files:**
- Modify: `deploy/publish.sh`
- Test: `deploy/test-publish.sh`

**Interfaces:**
- Produces: `publish.sh` lê `STORYVERSE_WEB_DIR` (padrão `/home/deploy/storyverse/web`), `STORYVERSE_INCOMING` (padrão `/home/deploy/storyverse/_incoming`) e `STORYVERSE_URL` (já existia). Sem as variáveis, o comportamento de produção é idêntico.

- [ ] **Step 1: Escrever o teste** — `deploy/test-publish.sh` cria uma pasta temporária com `web/current` (produção, arquivo `prod.txt`), `web/qa/current` (`qa-old.txt`) e `_incoming-qa` (`qa-new.txt`), sobe um servidor HTTP local de teste (`node -e` respondendo 200) e verifica:

```bash
STORYVERSE_WEB_DIR=$T/web/qa STORYVERSE_INCOMING=$T/_incoming-qa STORYVERSE_URL=http://127.0.0.1:$PORT bash deploy/publish.sh
test -f $T/web/qa/current/qa-new.txt && test -f $T/web/qa/previous/qa-old.txt
test -f $T/web/current/prod.txt                       # produção intocada
# URL que não responde → volta a versão anterior
STORYVERSE_WEB_DIR=$T/web/qa STORYVERSE_INCOMING=$T/_incoming-qa2 STORYVERSE_URL=http://127.0.0.1:1 bash deploy/publish.sh && exit 1
test -f $T/web/qa/current/qa-new.txt
```

- [ ] **Step 2: Rodar e ver falhar** — `bash deploy/test-publish.sh` → falha (o script ignora as variáveis e mexe em `/home/deploy`).
- [ ] **Step 3: Implementar** — `BASE="${STORYVERSE_WEB_DIR:-/home/deploy/storyverse/web}"`, `IN="${STORYVERSE_INCOMING:-/home/deploy/storyverse/_incoming}"`; `mkdir -p "$BASE"`; o resto igual.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(qa): publish.sh publica em pasta escolhida`

---

### Task 3: Domínios de QA no Caddy

**Files:**
- Modify: `deploy/edge/Caddyfile`
- Test: `deploy/edge/check-caddyfile.sh`

**Interfaces:**
- Produces: bloco `api.qa.storyverse.2.29.42.104.sslip.io` → `reverse_proxy storyverse-qa-api-1:8080` (mesmos headers da API de produção + `X-Robots-Tag "noindex, nofollow"`); bloco `qa.storyverse.2.29.42.104.sslip.io` igual ao do site de produção, com `root * /srv/storyverse/qa/current`, `connect-src` trocando a API de produção pela de QA e `X-Robots-Tag "noindex, nofollow"`.

- [ ] **Step 1: Escrever o teste** — `check-caddyfile.sh` roda `docker run --rm -v "$PWD/deploy/edge/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2@<mesmo digest do edge> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` e, com `caddy adapt`, confere por `jq` que existem os hosts `qa.storyverse…` e `api.qa.storyverse…`, que o upstream de QA é `storyverse-qa-api-1:8080` e que o bloco de produção continua com `root /srv/storyverse/current` e upstream `storyverse-api-1:8080`.
- [ ] **Step 2: Rodar e ver falhar** (hosts de QA ausentes).
- [ ] **Step 3: Implementar** os dois blocos, logo depois dos blocos de produção do Storyverse.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(qa): domínios de QA no Caddy de borda`

---

### Task 4: Faixa de QA no site e workflow de publicação da web

**Files:**
- Create: `src/components/QaBanner.tsx`, `src/components/QaBanner.test.tsx`, `.github/workflows/deploy-qa.yml`
- Modify: `src/main.tsx` (renderiza `QaBanner` acima do app), `src/vite-env.d.ts` (`VITE_APP_ENV?: string`), `src/App.css` (estilo da faixa)

**Interfaces:**
- Produces: `QaBanner({ env }: { env?: string })` — com `env === "qa"` mostra `role="status"` com o texto "Ambiente de QA — dados de teste, nada aqui é real."; em qualquer outro valor não renderiza nada. `main.tsx` passa `import.meta.env.VITE_APP_ENV`.
- Produces: workflow `Deploy QA (VPS)` com gatilhos `push: branches: [qa]` e `workflow_dispatch: inputs.ref` (padrão `main`); `concurrency: deploy-qa`; passos iguais aos de `deploy-storyverse.yml` com `ref` no checkout, build com `VITE_API_URL=https://api.qa.storyverse.2.29.42.104.sslip.io` e `VITE_APP_ENV=qa`, `rsync` para `/home/deploy/storyverse/_incoming-qa/` e publicação com `STORYVERSE_WEB_DIR=/home/deploy/storyverse/web/qa STORYVERSE_INCOMING=/home/deploy/storyverse/_incoming-qa STORYVERSE_URL=https://qa.storyverse.2.29.42.104.sslip.io bash /home/deploy/storyverse/deploy/publish.sh`.

- [ ] **Step 1: Escrever o teste**

```tsx
it("mostra a faixa só no QA", () => {
  const { rerender } = render(<QaBanner env="qa" />);
  expect(screen.getByRole("status")).toHaveTextContent("Ambiente de QA — dados de teste, nada aqui é real.");
  rerender(<QaBanner env="production" />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<QaBanner />);
  expect(screen.queryByRole("status")).toBeNull();
});
```

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar** a faixa (fixa no topo, cores do tema, sem cobrir a barra do leitor) e o workflow. - [ ] **Step 4: Verificar** — `npm test`, `tsc`, `lint`, `VITE_API_URL=… VITE_APP_ENV=qa npm run build`; validar o YAML do workflow com `actionlint` via `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`.
- [ ] **Step 5: Commit** — `feat(qa): faixa de QA e workflow de publicação do site de QA`

---

### Task 5: Workflow de publicação da API de QA (story-verse-api)

**Files:**
- Create: `.github/workflows/deploy-api-qa.yml` (no repositório story-verse-api)

**Interfaces:**
- Consumes: stack da Task 1 em `/home/deploy/storyverse-qa`.
- Produces: workflow `Deploy API QA (VPS)` com `push: branches: [qa]` e `workflow_dispatch: inputs.ref` (padrão `main`); `concurrency: deploy-api-qa`; imagem `ghcr.io/axyonsoftwarehouse/story-verse-api:qa-${{ github.sha }}` (build, push e cosign como em `deploy-api.yml`); na VPS: `cd /home/deploy/storyverse-qa`, troca `API_IMAGE` no `.env`, `docker compose --project-name storyverse-qa pull api && up -d api`; health em `https://api.qa.storyverse.2.29.42.104.sslip.io/api/v1/health/ready`. Sem smoke de IA (QA sem chaves).

- [ ] **Step 1: Escrever o teste** — `actionlint` (mesmo comando da Task 4) mais uma checagem por `grep` de que o arquivo não contém `/home/deploy/storyverse ` (com espaço), `storyverse-api-1` nem `api.storyverse.2.29` (produção).
- [ ] **Step 2: Rodar e ver falhar** (arquivo ausente). - [ ] **Step 3: Implementar.** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `ci(qa): publica a API no ambiente de QA`

---

### Task 6: Contas de teste, reset e manual do QA

**Files:**
- Create: `deploy/storyverse-qa/seed-qa.sh`, `deploy/storyverse-qa/reset-qa.sh`, `deploy/storyverse-qa/test-guards.sh`, `docs/QA.md`
- Modify: `README.md` (seção curta apontando para `docs/QA.md`)

**Interfaces:**
- Produces: `seed-qa.sh` (roda na VPS, em `/home/deploy/storyverse-qa`): cria as 3 contas da decisão 7 pelo `POST /api/v1/auth/signup` da API de QA (ignora "já existe"), concede `library` a `qa-leitor` e `superadmin` a `qa-admin` por `psql` no banco de QA, e imprime os e-mails (nunca a senha).
- Produces: `reset-qa.sh`: `docker compose --project-name storyverse-qa down -v` + `up -d` + espera o health + `seed-qa.sh`.
- Ambos começam com a mesma trava: saem com erro se `basename "$PWD"` não for `storyverse-qa`, se o `.env` não tiver `POSTGRES_DB=storyverse_qa` ou se o projeto Compose não for `storyverse-qa`.

- [ ] **Step 1: Escrever o teste** — `test-guards.sh` roda os dois scripts a partir de uma pasta temporária chamada `storyverse` (com um `.env` de produção falso) e de uma chamada `storyverse-qa` com `POSTGRES_DB=storyverse` e espera **saída com erro e nenhum comando `docker` executado** (um `docker` falso no `PATH` grava as chamadas num arquivo, que tem de ficar vazio).
- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar** os scripts e o `docs/QA.md` (endereços, contas, como publicar um PR no QA com `gh workflow run`, como resetar, limites, o que o QA não tem: e-mail, IA real). - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(qa): contas de teste, reset do banco de QA e manual`

---

### Task 7: Subir o QA na VPS (com o ok do Werner)

Passos executados no servidor compartilhado. **Antes de começar, confirmar com o Werner** e avisar que o Caddy será recarregado (sem queda esperada). Cada passo tem conferência; qualquer falha para tudo e nada da produção é tocado.

- [ ] **Step 1: Pré-checagem** — `free -m` (≥ 900 MB disponíveis), `df -h /` (≥ 5 GB livres), `docker ps` (produção e Foodie saudáveis). Guardar a saída.
- [ ] **Step 2: Arquivos** — `mkdir -p /home/deploy/storyverse-qa /home/deploy/storyverse/web/qa`; copiar `deploy/storyverse-qa/*` para a VPS; criar o `.env` de QA a partir do `.env.example` com senhas geradas na própria VPS (`openssl rand -base64 24`) e `API_IMAGE` = imagem atual da produção; `chmod 600 .env`; copiar `publish.sh` novo e `grant-feature.sh` para `/home/deploy/storyverse/deploy/`.
- [ ] **Step 3: Banco e API** — `docker compose --project-name storyverse-qa up -d db`, esperar healthy; `chown` do volume de mídia para `10001`; `up -d api`; conferir `Started ApiApplication` nos logs e `docker stats` (limites respeitados).
- [ ] **Step 4: Caddy** — backup do `~/edge/Caddyfile` (`Caddyfile.bak-<data>`); **acrescentar só os dois blocos de QA** ao arquivo da VPS (ele é mais antigo que o do repositório; ver ledger da Task 3), com `cat >>` para manter o mesmo arquivo (é um bind mount de arquivo único: `mv`/`sed -i` deixariam o contêiner lendo o antigo); validar com `deploy/edge/check-caddyfile.sh` sobre uma cópia e com `docker exec edge-caddy-1 caddy validate --config /etc/caddy/Caddyfile`, e só então `caddy reload`. Conferir na hora: `curl -fsS https://storyverse.2.29.42.104.sslip.io/`, `https://api.storyverse.2.29.42.104.sslip.io/api/v1/health/ready` e os domínios do Foodie respondendo como antes. Se algo falhar: restaurar o backup e `caddy reload`.
- [ ] **Step 5: Publicar** — disparar `Deploy API QA (VPS)` e `Deploy QA (VPS)` com `ref=main`; conferir health da API de QA e `200` no site de QA.
- [ ] **Step 6: Contas e CORS** — `bash seed-qa.sh`; preflight CORS: API de QA aceita `Origin: https://qa.storyverse…` e recusa o site de produção; API de produção recusa o site de QA.
- [ ] **Step 7: Teste de ponta a ponta** — no navegador, entrar no site de QA com `qa-leitor@example.com` (senha lida do `.env` de QA, não repetida no chat), abrir um livro, ver "Na estante", terminar, dar nota, abrir "Minha estante". Com `qa-sem-estante`, conferir que nada da estante aparece. Repetir com o PR #49 publicado no QA (`ref=feat/estante-web`) se ele ainda não estiver na `main`.

---

## Depois

- Fluxo de trabalho: PR aberto → `gh workflow run deploy-qa.yml -f ref=<branch>` (e o da API, se houver mudança lá) → testar no QA → merge → produção.
- Fora deste plano: QA com e-mail real (SMTP de teste), dados de produção anonimizados e um banco de QA por PR.
