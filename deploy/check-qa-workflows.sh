#!/usr/bin/env bash
set -euo pipefail

# Workflows de QA: o código do branch (checkout de inputs.ref, npm, docker build) roda num job SEM
# a chave da VPS; o job que recebe QA_SSH_KEY (environment `qa`) só baixa o resultado e publica.
# Uso: bash deploy/check-qa-workflows.sh <workflow.yml>...
fail() { echo "FALHOU: $1" >&2; exit 1; }

for wf in "$@"; do
  grep -q 'secrets\.VPS_SSH_KEY' "$wf" && fail "$wf: usa a chave compartilhada da produção"
  grep -q 'secrets\.QA_SSH_KEY' "$wf" || fail "$wf: não usa a chave restrita de QA"
  dir="$(cd "$(dirname "$wf")" && pwd)"
  json=$(MSYS_NO_PATHCONV=1 docker run --rm -v "$(cygpath -w "$dir" 2>/dev/null || echo "$dir"):/w" \
    mikefarah/yq:4 -o=json ".jobs" "/w/$(basename "$wf")")
  printf '%s' "$json" | jq -e 'length >= 2' >/dev/null || fail "$wf: build e deploy precisam ser jobs separados"
  # Jobs com a chave de QA.
  keyed=$(printf '%s' "$json" | jq -r 'to_entries[] | select(tostring | test("secrets\\.QA_SSH_KEY")) | .key')
  [ -n "$keyed" ] || fail "$wf: nenhum job publica na VPS"
  for job in $keyed; do
    printf '%s' "$json" | jq -e --arg j "$job" '.[$j].environment == "qa"' >/dev/null \
      || fail "$wf: o job '$job' com a chave de QA não está no environment qa"
    steps=$(printf '%s' "$json" | jq -c --arg j "$job" '.[$j].steps')
    if printf '%s' "$steps" | grep -qE 'npm (ci|test|run)|docker build|inputs\.ref'; then
      fail "$wf: o job '$job' tem a chave da VPS e roda código do branch"
    fi
    if printf '%s' "$steps" | grep -q 'actions/checkout'; then
      fail "$wf: o job '$job' tem a chave da VPS e faz checkout do repositório"
    fi
    printf '%s' "$json" | jq -e --arg j "$job" '.[$j].needs != null' >/dev/null || fail "$wf: o job '$job' não depende do build"
  done
done
echo "OK"
