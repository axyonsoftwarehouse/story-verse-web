#!/usr/bin/env bash
# Trava dos scripts de QA: só seguem dentro da stack de QA, nunca na produção.
# Uso (no início do script): . "$(dirname "$0")/qa-guard.sh"; qa_guard

qa_die() {
  echo "PARADO: $1" >&2
  exit 1
}

qa_guard() {
  [ "$(basename "$PWD")" = "storyverse-qa" ] || qa_die "rode dentro de /home/deploy/storyverse-qa (pasta atual: $PWD)"
  [ -f .env ] || qa_die "sem .env nesta pasta"
  grep -qx 'POSTGRES_DB=storyverse_qa' .env || qa_die "o .env daqui não é o do QA (POSTGRES_DB precisa ser storyverse_qa)"
  [ "${COMPOSE_PROJECT_NAME:-storyverse-qa}" = "storyverse-qa" ] || qa_die "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME não é o do QA"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  export COMPOSE_PROJECT_NAME=storyverse-qa
}

qa_compose() {
  docker compose --project-name storyverse-qa "$@"
}
