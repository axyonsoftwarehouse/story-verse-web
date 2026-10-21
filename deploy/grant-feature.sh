#!/usr/bin/env bash
set -euo pipefail

# Concede/revoga uma feature de beta para uma conta, por UUID.
# Uso: bash grant-feature.sh <uuid-da-conta> [feature] [true|false]
# Ex.: bash grant-feature.sh 00000000-0000-0000-0000-000000000000 library true
# Rode na VPS, dentro de /home/deploy/storyverse (ou ajuste o cd abaixo).
# NUNCA use e-mail: use o UUID de auth.users e confirme a titularidade fora de banda.

cd /home/deploy/storyverse
set -a
. ./.env
set +a

user_id="${1:?uso: grant-feature.sh <uuid-da-conta> [library] [true|false]}"
feature="${2:-library}"
enabled="${3:-true}"

if [[ ! "$user_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "UUID inválido: use o id da conta em auth.users." >&2
  exit 1
fi
if [ "$feature" != "library" ]; then
  echo "Feature inválida. Hoje só existe: library." >&2
  exit 1
fi
if [ "$enabled" != "true" ] && [ "$enabled" != "false" ]; then
  echo "O terceiro argumento deve ser true ou false." >&2
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

psql_db -v uid="$user_id" -v feature="$feature" -v enabled="$enabled" <<'SQL'
insert into public.feature_access (user_id, feature, enabled, granted_by, granted_at, updated_at)
values (:'uid'::uuid, :'feature', :'enabled'::boolean, null, now(), now())
on conflict (user_id, feature) do update
  set enabled = excluded.enabled,
      granted_by = null,
      updated_at = now();
SQL

if psql_db -tAc "select to_regclass('public.admin_audit_log')" | grep -q admin_audit_log; then
  psql_db -v uid="$user_id" -v feature="$feature" -v enabled="$enabled" <<'SQL'
insert into public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
values (null, 'feature.set', 'user', :'uid',
        jsonb_build_object('feature', :'feature', 'enabled', :'enabled'::boolean, 'via', 'grant-feature.sh'));
SQL
fi

echo "Feature $feature=$enabled para a conta $user_id."
