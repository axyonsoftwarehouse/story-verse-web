#!/usr/bin/env bash
set -euo pipefail

# Tira o papel superadmin de uma conta.
# Uso: bash demote-admin.sh <uuid-da-conta>
# Rode na VPS, dentro de /home/deploy/storyverse (ou ajuste o cd abaixo).
#
# Recusa se for a última conta superadmin. Auditoria com actor_id nulo porque a ação é
# operacional, como no promote-admin.sh.

cd /home/deploy/storyverse
set -a
. ./.env
set +a

user_id="${1:?uso: demote-admin.sh <uuid-da-conta>}"
if [[ ! "$user_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "UUID inválido: use o id da conta em auth.users." >&2
  exit 1
fi

db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"

psql_db() {
  docker compose exec -T db psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

exists=$(psql_db -v uid="$user_id" -tAc \
  "select count(*) from auth.users where id = :'uid'::uuid")
if [ "$exists" != "1" ]; then
  echo "Conta não encontrada em auth.users." >&2
  exit 1
fi

is_superadmin=$(psql_db -v uid="$user_id" -tAc \
  "select count(*) from public.user_roles where user_id = :'uid'::uuid and role = 'superadmin'")
if [ "$is_superadmin" != "1" ]; then
  echo "Conta não é superadmin." >&2
  exit 1
fi

total=$(psql_db -tAc "select count(*) from public.user_roles where role = 'superadmin'")
if [ "$total" = "1" ]; then
  echo "Esta é a última conta superadmin; promova outra antes." >&2
  exit 1
fi

psql_db -v uid="$user_id" <<'SQL'
begin;
delete from public.user_roles where user_id = :'uid'::uuid and role = 'superadmin';
insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
values (null, 'admin.demote', 'user', :'uid', jsonb_build_object('via', 'demote-admin.sh'));
commit;
SQL

echo "Conta $user_id deixou de ser superadmin."
