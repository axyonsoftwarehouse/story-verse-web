#!/usr/bin/env bash
# Marco 3 — exportação somente leitura do Supabase (banco + Storage).
#
# Uso (na máquina que fará a migração, com pg_dump/psql/jq/curl):
#   SUPABASE_URL='https://<ref>.supabase.co' \
#   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres' \
#   SUPABASE_SECRET_KEY='sb_secret_...' \
#   bash deploy/migrate-supabase.sh [destino]
#
# Gera em <destino> (padrão ./migration-<timestamp>):
#   public.dump        pg_dump --schema=public (estrutura + dados)
#   auth_users.csv     contas, com o hash bcrypt para preservar a senha
#   storage/<bucket>/… arquivos dos buckets profile-media, user-books, community-books
#   SHA256SUMS         checksums
#   MANIFEST.txt       resumo, sem segredos
#
# Este script NÃO altera nada na origem e NÃO restaura nada no destino.
# A restauração é feita em ambiente isolado (ver docs/MARCO3_CORTE.md).
set -euo pipefail

: "${SUPABASE_URL:?Defina SUPABASE_URL}"
: "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL (com a senha real)}"
: "${SUPABASE_SECRET_KEY:?Defina SUPABASE_SECRET_KEY}"

for bin in pg_dump psql curl jq sha256sum du; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Falta o comando: $bin" >&2; exit 1; }
done
SUPABASE_URL=${SUPABASE_URL%/}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=${1:-"$(pwd)/migration-$STAMP"}
umask 077
mkdir -p "$DEST/storage"

echo "==> 1/3 pg_dump do schema public (origem: $SUPABASE_URL)"
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  --format=custom --schema=public \
  --file="$DEST/public.dump"

echo "==> 2/3 contas (auth.users)"
# encrypted_password é o hash bcrypt: o Spring Security aceita e a senha atual continua valendo.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c \
  "\copy (select id,email,encrypted_password,email_confirmed_at,raw_user_meta_data,last_sign_in_at,created_at,updated_at from auth.users order by created_at) to '$DEST/auth_users.csv' with (format csv, header true)"

echo "==> 3/3 arquivos (Storage)"
auth=(-H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY")
count=0

# Lista uma pasta e desce recursivamente. Pastas vêm com id nulo.
export_prefix() {
  local bucket=$1 prefix=$2 out=$3
  local offset=0 json n
  while :; do
    json=$(curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/list/$bucket" \
      "${auth[@]}" -H "Content-Type: application/json" \
      --data "$(jq -nc --arg p "$prefix" --argjson o "$offset" '{prefix:$p,limit:1000,offset:$o}')")
    n=$(jq 'length' <<<"$json")
    if [ "$n" -eq 0 ]; then break; fi
    while IFS=$'\t' read -r name id; do
      if [ -z "$name" ]; then continue; fi
      if [ -z "$id" ]; then
        export_prefix "$bucket" "$prefix$name/" "$out"
      else
        local rel="$prefix$name" enc
        enc=$(jq -rn --arg v "$rel" '$v|split("/")|map(@uri)|join("/")')
        mkdir -p "$out/$(dirname "$rel")"
        curl -fsS "$SUPABASE_URL/storage/v1/object/authenticated/$bucket/$enc" \
          "${auth[@]}" -o "$out/$rel"
        count=$((count + 1))
      fi
    done < <(jq -r '.[] | [.name, (.id // "")] | @tsv' <<<"$json")
    if [ "$n" -lt 1000 ]; then break; fi
    offset=$((offset + 1000))
  done
}

for bucket in profile-media user-books community-books; do
  echo "    - $bucket"
  mkdir -p "$DEST/storage/$bucket"
  export_prefix "$bucket" "" "$DEST/storage/$bucket"
done

echo "==> checksums e manifesto"
( cd "$DEST" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )

{
  echo "Origem: $SUPABASE_URL"
  echo "Gerado: $STAMP"
  echo "Arquivos de storage: $count"
  echo "Tamanho public.dump: $(du -h "$DEST/public.dump" | cut -f1)"
  echo "Tamanho auth_users.csv: $(du -h "$DEST/auth_users.csv" | cut -f1)"
  echo "Tamanho storage: $(du -sh "$DEST/storage" | cut -f1)"
  echo
  echo "Confira com: (cd '$DEST' && sha256sum -c SHA256SUMS)"
} > "$DEST/MANIFEST.txt"

echo
echo "Pronto: $DEST"
echo "Copie para armazenamento externo e valide a restauração isolada antes do corte."
echo "Próximos passos: docs/MARCO3_CORTE.md"
