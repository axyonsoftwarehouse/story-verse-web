#!/usr/bin/env bash
set -euo pipefail

# Promove uma conta existente e com e-mail confirmado a superadmin.
# Uso: bash promote-admin.sh <uuid-da-conta>
# Rode na VPS, dentro de /home/deploy/storyverse (ou ajuste o cd abaixo).
#
# NUNCA promova por e-mail: o cadastro pode não ter confirmado o endereço e variantes do
# Gmail (pontos) apontam para a mesma caixa. Pegue o UUID na tabela auth.users e confirme
# a titularidade por um canal fora da aplicação.

cd /home/deploy/storyverse
set -a
. ./.env
set +a

user_id="${1:?uso: promote-admin.sh <uuid-da-conta>}"
if [[ ! "$user_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "UUID inválido: use o id da conta em auth.users." >&2
  exit 1
fi

db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"

psql_db() {
  docker compose exec -T db psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

# Pelo stdin: o psql não substitui variáveis (:'uid') em comandos passados com -c.
confirmed=$(psql_db -v uid="$user_id" -tA <<'SQL'
select count(*) from auth.users where id = :'uid'::uuid and email_confirmed_at is not null
SQL
)
if [ "$confirmed" != "1" ]; then
  echo "Conta não encontrada ou e-mail ainda não confirmado." >&2
  exit 1
fi

psql_db -v uid="$user_id" <<'SQL'
begin;
insert into public.user_roles (user_id, role)
select id, 'superadmin' from auth.users where id = :'uid'::uuid and email_confirmed_at is not null
on conflict do nothing;
insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
values (null, 'admin.promote', 'user', :'uid', jsonb_build_object('via', 'promote-admin.sh'));
commit;
SQL

echo "Conta $user_id promovida a superadmin."
