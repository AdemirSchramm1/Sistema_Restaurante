# Tarefas — 009 Pedidos pelo QR code da mesa

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

Implementada **junto com a [010](../010-adicionais-retiradas/tasks.md)**: as escolhas da linha do
pedido (adicionais e retiradas) vêm da 010 e não há observação livre. Os pontos de encontro estão
marcados com ↔ 010.

Regras: cada tarefa de código vem depois do teste que a exige e esse teste é visto falhar na
asserção antes (constituição, princípio I; [01-tdd](../../docs/sistema/01-tdd.md)). `[P]` = pode
andar em paralelo (arquivos diferentes, sem depender de tarefa aberta). `[USn]` = história da spec.
Commits `test(009): …` antes de `feat(009): …`.

## Fase 1: Preparação

- [ ] T001 Adicionar `qrcode` e `@types/qrcode` em `package.json` (research R5); `pnpm install`
- [ ] T002 [P] Criar as pastas `src/domain/ordering/`, `src/application/ordering/`, `src/components/ordering/`, `tests/integration/ordering/`

## Fase 2: Base (bloqueia todas as histórias)

Domínio puro, permissões, banco e acesso público.

- [ ] T003 [P] [teste] `src/domain/ordering/menu-access.test.ts`: prazo `opened_at + 20 min` (`MENU_ACCESS_MINUTES = 20`), aberto/fechado nos limites (19:59, 20:00, 20:01), envio aceito até `expires_at + 15 s` (`SUBMIT_GRACE_SECONDS`) e recusado em 15,001 s, acesso encerrado (`ended_at`) sempre fechado, tempo restante a partir de `serverNow`
- [ ] T004 [P] `src/domain/ordering/menu-access.ts`
- [ ] T005 [P] [teste] `src/domain/ordering/order.test.ts`: transições `RECEIVED → PREPARING → READY → DELIVERED`, cancelar de qualquer não final com motivo da lista (`CUSTOMER_GAVE_UP`, `OUT_OF_PRODUCT`, `IMPROPER_ORDER`, `OTHER`), `OTHER` exige texto "até 140", finais não mudam (`INVALID_ORDER_TRANSITION`), pular etapa recusado, "atrasado" com mais de 20 min em `RECEIVED`/`PREPARING`
- [ ] T006 [P] `src/domain/ordering/order.ts`
- [ ] T007 [P] [teste] `src/domain/ordering/order-lines.test.ts`: quantidade "inteiro de 1 a 20" (`INVALID_QUANTITY`), "1 a 30" linhas (`EMPTY_ORDER`), "até 10 pedidos por acesso" (`ACCESS_ORDER_LIMIT`), total = Σ preço × quantidade em decimal (2 × 28,00 + 9,00 = 65,00)
- [ ] T008 [P] `src/domain/ordering/order-lines.ts`
- [ ] T009 [P] [teste] `src/domain/ordering/table-name.test.ts`: "1 a 30 caracteres", espaços nas pontas, normalização sem acento e minúsculas (`normalizeDescription`), faixa "1 a 999" com "até 200 de uma vez" (`INVALID_RANGE`), ordem natural ("2" antes de "10")
- [ ] T010 [P] `src/domain/ordering/table-name.ts`
- [ ] T011 [P] [teste] `src/domain/ordering/business-day.test.ts`: data local em `America/Sao_Paulo` às 23:30 e 00:10 (UTC do dia seguinte)
- [ ] T012 [P] `src/domain/ordering/business-day.ts`
- [ ] T013 [P] [teste] `src/domain/ordering/menu.test.ts`: aparece só produto `DISH`, ativo, com `sale_price` e `sold_out_on` diferente de hoje; ordem alfabética sem acento; esgotado ontem aparece hoje
- [ ] T014 [P] `src/domain/ordering/menu.ts`
- [ ] T015 [P] [teste] `src/domain/access/permissions.test.ts`: `WAITER` ("Garçom") e as ações `table.manage`, `ordering.toggle`, `order.kitchen`, `order.cancel`, `order.deliver`, `order.read`, `product.sold_out` com a matriz de [contracts/use-cases.md](contracts/use-cases.md#permissões-novas-srcdomainaccesspermissionsts); garçom sem `catalog.read`
- [ ] T016 [P] `src/domain/access/permissions.ts` (ROLES, ROLE_LABELS, ACTIONS, MATRIX)
- [ ] T017 [teste] `tests/integration/ordering/schema.test.ts`: checks e triggers da migração (nome único entre mesas ativas; `expires_at = opened_at + interval '20 minutes'`; `order_lines` e `order_status_events` recusam `UPDATE`/`DELETE` com `APPEND_ONLY`; `orders` só muda `status`, `cancel_reason`, `cancel_note`, `status_changed_at`, `version`; `cancel_reason` obrigatório se `CANCELLED`; quantidade 1–20; `unit_price >= base_price`; `sold_out_on` só em `DISH`)
- [ ] T018 Migração `src/infra/db/migrations/0009_ordering.sql` e `src/infra/db/schema/ordering.ts`: `dining_tables`, `menu_accesses`, `orders`, `order_lines` (sem `note`, com `base_price` ↔ 010), `order_status_events`, `order_day_counters`, `recipes.sold_out_on`, `restaurants.accepting_qr_orders`, `ALTER TYPE role ADD VALUE 'WAITER'`, RLS e `GRANT` em todas, conforme [data-model.md](data-model.md)
- [ ] T019 [teste] `tests/integration/ordering/isolation.test.ts`: com e sem o filtro da aplicação, restaurante A não lê nem grava mesas, acessos e pedidos de B; `app_table_by_qr_token` e `app_menu_access_by_token_hash` devolvem só `restaurant_id`, id e `active`, e token de B não abre nada em A
- [ ] T020 Funções `SECURITY DEFINER` `app_table_by_qr_token(text)` e `app_menu_access_by_token_hash(text)` na `0009_ordering`; `src/infra/db/public-ordering.ts`
- [ ] T021 [P] `src/application/ordering/ports.ts` e `src/infra/db/repositories/ordering-repository.ts` (repositórios usados pelos casos de uso abaixo; cada um com teste de integração na história que o usa)
- [ ] T022 [teste] Menu por permissão: o componente de navegação mostra só o que o papel vê (garçom: "Garçom" e "Pedidos"); teste em `src/components/layout/nav.test.tsx`
- [ ] T023 Extrair `src/components/layout/nav.tsx` com `NAV` filtrado por `can()`; usar em `app/(app)/layout.tsx`; páginas de estoque mostram "Sem acesso" para garçom

**Ponto de checagem**: domínio verde, migração aplicada, isolamento provado.

## Fase 3: US1 — Mesas e QR codes (P1)

**Objetivo**: o gerente cadastra mesas e imprime os QR codes.
**Teste independente**: criar a mesa "12", abrir o QR code e cair no cardápio como "Mesa 12".

- [ ] T024 [P] [US1] [teste] `src/infra/qr.test.ts`: SVG válido para a URL, nível "M", margem 2
- [ ] T025 [P] [US1] `src/infra/qr.ts`
- [ ] T026 [US1] [teste] `tests/integration/ordering/tables.test.ts`: `createTable` (`TABLE_NAME_IN_USE` sem diferenciar maiúsculas e acentos), `createTablesInRange` 1–20 pula as existentes e devolve `{ created, skipped }`, `renameTable` e `setTableActive` com `STALE_RECORD`, `rotateTableQr` troca o token e o antigo não acha a mesa, `tableQrCodes` com URL `{appUrl}/m/{token}`, permissão `table.manage` (chef recebe `FORBIDDEN` e auditoria `DENIED`), auditoria sem o token
- [ ] T027 [US1] `src/application/ordering/tables.ts` e `src/actions/tables.ts`
- [ ] T028 [P] [US1] [teste] `src/components/ordering/table-qr-card.test.tsx`: QR code com nome do restaurante e "Mesa N"; botões "Baixar imagem" e "Trocar QR code" com confirmação
- [ ] T029 [US1] `src/components/ordering/table-qr-card.tsx`, `app/(app)/pedidos/mesas/page.tsx`, `app/(app)/pedidos/mesas/imprimir/page.tsx` (CSS de impressão, `no-print`)

## Fase 4: US2 + US3 — Cardápio sem login e acesso de 20 minutos (P1) ↔ 010

**Objetivo**: o cliente escaneia, vê o cardápio e envia o pedido dentro de 20 minutos.
**Teste independente**: escanear, pedir 2 X-Burger e 1 Suco, ver "Pedido enviado para a cozinha";
depois de 20 minutos, envio recusado.

Antes desta fase: Fase 2 da 010 (domínio de escolhas), porque a linha do pedido leva adicionais e
retiradas.

- [ ] T030 [US3] [teste] `tests/integration/ordering/menu-access.test.ts` (relógio controlado): `openMenuAccess` cria acesso de 20 min com IP e navegador; mesa inativa, chave desligada e token desconhecido não criam acesso e dão a mensagem certa; nova leitura com cookie encerra o acesso anterior; acesso não renova com uso
- [ ] T031 [US3] `src/application/ordering/menu-access.ts`
- [ ] T032 [US3] [teste] `tests/integration/ordering/public-route.test.ts`: `GET /m/{token}` responde `303 → /cardapio` com cookie `menu_access` (`HttpOnly; Secure; SameSite=Lax; Path=/cardapio; Max-Age=1200`), `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; 404 "QR code inválido. Chame um garçom." para token desconhecido
- [ ] T033 [US3] `app/m/[token]/route.ts`
- [ ] T034 [US2] [teste] `tests/integration/ordering/submit-order.test.ts`: conferências na ordem de [public-routes.md](contracts/public-routes.md#ação-submitorderaction--enviar-pedido) (`ACCESS_EXPIRED`, tolerância de 15 s, mesmo `clientRequestId` devolve o mesmo pedido, `TABLE_INACTIVE`, `ORDERING_PAUSED`, `ACCESS_ORDER_LIMIT`, linhas, `PRODUCT_UNAVAILABLE`, `PRICE_CHANGED`); grava pedido `RECEIVED`, linhas com `recipe_version_id` da versão mais nova e `base_price`, evento de situação, número do dia 1, 2, 3 e reinício no dia seguinte; dois envios concorrentes não repetem número; escolhas da 010 gravadas
- [ ] T035 [US2] `src/application/ordering/submit-order.ts`, `src/application/ordering/order-input.ts` (Zod) e `src/actions/menu.ts` (`submitOrderAction`, `listAccessOrdersAction`)
- [ ] T036 [US2] [teste] `tests/integration/ordering/menu.test.ts`: `getMenu` devolve `MenuView` com produtos da regra do T013 e opções da 010; `listAccessOrders` só do próprio acesso, nunca de outro celular da mesma mesa
- [ ] T037 [US2] `src/application/ordering/menu.ts`
- [ ] T038 [P] [US2] [teste] `src/components/ordering/cart.test.tsx`: adicionar, mudar quantidade, tirar linha, total, resumo de confirmação, `clientRequestId` reaproveitado na nova tentativa, aviso de preço mudado e de produto indisponível, botão "Enviar pedido" indisponível com pedido vazio
- [ ] T039 [P] [US3] [teste] `src/components/ordering/access-timer.test.tsx`: tempo a partir de `serverNow`/`expiresAt` (não do relógio do aparelho), aviso "Faltam 2 minutos…" só com itens não enviados, tela "Seu tempo acabou…" mostrando o que não foi enviado
- [ ] T040 [P] [US2] [teste] `src/components/ordering/my-orders.test.tsx`: situação de cada pedido em português
- [ ] T041 [US2] `src/components/ordering/menu-list.tsx`, `cart.tsx`, `access-timer.tsx`, `my-orders.tsx`, `auto-refresh.tsx` (para com a aba escondida)
- [ ] T042 [US2] `app/(cardapio)/layout.tsx` (sem menu da equipe) e `app/(cardapio)/cardapio/page.tsx`

## Fase 5: US4 — Cozinha e garçom (P1)

**Objetivo**: o pedido chega na cozinha sozinho e o garçom leva.
**Teste independente**: enviar da mesa 12, ver na cozinha em até 10 s, "Pronto", ver no garçom,
"Entregue".

- [ ] T043 [US4] [teste] `tests/integration/ordering/kitchen.test.ts`: `listKitchenOrders` (mais antigo primeiro, `late`, mudanças da 010 em `changes`), `advanceOrderStatus` e `markDelivered` com `STALE_RECORD` e `INVALID_ORDER_TRANSITION`, `cancelOrder` com motivo e `CANCEL_NOTE_REQUIRED`, evento com usuário e hora em cada mudança, permissões (garçom não avança na cozinha, estoquista não vê nada), `listReadyOrders`
- [ ] T044 [US4] `src/application/ordering/kitchen.ts` e `src/actions/kitchen.ts`
- [ ] T045 [P] [US4] [teste] `src/components/ordering/kitchen-board.test.tsx`: destaque "novo", "atrasado" em texto, botões por situação, cancelar com motivo
- [ ] T046 [P] [US4] [teste] `src/components/ordering/ready-list.test.tsx`: mesa em destaque, "Entregue"
- [ ] T047 [US4] `kitchen-board.tsx`, `ready-list.tsx`, `app/(app)/pedidos/cozinha/page.tsx`, `app/(app)/pedidos/garcom/page.tsx` com `AutoRefresh` de 5 s

## Fase 6: US5 — Esgotado hoje (P2)

- [ ] T048 [US5] [teste] `tests/integration/ordering/sold-out.test.ts`: `setProductSoldOut` grava a data local de hoje, some do cardápio, volta sozinho no dia seguinte, `NOT_A_DISH` para preparo, auditoria "Esgotado", permissão `product.sold_out`
- [ ] T049 [US5] Caso de uso em `src/application/ordering/kitchen.ts`; botão na cozinha e na página do produto (`app/(app)/estoque/produtos/[id]/page.tsx`)

## Fase 7: US6 — Chave de pedidos e consulta (P2)

- [ ] T050 [US6] [teste] `tests/integration/ordering/orders.test.ts`: `setAcceptingQrOrders` (gerente, auditoria, `STALE_RECORD`), `listOrders` por período "até 31" dias, mesa e situação (`INVALID_PERIOD`), `getOrder` com linhas e eventos
- [ ] T051 [US6] `src/application/ordering/orders.ts`, chave em `app/(app)/pedidos/mesas/page.tsx`, consulta em `app/(app)/pedidos/page.tsx`

## Fase 8: Ponta a ponta, docs e acabamento

- [ ] T052 [teste] `tests/e2e/ordering.spec.ts` (vermelho antes das telas finais): roteiro do [quickstart](quickstart.md) com celular emulado, cozinha e garçom em contextos separados e relógio controlado; dois restaurantes
- [ ] T053 [P] [teste] `tests/e2e/accessibility.spec.ts`: cardápio, tela do prato, cozinha e garçom sem violações do axe
- [ ] T054 [P] Docs de produto: `docs/produto/pedidos/` (mesas e QR code, cardápio e acesso de 20 minutos, cozinha e garçom), `docs/produto/estoque/09-controles-e-permissoes.md` (Garçom e ações novas), `00-visao-geral.md` (009 feita)
- [ ] T055 [P] Docs de sistema: `docs/sistema/pedidos/01-modelo-de-dados.md`, `02-regras.md`, plano de testes; ADR 0005 de "proposto" para "aceito"; `.env.example` sem chave nova
- [ ] T056 Rodar `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (cobertura do domínio ≥ 90%), `pnpm test:integration`, `pnpm test:e2e`; marcar as tarefas

## Dependências

```text
Fase 1 → Fase 2 → US1 ─┐
                 010 Fase 2 ─→ US2+US3 → US4 → US5, US6 → Fase 8
```

- US1 é independente do cardápio (dá para entregar mesas e QR codes antes).
- US2+US3 precisam da Fase 2 da 010 e de mesas (US1) para o teste ponta a ponta.
- US4 precisa de pedidos (US2). US5 e US6 podem andar em paralelo depois da US4.

## Paralelo

- Fase 2: os pares de domínio T003–T016 em paralelo (arquivos separados).
- US2: T038, T039, T040 em paralelo depois de T037.
- US4: T045 e T046 em paralelo.
- Fase 8: T053, T054, T055 em paralelo.

## Estratégia

1. **MVP**: Fases 1–5 (mesas, cardápio com botões da 010, envio, cozinha e garçom). É o que o dono
   pediu e o que a 005 precisa.
2. Depois: esgotado (US5), chave e consulta (US6).
3. PRs pequenos por fase, cada um com testes e docs da parte entregue.
