#!/usr/bin/env bash
set -euo pipefail

# Confere a configuração da stack de QA sem subir nada: isolamento de rede, limites de memória,
# domínios de QA e ausência de e-mail/IA paga. Uso: bash deploy/storyverse-qa/check-config.sh

cd "$(dirname "$0")"
# Senhas fictícias só para montar a configuração (o .env.example as deixa vazias de propósito).
json=$(POSTGRES_PASSWORD=check API_DB_PASSWORD=check \
  docker compose --project-name storyverse-qa --env-file .env.example config --format json)

check() {
  if ! printf '%s' "$json" | jq -e "$1" >/dev/null; then
    echo "FALHOU: $2" >&2
    exit 1
  fi
}

check '(.services["qa-api"].mem_limit|tostring) == "536870912" and (.services["qa-db"].mem_limit|tostring) == "268435456"' \
  "limites de memória (api 512m, db 256m)"
check '.services["qa-db"].networks | keys == ["qa-private"]' "banco só na rede privada de QA"
check '.services["qa-api"].networks | keys | sort == ["edge","qa-private"]' "API na rede privada e na do Caddy"
check '.networks.edge.name == "storyverse_default" and .networks.edge.external == true' "rede do Caddy é a storyverse_default"
check '.services["qa-api"].environment.APP_CORS_ALLOWED_ORIGINS == "https://qa.storyverse.2.29.42.104.sslip.io"' "CORS só do site de QA"
check '.services["qa-api"].environment.APP_PUBLIC_API_URL == "https://api.qa.storyverse.2.29.42.104.sslip.io"' "URL pública da API de QA"
check '.services["qa-api"].environment.APP_AUTH_REQUIRE_EMAIL_CONFIRMATION == "false"' "QA sem confirmação de e-mail"
check '.services["qa-api"].environment.SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS == "*:missing,*:future"' "migração de branch descartado não trava"
check '[.services["qa-api"].environment | to_entries[] | select(.key|test("GROQ|GEMINI|OPENROUTER|SMTP_HOST")) | .value] | all(. == "")' \
  "QA sem chaves de IA e sem SMTP"
check '.services["qa-api"].container_name == "storyverse-qa-api-1"' "nome do contêiner que o Caddy usa"
check '[.services[].ports // [] | length] | add == 0' "nenhuma porta publicada no host"
check '(.services | keys | sort) == ["qa-api","qa-db"]' "serviços com nomes únicos (sem db/api, que existem na rede da produção)"
check '.services["qa-api"].environment.SPRING_DATASOURCE_URL | startswith("jdbc:postgresql://qa-db:5432/")' "API conecta no banco de QA pelo nome único"
check '.services["qa-api"].environment.SPRING_FLYWAY_URL | startswith("jdbc:postgresql://qa-db:5432/")' "Flyway conecta no banco de QA pelo nome único"
echo "OK"
