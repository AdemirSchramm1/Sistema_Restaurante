# Como conferir a 012

## Visual

1. `pnpm db:up && pnpm db:migrate && pnpm db:dev-login && pnpm dev`.
2. Criar um restaurante em `/criar-conta`: a tela de entrada mostra a marca ao lado do formulário.
3. Na tela de itens: menu lateral escuro (lousa) com Estoque, Operação e Configuração; "Itens"
   destacado; botão "Novo item" em páprica; fundo creme; título em serifa.
4. Diminuir a janela abaixo de 1024 px: o menu vira a barra do topo com o botão "Menu".
5. Trocar o sistema para o modo escuro: as cores mudam juntas e continuam legíveis.
6. Imprimir a conta de uma mesa: sem menu e sem fundo colorido.

## Desempenho

Método completo em [docs/sistema/04-desempenho.md](../../docs/sistema/04-desempenho.md).

```bash
pnpm build
docker exec sistema_restaurante-db-1 psql -U postgres \
  -c "alter system set log_statement = 'all'" -c "select pg_reload_conf()"
pnpm start &
node scripts/perf/session-cookie.mjs > /tmp/cookie.txt     # cria um restaurante e guarda o cookie
node scripts/perf/statements.mjs /tmp/cookie.txt /estoque/itens /estoque/repor /pedidos/cozinha /equipe /caixa

# Banco a 5 ms (ida e volta): reinicie o app passando pelo proxy
node scripts/perf/latency-proxy.mjs 5440 5432 2.5 &
DATABASE_URL=postgres://app_login:app_login@localhost:5440/restaurante pnpm start &
scripts/perf/ttfb.sh /tmp/cookie.txt /estoque/itens /caixa /pedidos/cozinha /estoque/repor /equipe
```

Esperado: as consultas e os tempos de [research.md](research.md#r12-depois) (12 a 18 consultas;
~55 ms com o banco a 5 ms).

## Testes

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
pnpm test:e2e   # inclui o axe nas telas
```
