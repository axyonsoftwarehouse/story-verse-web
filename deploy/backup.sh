#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/storyverse
umask 077

# Carrega POSTGRES_* e o destino externo opcional sem imprimir segredos.
set -a
. ./.env
set +a

db_user="${POSTGRES_USER:-storyverse}"
db_name="${POSTGRES_DB:-storyverse}"
BACKUPS="${STORYVERSE_BACKUP_DIR:-/home/deploy/storyverse/backups}"
RETENTION_DAYS="${STORYVERSE_BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUPS"
exec 9>"$BACKUPS/.lock"
flock -n 9 || { echo "Outro backup esta em andamento"; exit 1; }

DEST="$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)"
run_id=""

psql_db() {
  docker compose exec -T db psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

record_run_start() {
  if ! run_id=$(psql_db -qAtc "insert into public.backup_runs (status) values ('running') returning id" 2>/dev/null); then
    run_id=""
    echo "Aviso: tabela backup_runs indisponivel; seguindo sem registrar."
  fi
}

record_run_end() {
  local status="$1" error="${2:-}" size=0 path_sql error_sql
  [ -n "$run_id" ] || return 0
  if [ -f "$DEST/database.dump" ]; then
    size=$(stat -c%s "$DEST/database.dump")
  fi
  path_sql=${DEST//\'/\'\'}
  error_sql=${error//\'/\'\'}
  psql_db -c "update public.backup_runs set status = '$status', finished_at = now(), size_bytes = $size, path = '$path_sql', error = nullif('$error_sql', '') where id = $run_id" >/dev/null 2>&1 || true
}

on_error() {
  local code=$?
  echo "FALHOU: backup interrompido (codigo $code)."
  record_run_end failed "comando falhou (codigo $code)"
  exit "$code"
}
trap on_error ERR INT TERM

record_run_start
mkdir "$DEST"

# Snapshot coordenado: para uma copia consistente de migracao, pare a API antes.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DEST/database.dump"
docker run --rm --network none --read-only \
  -v storyverse_storyverse_media:/media:ro alpine:3.22 \
  tar -C /media -czf - . > "$DEST/media.tar.gz"

test -s "$DEST/database.dump"
test -s "$DEST/media.tar.gz"
(cd "$DEST" && sha256sum database.dump media.tar.gz > SHA256SUMS)

if [ -n "${STORYVERSE_BACKUP_REMOTE:-}" ]; then
  echo "Copiando para $STORYVERSE_BACKUP_REMOTE"
  rsync -az --delete "$DEST" "$STORYVERSE_BACKUP_REMOTE/"
else
  echo "Aviso: STORYVERSE_BACKUP_REMOTE nao configurado; backup apenas local."
fi

# Mantem o historico local; a copia externa deve ter retencao propria.
find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

trap - ERR INT TERM
record_run_end success
echo "Backup criado: $DEST"
