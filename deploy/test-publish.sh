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
[ -d "$T/_incoming-qa" ] && [ -z "$(ls -A "$T/_incoming-qa")" ] || fail "a pasta de entrada não voltou vazia para o próximo rsync"
[ -f "$T/web/current/prod.txt" ] || fail "a produção foi tocada"
[ ! -e "$T/web/previous" ] || fail "a produção ganhou um previous"

if STORYVERSE_WEB_DIR="$T/web/qa" STORYVERSE_INCOMING="$T/_incoming-qa2" STORYVERSE_URL="http://127.0.0.1:1" \
  bash "$here/publish.sh" >/dev/null 2>&1; then
  fail "site sem resposta deveria falhar"
fi
[ -f "$T/web/qa/current/qa-new.txt" ] || fail "não voltou a versão anterior"
[ -d "$T/_incoming-qa2" ] && [ -z "$(ls -A "$T/_incoming-qa2")" ] || fail "a pasta de entrada não voltou vazia depois do rollback"
[ -f "$T/web/current/prod.txt" ] || fail "a produção foi tocada no rollback"

# Sem a pasta de entrada (ex.: publish.sh antigo ou rsync que não chegou), nada pode ser mexido.
if STORYVERSE_WEB_DIR="$T/web" STORYVERSE_INCOMING="$T/nao-existe" STORYVERSE_URL="http://127.0.0.1:$PORT" \
  bash "$here/publish.sh" >/dev/null 2>&1; then
  fail "publicar sem a pasta de entrada deveria falhar"
fi
[ -f "$T/web/current/prod.txt" ] || fail "a versão atual saiu do ar sem haver versão nova"
[ ! -e "$T/web/previous" ] || fail "a versão atual foi movida sem haver versão nova"

# Interrupção entre os dois mv (ex.: deploy cancelado): `current` não pode ficar ausente.
mkdir -p "$T/web/qa2/current" "$T/_incoming-qa3" "$T/bin"
touch "$T/web/qa2/current/qa-old.txt" "$T/_incoming-qa3/qa-new.txt"
cat > "$T/bin/mv" <<'EOF'
#!/usr/bin/env bash
if [ -n "${FAIL_MV_SRC:-}" ] && [ "$1" = "$FAIL_MV_SRC" ] && [ ! -e "${FAIL_MV_ONCE:-/nao-existe}" ]; then
  : > "$FAIL_MV_ONCE"
  exit 1
fi
exec /usr/bin/mv "$@"
EOF
chmod +x "$T/bin/mv"
if STORYVERSE_WEB_DIR="$T/web/qa2" STORYVERSE_INCOMING="$T/_incoming-qa3" STORYVERSE_URL="http://127.0.0.1:$PORT" \
  FAIL_MV_SRC="$T/_incoming-qa3" FAIL_MV_ONCE="$T/mv-failed" PATH="$T/bin:$PATH" \
  bash "$here/publish.sh" >/dev/null 2>&1; then
  fail "mv falhando deveria falhar"
fi
[ -f "$T/web/qa2/current/qa-old.txt" ] || fail "current ficou ausente na interrupção entre os mv"
[ ! -e "$T/web/qa2/previous" ] || fail "previous ficou para trás na interrupção entre os mv"
echo "OK"
