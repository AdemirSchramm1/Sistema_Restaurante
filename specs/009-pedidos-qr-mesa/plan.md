# Plano técnico: 009 — Pedidos pelo QR code da mesa

**Branch**: `claude/project-thread-qmc5hs` | **Data**: 2026-11-08 | **Spec**: [spec.md](spec.md)

## Resumo

Primeira parte do sistema que **não pede login**. O QR code de cada mesa leva a `/m/{token}`; essa
rota acha a mesa pelo token (função `SECURITY DEFINER`, como o convite da 001), abre um **acesso ao
cardápio** de 20 minutos guardado no banco e num cookie, e manda para `/cardapio`. O cliente
monta o pedido no navegador e envia por Server Action, que confere acesso, mesa, chave de pedidos,
disponibilidade e preço antes de gravar. A cozinha e o garçom usam telas logadas que se atualizam
sozinhas a cada 5 segundos. Regras novas ficam no domínio puro `src/domain/ordering/`.

Uma dependência nova: `qrcode` (gera o SVG do QR code no servidor).

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19 |
| Dependências novas | `qrcode` + `@types/qrcode` ([research R5](research.md#r5-gerar-o-qr-code)) |
| Banco | PostgreSQL 17 (Neon); migração `0009_ordering` |
| Testes | Vitest (unidade e integração com Testcontainers), Playwright (com celular emulado) |
| Plataforma | Vercel; cardápio pensado para celular (largura 360 px) |
| Desempenho | Cardápio < 3 s em 4G com 200 produtos (SC-005); pedido na cozinha < 10 s (SC-003) |
| Restrições | Nada de login no cardápio; nenhum dado de outro restaurante; dinheiro em decimal |
| Escala | Dezenas de mesas por restaurante; poucas centenas de pedidos por dia |

Nenhum ponto em aberto: a spec decidiu o tempo (20 minutos desde a leitura, sem renovação).

## Constituição

| Princípio | Como a 009 cumpre |
|---|---|
| I. Testes primeiro | `test(009)` antes de cada `feat(009)`: domínio, integração (incluindo isolamento e rota pública), componentes e e2e com celular emulado |
| II. Domínio puro | `src/domain/ordering/`: prazo do acesso, situações do pedido, validação das linhas, conferência de preço e disponibilidade, número do dia. Relógio e IDs por parâmetro |
| III. Livro imutável | Não mexe no estoque (é a 005). Linhas do pedido e eventos de situação são só inserção (trigger `app_reject_change`); correção é cancelar |
| IV. Precisão | Preço e total em `numeric(12,2)` e `decimal.js`; quantidade inteira (1 a 20) |
| V. Rastreabilidade | Toda escrita da equipe na auditoria; cada mudança de situação em `order_status_events` com quem e quando; pedido do cliente guarda mesa, acesso e origem (IP, navegador). RLS em todas as tabelas novas; a rota pública acha o restaurante só pelo token |
| VI. Docs vivas | Novo `docs/produto/pedidos/`, `docs/sistema/pedidos/`, ADR 0005, glossário, permissões (09) e roadmap no mesmo PR da implementação; glossário e ADR já neste PR |
| VII. Simplicidade | Atualização por consulta a cada 5 s, sem WebSocket, fila ou cache. Carrinho só no navegador. Uma dependência pequena |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1 Link do QR code**: `/m/{token}` com 32 bytes aleatórios, guardado em texto (está impresso
  na mesa e precisa ser reimpresso). Trocar o QR code troca o token. Busca por
  `app_table_by_qr_token` (`SECURITY DEFINER`), depois tudo roda em `withTenantTx` com o
  restaurante da mesa. O token do acesso de 20 minutos, esse sim secreto, fica só como hash.
- **R2 Acesso ao cardápio**: linha em `menu_accesses` com `expires_at = opened_at + 20 min`; o
  token do acesso vai num cookie `httpOnly` (`path=/cardapio`, 20 min). Ler o QR code de novo no
  mesmo celular encerra o acesso anterior. Envio aceito até 15 s depois do prazo (rede lenta), nada
  além.
- **R3 Sem pedido em dobro**: o navegador gera um `clientRequestId` por pedido; índice único
  `(menu_access_id, client_request_id)` devolve o mesmo pedido no reenvio.
- **R4 Atualização das telas**: componente cliente que chama `router.refresh()` a cada 5 s
  (cozinha e garçom) e a cada 10 s ("Meus pedidos").
- **R6 Número do pedido**: contador por restaurante e dia local (`order_day_counters`), com
  `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
- **R7 Esgotado**: `recipes.sold_out_on date`; disponível se for diferente da data de hoje no fuso
  do restaurante. Volta sozinho no dia seguinte.
- **R8 Papel Garçom**: `WAITER` no enum `role`; o menu passa a ser filtrado por permissão.

## Modelo de dados (migração `0009_ordering`)

Resumo; detalhe em [data-model.md](data-model.md).

```text
dining_tables        name, name_normalized, active, qr_token (único), qr_rotated_at   + editable
menu_accesses        table_id, token_hash (único), opened_at, expires_at, ended_at, ip, user_agent
orders               table_id, menu_access_id, business_day, number, status, cancel_reason,
                     total, client_request_id, version          (único: restaurante+dia+número)
order_lines          order_id, recipe_id, recipe_version_id, quantity int, unit_price, note   (só inserção)
order_status_events  order_id, from_status, to_status, reason, user_id, at                    (só inserção)
order_day_counters   restaurant_id + business_day (pk), last_number
recipes              + sold_out_on date null
restaurants          + accepting_qr_orders boolean not null default true
role (enum)          + 'WAITER'
```

## Casos de uso

Contrato completo em [contracts/use-cases.md](contracts/use-cases.md) e rotas públicas em
[contracts/public-routes.md](contracts/public-routes.md).

- Equipe: `createTable`, `createTablesInRange`, `renameTable`, `setTableActive`, `rotateTableQr`,
  `listTables`, `tableQrCodes`, `setAcceptingQrOrders`, `listKitchenOrders`, `advanceOrderStatus`,
  `cancelOrder`, `listReadyOrders`, `markDelivered`, `listOrders`, `setProductSoldOut`.
- Público (sem usuário, restaurante vindo do token): `openMenuAccess`, `getMenu`, `submitOrder`,
  `listAccessOrders`.

## Estrutura

```text
src/domain/ordering/          menu-access.ts, order.ts (situações e linhas), order-pricing.ts,
                              menu.ts (o que aparece), table-name.ts, business-day.ts, *.test.ts
src/domain/access/            permissions.ts (+ WAITER e ações de pedido)
src/application/ordering/     tables.ts, menu-access.ts, submit-order.ts, kitchen.ts, orders.ts,
                              order-input.ts, ports.ts
src/infra/db/                 schema/ordering.ts, migrations/0009_ordering.sql,
                              repositories/ordering-repository.ts, public-ordering.ts
src/infra/qr.ts               SVG do QR code (qrcode)
src/actions/                  tables.ts, kitchen.ts, menu.ts (pública)
src/components/ordering/      menu-list.tsx, cart.tsx, access-timer.tsx, my-orders.tsx,
                              kitchen-board.tsx, ready-list.tsx, table-qr-card.tsx, auto-refresh.tsx
app/m/[token]/route.ts                      lê o QR code, abre o acesso, redireciona
app/(cardapio)/cardapio/page.tsx            cardápio do cliente (layout próprio, sem menu da equipe)
app/(app)/pedidos/mesas/page.tsx, mesas/imprimir/page.tsx
app/(app)/pedidos/cozinha/page.tsx, garcom/page.tsx, page.tsx (consulta)
tests/integration/ordering/   mesas, acesso, envio, cozinha, isolamento, rota pública
tests/e2e/                    ordering.spec.ts (celular + cozinha + garçom), accessibility (cardápio)
```

## Ordem de entrega (vira `tasks.md`)

1. Domínio: acesso (prazo, tolerância), situações, linhas, preço e disponibilidade, nome da mesa,
   dia do restaurante, permissões com Garçom.
2. Migração, repositórios, isolamento (incluindo a função pública).
3. US1 Mesas e QR codes → US2/US3 Cardápio e acesso → US4 Cozinha e garçom → US5 Esgotado →
   US6 Chave e consulta.
4. Docs (`docs/produto/pedidos/`, `docs/sistema/pedidos/`, 09-permissões, roadmap) e e2e.

## Riscos

- **Prévia de link** (WhatsApp, leitor de QR que abre a página antes) cria acessos que ninguém usa:
  eles só fecham em 20 minutos e não pedem nada. Aceito; medir antes de limitar.
- **Atualização por consulta** em muitos restaurantes ao mesmo tempo: uma consulta leve a cada 5 s
  por tela aberta. Rever (SSE ou serviço de tempo real) só se medir problema.
- **Relógio do celular errado**: o tempo que falta vem do servidor (`expiresAt` e `now` na
  resposta), não do relógio do aparelho.

## Complexity Tracking

Nenhuma violação.
