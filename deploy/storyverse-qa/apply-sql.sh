#!/usr/bin/env bash
set -euo pipefail

# Aplica um patch SQL no banco de QA (nunca na produção: mesma trava do seed/reset).
# Rode em /home/deploy/storyverse-qa: bash apply-sql.sh sql/2026-10-26-revisao-seguranca.sql
# Antes, guarda a definição atual das funções que o patch troca em backups/, para desfazer com
#   docker compose --project-name storyverse-qa exec -T qa-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backups/<arquivo>
. "$(dirname "$0")/qa-guard.sh"
qa_guard

patch="${1:?uso: apply-sql.sh <arquivo.sql>}"
[ -f "$patch" ] || qa_die "arquivo não encontrado: $patch"

psql_qa() {
  qa_compose exec -T qa-db psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

# Funções que o patch recria (create or replace function public.<nome>).
names=$(grep -oE '^create or replace function public\.[a-z_]+' "$patch" | sed 's/.*\.//' | sort -u | paste -sd, -)
[ -n "$names" ] || qa_die "o patch não recria nenhuma função"

mkdir -p backups
backup="backups/$(date +%Y%m%d-%H%M%S)-$(basename "$patch")"
# Variável psql só é interpolada no stdin (não em -c).
psql_qa -At -v names="$names" > "$backup" <<'SQL'
select pg_get_functiondef(p.oid) || ';'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = any (string_to_array(:'names', ','));
SQL
echo "Definições atuais guardadas em $backup"

psql_qa < "$patch"
echo "Patch $patch aplicado no banco $POSTGRES_DB."
