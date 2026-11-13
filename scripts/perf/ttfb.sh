#!/usr/bin/env bash
# Tempo até o primeiro byte: mediana de 15 pedidos por tela, depois de 2 de aquecimento.
# Uso: scripts/perf/ttfb.sh <arquivo-do-cookie> /estoque/itens /caixa ...   (BASE_URL muda o endereço)
set -euo pipefail
base="${BASE_URL:-http://localhost:3000}"
cookie="$(cat "$1")"
shift
for path in "$@"; do
  for _ in 1 2; do curl -s -o /dev/null -H "Cookie: $cookie" "$base$path"; done
  for _ in $(seq 15); do
    curl -s -o /dev/null -w "%{time_starttransfer}\n" -H "Cookie: $cookie" "$base$path"
  done | sort -n | awk -v p="$path" '{ t[NR] = $1 } END {
    printf "%-22s mediana %.1f ms  (mín. %.1f, máx. %.1f)\n", p, t[int((NR + 1) / 2)] * 1000, t[1] * 1000, t[NR] * 1000
  }'
done
