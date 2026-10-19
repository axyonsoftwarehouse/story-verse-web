#!/usr/bin/env bash
set -euo pipefail

# Promove uma conta ja cadastrada e confirmada a administrador do acervo.
# Uso: bash promote-admin.sh email@exemplo.com
# Rode na VPS, dentro de /home/deploy/storyverse (ou ajuste o cd abaixo).

cd /home/deploy/storyverse
set -a
. ./.env
set +a

email="${1:?uso: promote-admin.sh email@exemplo.com}"
db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"

psql_db() {
  docker compose exec -T db psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

psql_db -v email="$email" <<'SQL'
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower(:'email')
on conflict do nothing;
SQL

# A V6 introduziu papeis. Mantem compatibilidade com bancos ainda sem a migration.
if psql_db -tAc "select to_regclass('public.user_roles')" | grep -q user_roles; then
  psql_db -v email="$email" <<'SQL'
insert into public.user_roles (user_id, role)
select id, 'superadmin' from auth.users where lower(email) = lower(:'email')
on conflict do nothing;
SQL
fi
