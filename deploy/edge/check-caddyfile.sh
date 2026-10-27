#!/usr/bin/env bash
set -euo pipefail

# Valida o Caddyfile com o próprio Caddy e confere que os blocos de QA existem e apontam para a
# stack de QA, sem mudar os de produção. Uso: bash deploy/edge/check-caddyfile.sh [Caddyfile]
target="${1:-$(dirname "$0")/Caddyfile}"
file="$(cd "$(dirname "$target")" && pwd)/$(basename "$target")"
mount="$(cygpath -w "$file" 2>/dev/null || echo "$file")"

caddy() { MSYS_NO_PATHCONV=1 docker run --rm -v "$mount:/etc/caddy/Caddyfile:ro" caddy:2 caddy "$@"; }

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || {
  echo "FALHOU: caddy validate" >&2
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >&2 || true
  exit 1
}
json=$(caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null)

routes() {
  # Rotas do servidor HTTPS para um host exato.
  printf '%s' "$json" | jq -c --arg h "$1" \
    '[.apps.http.servers[].routes[] | select(any(.match[]?.host[]?; . == $h))]'
}
has() {
  local host="$1" needle="$2" what="$3"
  routes "$host" | grep -qF -- "$needle" || { echo "FALHOU: $what" >&2; exit 1; }
}
hasnt() {
  local host="$1" needle="$2" what="$3"
  if routes "$host" | grep -qF -- "$needle"; then echo "FALHOU: $what" >&2; exit 1; fi
}

has api.qa.storyverse.2.29.42.104.sslip.io '"dial":"storyverse-qa-api-1:8080"' "API de QA aponta para a stack de QA"
has api.qa.storyverse.2.29.42.104.sslip.io 'noindex, nofollow' "API de QA com noindex"
has qa.storyverse.2.29.42.104.sslip.io '"root":"/srv/storyverse/qa/current"' "site de QA na pasta qa/current"
has qa.storyverse.2.29.42.104.sslip.io 'noindex, nofollow' "site de QA com noindex"
has qa.storyverse.2.29.42.104.sslip.io 'https://api.qa.storyverse.2.29.42.104.sslip.io' "CSP do QA libera a API de QA"
hasnt qa.storyverse.2.29.42.104.sslip.io 'https://api.storyverse.2.29.42.104.sslip.io ' "CSP do QA não libera a API de produção"
has api.storyverse.2.29.42.104.sslip.io '"dial":"storyverse-api-1:8080"' "API de produção intacta"
has storyverse.2.29.42.104.sslip.io '"root":"/srv/storyverse/current"' "site de produção intacto"
has qa.storyverse.2.29.42.104.sslip.io '"dial":"umami-umami-1:3000"' "QA serve o Umami em /u/script.js e /u/api/send"
has storyverse.2.29.42.104.sslip.io '"dial":"umami-umami-1:3000"' "produção serve o Umami em /u/script.js e /u/api/send"
hasnt storyverse.2.29.42.104.sslip.io 'qa.storyverse' "site de produção sem nada de QA"
echo "OK"
