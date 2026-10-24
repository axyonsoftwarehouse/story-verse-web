#!/usr/bin/env bash
set -euo pipefail

# Volta o QA ao zero: apaga banco e arquivos do QA, sobe de novo e recria as contas de teste.
# Só mexe no projeto storyverse-qa. Rode em /home/deploy/storyverse-qa: bash reset-qa.sh
. "$(dirname "$0")/qa-guard.sh"
qa_guard

API_URL="${QA_API_URL:-https://api.qa.storyverse.2.29.42.104.sslip.io}"

qa_compose down -v
qa_compose up -d qa-db
# Cria o volume de arquivos pelo Compose (com os rótulos do projeto) antes de enchê-lo.
# Volume de arquivos novo: pertence ao uid do app (10001).
qa_compose up --no-start qa-api
docker run --rm -v storyverse-qa_media:/m alpine chown -R 10001:10001 /m
qa_compose up -d qa-api

echo "Esperando a API de QA..."
tries="${QA_WAIT_TRIES:-40}"
until curl -fsS "$API_URL/api/v1/health/ready" >/dev/null 2>&1; do
  tries=$((tries - 1))
  [ "$tries" -gt 0 ] || qa_die "a API de QA não respondeu em $API_URL"
  sleep 3
done

bash "$(dirname "$0")/seed-qa.sh"
