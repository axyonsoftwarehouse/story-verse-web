#!/usr/bin/env bash
set -euo pipefail

# Os scripts de QA (seed e reset) recusam rodar fora da stack de QA — sem chamar docker, curl nem
# psql. Um docker/curl falso no PATH grava qualquer chamada; o registro tem de ficar vazio.
# Uso: bash deploy/storyverse-qa/test-guards.sh
here="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

mkdir -p "$T/bin"
for cmd in docker curl psql; do
  printf '#!/usr/bin/env bash\necho "%s $*" >> "%s/calls.log"\n' "$cmd" "$T" > "$T/bin/$cmd"
  chmod +x "$T/bin/$cmd"
done
touch "$T/calls.log"

expect_refusal() {
  local dir="$1" script="$2" why="$3"
  if (cd "$dir" && PATH="$T/bin:$PATH" bash "$here/$script" >/dev/null 2>&1); then
    echo "FALHOU: $script rodou $why" >&2
    exit 1
  fi
  if [ -s "$T/calls.log" ]; then
    echo "FALHOU: $script chamou comandos $why:" >&2
    cat "$T/calls.log" >&2
    exit 1
  fi
}

# Pasta da produção, com o .env da produção.
mkdir -p "$T/storyverse"
printf 'POSTGRES_DB=storyverse\nPOSTGRES_USER=storyverse\n' > "$T/storyverse/.env"
# Pasta com o nome do QA, mas com o .env da produção.
mkdir -p "$T/storyverse-qa"
printf 'POSTGRES_DB=storyverse\nPOSTGRES_USER=storyverse\n' > "$T/storyverse-qa/.env"
# Pasta do QA sem .env.
mkdir -p "$T/vazio/storyverse-qa"

for script in seed-qa.sh reset-qa.sh; do
  expect_refusal "$T/storyverse" "$script" "na pasta da produção"
  expect_refusal "$T/storyverse-qa" "$script" "com o .env da produção"
  expect_refusal "$T/vazio/storyverse-qa" "$script" "sem .env"
  if (cd "$T/storyverse-qa" && COMPOSE_PROJECT_NAME=storyverse PATH="$T/bin:$PATH" bash "$here/$script" >/dev/null 2>&1) || [ -s "$T/calls.log" ]; then
    echo "FALHOU: $script aceitou COMPOSE_PROJECT_NAME de produção" >&2
    exit 1
  fi
done
# Controle: na pasta de QA de verdade, o script passa da trava e chama docker/curl.
mkdir -p "$T/ok/storyverse-qa"
printf 'POSTGRES_DB=storyverse_qa\nPOSTGRES_USER=storyverse_qa\nQA_TEST_PASSWORD=x\n' > "$T/ok/storyverse-qa/.env"
for script in seed-qa.sh reset-qa.sh; do
  : > "$T/calls.log"
  (cd "$T/ok/storyverse-qa" && PATH="$T/bin:$PATH" QA_WAIT_TRIES=1 bash "$here/$script" >/dev/null 2>&1) || true
  [ -s "$T/calls.log" ] || { echo "FALHOU: $script não passou da trava na pasta de QA" >&2; exit 1; }
done
echo "OK"
