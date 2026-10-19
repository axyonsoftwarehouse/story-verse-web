#!/usr/bin/env bash
set -euo pipefail

# Promove uma conta ja cadastrada e confirmada a administrador do acervo.
# Uso: bash promote-admin.sh email@exemplo.com
# Rode na VPS, dentro de /home/deploy/storyverse (ou ajuste o cd abaixo).

cd /home/deploy/storyverse
email="${1:?uso: promote-admin.sh email@exemplo.com}"
db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"

docker compose exec -T db psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -v email="$email" <<'SQL'
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower(:'email')
on conflict do nothing;
SQL
