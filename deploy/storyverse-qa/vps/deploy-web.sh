#!/usr/bin/env bash
set -euo pipefail

# Publica o site de QA. Chamado pela chave restrita (gate.sh), sem argumentos.
PUB=/home/deploy/storyverse/deploy/publish.sh
grep -q STORYVERSE_WEB_DIR "$PUB" \
  || { echo "publish.sh da VPS nao suporta QA; atualize-o antes (docs/QA.md)." >&2; exit 1; }
IN=/home/deploy/storyverse/_incoming-qa
[ -f "$IN/index.html" ] \
  || { echo "build de QA ausente (sem index.html em $IN); nada foi alterado." >&2; exit 1; }

exec env \
  STORYVERSE_WEB_DIR=/home/deploy/storyverse/web/qa \
  STORYVERSE_INCOMING=/home/deploy/storyverse/_incoming-qa \
  STORYVERSE_URL=https://qa.storyverse.2.29.42.104.sslip.io \
  bash "$PUB"
