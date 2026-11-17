#!/usr/bin/env bash
# Testes de tela (spec 013, research R10): projetos telas-chromium e telas-webkit do Playwright,
# sempre dentro da imagem oficial, para as imagens de referência darem os mesmos pixels na máquina
# de quem desenvolve e na CI.
#
#   pnpm test:screens                      roda tudo
#   pnpm test:screens tests/screens/x.spec.ts
#   pnpm test:screens:update               regrava as imagens de referência (revise no PR)
#   SCREENS_PROJECTS=telas-webkit pnpm test:screens --grep dark    um motor, só o modo escuro
#
# Precisa do banco migrado (pnpm db:up && pnpm db:migrate && pnpm db:dev-login) e do build
# (pnpm build). Com SCREENS_IN_CONTAINER=1 (job "telas" da CI, que já roda na imagem) não usa Docker.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"
PORT="${SCREENS_PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
# SCREENS_PROJECTS escolhe os motores (a CI roda um por job); o padrão são os dois.
ARGS=()
for project in ${SCREENS_PROJECTS:-telas-chromium telas-webkit}; do ARGS+=(--project="$project"); done
ARGS+=("$@")

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
export MENU_PHOTOS="${MENU_PHOTOS:-file}" MENU_PHOTO_DIR="${MENU_PHOTO_DIR:-.menu-photos}"
export MAILER="${MAILER:-file}" MAIL_DIR="${MAIL_DIR:-.mail}"

SERVER_PID=""
cleanup() { if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT

if ! curl -fsS -o /dev/null "${BASE_URL}/entrar" 2>/dev/null; then
  [ -d .next ] || { echo "Rode pnpm build antes."; exit 1; }
  PORT="$PORT" node_modules/.bin/next start -p "$PORT" > .next/screens-server.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do curl -fsS -o /dev/null "${BASE_URL}/entrar" 2>/dev/null && break; sleep 1; done
fi

if [ "${SCREENS_IN_CONTAINER:-}" = "1" ]; then
  E2E_BASE_URL="$BASE_URL" node_modules/.bin/playwright test "${ARGS[@]}"
else
  docker run --rm --network host --ipc host -v "$PWD":/work -w /work \
    -e E2E_BASE_URL="$BASE_URL" -e CI="${CI:-}" \
    -e DATABASE_URL -e DATABASE_MIGRATION_URL -e BETTER_AUTH_SECRET -e BETTER_AUTH_URL \
    -e MENU_PHOTOS -e MENU_PHOTO_DIR -e MAILER -e MAIL_DIR \
    "$IMAGE" node_modules/.bin/playwright test "${ARGS[@]}"
fi
