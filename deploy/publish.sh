#!/usr/bin/env bash
set -euo pipefail

# Sem variáveis, publica a produção. O QA usa a mesma lógica numa pasta própria:
#   STORYVERSE_WEB_DIR=/home/deploy/storyverse/web/qa STORYVERSE_INCOMING=/home/deploy/storyverse/_incoming-qa
#   STORYVERSE_URL=https://qa.storyverse.2.29.42.104.sslip.io
BASE="${STORYVERSE_WEB_DIR:-/home/deploy/storyverse/web}"
IN="${STORYVERSE_INCOMING:-/home/deploy/storyverse/_incoming}"
URL="${STORYVERSE_URL:-https://storyverse.2.29.42.104.sslip.io}"

# Sem versão nova não se mexe em nada: a atual continua no ar.
[ -d "$IN" ] || { echo "FALHOU: $IN não existe; nada foi alterado."; exit 1; }

# Se o script morrer entre os dois mv (erro, SIGTERM do deploy cancelado), `current` não pode
# ficar ausente: devolve a versão que estava no ar.
restore_current() {
  status=$?
  trap - EXIT TERM INT
  if [ ! -d "$BASE/current" ] && [ -d "$BASE/previous" ]; then
    mv "$BASE/previous" "$BASE/current"
  fi
  exit "$status"
}
trap restore_current EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# 1. guarda a versão atual (rollback) e promove a nova
mkdir -p "$BASE"
rm -rf "$BASE/previous"
if [ -d "$BASE/current" ]; then mv "$BASE/current" "$BASE/previous"; fi
mv "$IN" "$BASE/current"
# A pasta de entrada volta a existir vazia para o próximo rsync (o rrsync da chave de QA
# exige que ela exista antes de receber os arquivos).
mkdir -p "$IN"

# 2. confere que o site responde
code=$(curl -fsS -o /dev/null -w '%{http_code}' \
  --retry 5 --retry-delay 2 --retry-connrefused \
  "$URL" || echo 000)
if [ "$code" != "200" ]; then
  echo "FALHOU: $URL respondeu $code. Revertendo."
  rm -rf "$BASE/current"
  if [ -d "$BASE/previous" ]; then mv "$BASE/previous" "$BASE/current"; fi
  exit 1
fi
echo "OK: $URL respondeu 200"
