#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/storyverse
umask 077
BACKUPS="${STORYVERSE_BACKUP_DIR:-/home/deploy/storyverse/backups}"
mkdir -p "$BACKUPS"
exec 9>"$BACKUPS/.lock"
flock -n 9 || { echo "Outro backup está em andamento"; exit 1; }
DEST="$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$DEST"
# For a coordinated migration snapshot, stop the API gracefully before running this script.
# The script itself never changes service state. Run the same backup regularly and copy off-host.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DEST/database.dump"
docker run --rm --network none --read-only \
  -v storyverse_storyverse_media:/media:ro alpine:3.22 \
  tar -C /media -czf - . > "$DEST/media.tar.gz"
test -s "$DEST/database.dump"
test -s "$DEST/media.tar.gz"
(cd "$DEST" && sha256sum database.dump media.tar.gz > SHA256SUMS)
echo "Backup criado: $DEST. Copie para armazenamento externo e valide a restauração."
