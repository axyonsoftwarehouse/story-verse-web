# Marco 3 — corte do Supabase para o ambiente próprio

Checklist operacional. **Nada aqui deve ser executado direto em produção sem antes testar a
restauração num banco/volume isolados.** O app atual continua no ar até a validação final.

## Entradas necessárias

- `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (projeto de produção confirmado: `vrqtrjiccnobngnasefk`).
- `SUPABASE_DB_URL` com a **senha real** do Postgres de origem (substitui `[YOUR-PASSWORD]`).
- Chaves de IA para o servidor: `GROQ_API_KEY`, `GEMINI_API_KEY` (e, se houver, OpenRouter).
- SMTP (confirmação de cadastro e recuperação de senha).
- Acesso à VPS e ao painel da Vercel (para remover as antigas `VITE_*` de IA).

## Fase 0 — Preparação

1. Registrar os IDs das imagens em produção (`docker ps --format '{{.Names}} {{.Image}}'`).
2. Fazer backup do destino atual com `deploy/backup.sh` e copiar para armazenamento externo.
3. Confirmar espaço livre no disco (o dump + Storage podem somar vários GB).
4. Guardar as credenciais fora do repositório (ex.: `~/Documents/storyverse/credenciais-marco3.env`).
5. Confirmar o SMTP e testar envio de e-mail.

## Fase 1 — Exportação da origem (somente leitura)

```bash
SUPABASE_URL='https://vrqtrjiccnobngnasefk.supabase.co' \
SUPABASE_DB_URL='postgresql://postgres:SENHA@db.vrqtrjiccnobngnasefk.supabase.co:5432/postgres' \
SUPABASE_SECRET_KEY='sb_secret_...' \
bash deploy/migrate-supabase.sh /caminho/fora/do/repo/migration
```

Gera `public.dump`, `auth_users.csv`, `storage/<bucket>/…`, `SHA256SUMS` e `MANIFEST.txt`.
Copie o diretório para armazenamento externo e confira:

```bash
cd /caminho/fora/do/repo/migration && sha256sum -c SHA256SUMS
```

> A conexão `db.<ref>.supabase.co:5432` pode exigir IPv6. Se falhar, use a string de conexão
> do pooler exibida no painel do Supabase (Connect → Session/Transaction pooler).

## Fase 2 — Restauração isolada (obrigatória antes do corte)

1. Suba um Postgres 16 descartável e aplique o schema base:
   ```bash
   psql "$DESTINO_ISOLADO" -v ON_ERROR_STOP=1 -f database/schema.sql
   ```
2. Importe as contas **primeiro** (por causa das FKs):
   ```bash
   psql "$DESTINO_ISOLADO" -v ON_ERROR_STOP=1 -c "\copy auth.users (id,email,encrypted_password,email_confirmed_at,raw_user_meta_data,last_sign_in_at,created_at,updated_at) from 'auth_users.csv' with (format csv, header true)"
   ```
3. Importe os dados do `public`:
   ```bash
   pg_restore --data-only --no-owner --no-privileges --disable-triggers \
     --single-transaction -d "$DESTINO_ISOLADO" public.dump
   ```
4. Copie o Storage para o volume de mídia, preservando `<bucket>/<caminho>`:
   ```bash
   docker run --rm -v storyverse_storyverse_media:/media \
     -v "$PWD/storage:/src:ro" alpine:3.22 \
     sh -c 'cp -a /src/. /media/ && chown -R 10001:10001 /media'
   ```
5. Rode o `schema.sql` de novo para o bootstrap de admin (ele só vale depois que a conta existe):
   ```bash
   psql "$DESTINO_ISOLADO" -v ON_ERROR_STOP=1 -f database/schema.sql
   ```
6. Validar no isolado:
   - contagem de `auth.users` e das 10 tabelas do `public`;
   - login com uma conta migrada (a senha bcrypt deve continuar valendo; contas sem
     `encrypted_password` precisam de recuperação de senha);
   - leitura, sincronização de progresso, destaque, ranking/diamantes e envio à comunidade;
   - abrir um livro importado (bucket `user-books`) e um texto aprovado (`community-books`);
   - foto de perfil (`profile-media`).

## Fase 3 — API corrigida e migrations

1. Merge do PR da API (`fix(seguranca)`), gerando imagem publicada por SHA.
2. Na VPS, `/home/deploy/storyverse/.env`: `API_IMAGE=<sha>`, `API_DB_PASSWORD=...`, chaves de IA.
3. Criar a credencial de runtime (sem superuser):
   ```sql
   \password storyverse_api
   ```
4. Subir a API/deixar o Flyway aplicar V2–V4 com a credencial administrativa.
5. Conferir `https://api.storyverse.2.29.42.104.sslip.io/api/v1/health/ready`.

## Fase 4 — Corte (janela de manutenção)

1. Avisar e congelar escritas (app atual) durante a janela.
2. Rodar uma **última exportação** (Fase 1) e repetir a restauração validada.
3. Subir API e frontend apontando para a API própria (`VITE_API_URL`).
4. Validar login, leitura, sincronização entre duas contas, comunidade e arquivos.
5. Só então desligar o endereço antigo (Vercel/Supabase). Manter a rede de segurança.

## Fase 5 — Depois do corte

- Rotacionar todas as chaves que passaram por chat/arquivos (Supabase secret, Groq, Gemini).
- Remover da Vercel as `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_OPENROUTER_API_KEY`.
- **Pendência temporária:** enquanto não há acesso ao painel da Vercel, o workflow
  `.github/workflows/frontend.yml` remove essas chaves do build e força `VITE_API_URL`.
  Reverter esse ajuste quando as variáveis da Vercel forem corrigidas.
- Agendar `deploy/backup.sh` com cópia externa e alerta de falha.
- Registrar o artefato anterior como rollback.

## Rollback

- Frontend: republicar o build anterior (`web/previous`).
- API: voltar `API_IMAGE` para o digest anterior **e** restaurar a configuração antiga de
  credenciais; o binário antigo não estabelece o contexto RLS em todos os serviços.
- Banco: restaurar o backup feito na Fase 0 (não testar restauração sobre produção).

## Observações de mapeamento

- `auth.users` de origem tem muito mais colunas; migramos só as que o schema local usa
  (`database/schema.sql:39-49`). `encrypted_password` preserva a senha (bcrypt).
- O `pg_dump` é só do schema `public`; o `auth` do Supabase não é restaurado por cima do local.
- Tabelas migradas: `admins`, `book_submissions`, `diamond_ledger`, `diamond_wallets`,
  `ranking_profiles`, `reading_days`, `reading_state`, `streak_freezes`, `weekly_awards`,
  `weekly_closings`.
