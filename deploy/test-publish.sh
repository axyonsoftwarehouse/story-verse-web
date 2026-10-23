#!/usr/bin/env bash
set -euo pipefail

# Testa publish.sh numa pasta temporária: publica no QA sem tocar na produção e volta a versão
# anterior quando o site não responde. Uso: bash deploy/test-publish.sh
here="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"
trap 'kill "$server" 2>/dev/null || true; rm -rf "$T"' EXIT

mkdir -p "$T/web/current" "$T/web/qa/current" "$T/_incoming-qa" "$T/_incoming-qa2"
touch "$T/web/current/prod.txt" "$T/web/qa/current/qa-old.txt" "$T/_incoming-qa/qa-new.txt" "$T/_incoming-qa2/qa-broken.txt"

PORT=18765
node -e "require('http').createServer((q,s)=>{s.writeHead(200);s.end('ok')}).listen($PORT)" &
server=$!
sleep 1

fail() { echo "FALHOU: $1" >&2; exit 1; }

STORYVERSE_WEB_DIR="$T/web/qa" STORYVERSE_INCOMING="$T/_incoming-qa" STORYVERSE_URL="http://127.0.0.1:$PORT" \
  bash "$here/publish.sh" >/dev/null
[ -f "$T/web/qa/current/qa-new.txt" ] || fail "QA não recebeu a versão nova"
[ -f "$T/web/qa/previous/qa-old.txt" ] || fail "QA não guardou a versão anterior"
[ -f "$T/web/current/prod.txt" ] || fail "a produção foi tocada"
[ ! -e "$T/web/previous" ] || fail "a produção ganhou um previous"

if STORYVERSE_WEB_DIR="$T/web/qa" STORYVERSE_INCOMING="$T/_incoming-qa2" STORYVERSE_URL="http://127.0.0.1:1" \
  bash "$here/publish.sh" >/dev/null 2>&1; then
  fail "site sem resposta deveria falhar"
fi
[ -f "$T/web/qa/current/qa-new.txt" ] || fail "não voltou a versão anterior"
[ -f "$T/web/current/prod.txt" ] || fail "a produção foi tocada no rollback"

# Sem a pasta de entrada (ex.: publish.sh antigo ou rsync que não chegou), nada pode ser mexido.
if STORYVERSE_WEB_DIR="$T/web" STORYVERSE_INCOMING="$T/nao-existe" STORYVERSE_URL="http://127.0.0.1:$PORT" \
  bash "$here/publish.sh" >/dev/null 2>&1; then
  fail "publicar sem a pasta de entrada deveria falhar"
fi
[ -f "$T/web/current/prod.txt" ] || fail "a versão atual saiu do ar sem haver versão nova"
[ ! -e "$T/web/previous" ] || fail "a versão atual foi movida sem haver versão nova"
echo "OK"
