#!/usr/bin/env bash
set -euo pipefail

# Deploy da API de QA. Chamado pela chave restrita (gate.sh): deploy-api.sh <imagem> <release>.
image="$1"
release="$2"
cd /home/deploy/storyverse-qa

# O SHA fica no .env de QA: um restart manual nao volta para outra imagem.
touch .env
grep -q '^API_IMAGE=' .env || echo 'API_IMAGE=' >> .env
grep -q '^SENTRY_RELEASE=' .env || echo 'SENTRY_RELEASE=' >> .env
sed -i "s|^API_IMAGE=.*|API_IMAGE=$image|" .env
sed -i "s|^SENTRY_RELEASE=.*|SENTRY_RELEASE=$release|" .env

docker compose --project-name storyverse-qa config --quiet
docker compose --project-name storyverse-qa pull qa-api
docker compose --project-name storyverse-qa up -d qa-api
# O job so pode ficar verde se o container estiver rodando exatamente a imagem deste build.
test "$(docker inspect --format '{{.Config.Image}}' storyverse-qa-api-1)" = "$image"
docker compose --project-name storyverse-qa ps qa-api
curl -fsS --retry 20 --retry-delay 3 --retry-all-errors \
  https://api.qa.storyverse.2.29.42.104.sslip.io/api/v1/health/ready
