#!/usr/bin/env bash
set -euo pipefail

# Primeiro boot do banco de QA: cria o papel da API com senha antes das migrações.
# A V4 da API encontra o papel e só ajusta as permissões (em produção a senha foi posta à mão).
psql -v ON_ERROR_STOP=1 -v pw="$API_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
select format('create role storyverse_api login password %L', :'pw')
 where not exists (select 1 from pg_roles where rolname = 'storyverse_api') \gexec
SQL
