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
node scripts/perf/latency-proxy.mjs 5440 5432 2.5 &        # banco a 5 ms (ida e volta)
DATABASE_URL=postgres://app_login:app_login@localhost:5440/restaurante pnpm start &
node scripts/perf/session-cookie.mjs > /tmp/cookie.txt     # cria um restaurante e guarda o cookie
scripts/perf/ttfb.sh /tmp/cookie.txt /estoque/itens /caixa /pedidos/cozinha /estoque/repor /equipe
```

## Testes

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
pnpm test:e2e   # inclui o axe nas telas
```
