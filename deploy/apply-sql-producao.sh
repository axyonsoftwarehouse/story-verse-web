#!/usr/bin/env bash
set -euo pipefail

# Aplica um patch SQL no banco de PRODUÇÃO. Passo a passo: docs/PATCH_PRODUCAO_2026-10-26.md.
# Uso (na VPS): bash /home/deploy/storyverse/deploy/apply-sql-producao.sh <patch.sql> [referencia.sql]
#   referencia.sql: definições guardadas antes do mesmo patch em outro banco (ex.: o backup do QA).
#   Se as funções atuais da produção forem diferentes da referência, o script para sem aplicar.
# Antes de aplicar: guarda as definições atuais em backups/funcoes/ e pede confirmação digitada.

cd /home/deploy/storyverse
[ -f .env ] || { echo "PARADO: sem .env em /home/deploy/storyverse" >&2; exit 1; }
if grep -qx 'POSTGRES_DB=storyverse_qa' .env; then
  echo "PARADO: este .env é do QA; no QA use storyverse-qa/apply-sql.sh" >&2
  exit 1
fi
set -a
. ./.env
set +a

patch="$(realpath "${1:?uso: apply-sql-producao.sh <patch.sql> [referencia.sql]}")"
reference="${2:-}"
[ -f "$patch" ] || { echo "PARADO: patch não encontrado: $patch" >&2; exit 1; }
[ -z "$reference" ] || [ -f "$reference" ] || { echo "PARADO: referência não encontrada: $reference" >&2; exit 1; }

db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"

psql_db() {
  docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" "$@"
}

names=$(grep -oE '^create or replace function public\.[a-z_]+' "$patch" | sed 's/.*\.//' | sort -u | paste -sd, -)
[ -n "$names" ] || { echo "PARADO: o patch não recria nenhuma função" >&2; exit 1; }

mkdir -p backups/funcoes
backup="backups/funcoes/$(date +%Y%m%d-%H%M%S)-$(basename "$patch")"
# Variável psql só é interpolada no stdin (não em -c).
psql_db -At -v names="$names" > "$backup" <<'SQL'
select pg_get_functiondef(p.oid) || ';'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = any (string_to_array(:'names', ','))
 order by p.proname;
SQL
echo "Definições atuais guardadas em $backup (para desfazer: psql < esse arquivo)"

if [ -n "$reference" ]; then
  # Compara as linhas sem ordem: o backup do QA não ordenava as funções.
  if ! diff <(sort "$reference") <(sort "$backup") >/dev/null; then
    echo "PARADO: as funções da produção são diferentes da referência ($reference)." >&2
    echo "Alguma migração mudou essas funções; revise antes de aplicar:" >&2
    diff <(sort "$reference") <(sort "$backup") | head -40 >&2
    exit 1
  fi
  echo "Funções atuais iguais às da referência."
fi

echo "Banco: $db_name   Patch: $patch"
read -r -p "Digite APLICAR para aplicar na produção: " answer
[ "$answer" = "APLICAR" ] || { echo "Cancelado; nada foi alterado."; exit 1; }

psql_db < "$patch"
echo "Patch aplicado no banco $db_name."
