#!/usr/bin/env bash
set -euo pipefail

# Chave do deploy de QA (forced command): so aceita rsync para a pasta de entrada do QA
# e os dois scripts de deploy. Nada aqui alcanca a producao.
cmd="${SSH_ORIGINAL_COMMAND:-}"

case "$cmd" in
  rsync\ *)
    exec /usr/bin/rrsync -wo /home/deploy/storyverse/_incoming-qa
    ;;
  "bash /home/deploy/qa-deploy/deploy-web.sh")
    exec bash /home/deploy/qa-deploy/deploy-web.sh
    ;;
  bash\ /home/deploy/qa-deploy/deploy-api.sh\ *)
    set -- ${cmd#bash /home/deploy/qa-deploy/deploy-api.sh }
    [ "$#" -eq 2 ] || { echo "deploy-api: use <imagem> <release>" >&2; exit 2; }
    [[ "$1" =~ ^ghcr\.io/axyonsoftwarehouse/story-verse-api:qa-[0-9a-f]{40}$ ]] \
      || { echo "imagem de QA invalida" >&2; exit 2; }
    [[ "$2" =~ ^[0-9a-f]{40}$ ]] || { echo "release invalida" >&2; exit 2; }
    exec bash /home/deploy/qa-deploy/deploy-api.sh "$1" "$2"
    ;;
  *)
    echo "comando nao permitido para a chave de QA" >&2
    exit 2
    ;;
esac
