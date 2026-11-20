# Tarefas — 015 Garçom lança o pedido da mesa

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[quickstart.md](quickstart.md).

## Regras (constituição I e [research R19](research.md#r19-testes-primeiro-em-que-camada))

- Toda tarefa de código vem **depois** da tarefa `[teste]` que a exige. O teste é escrito, rodado e
  visto falhar **na asserção** (crie um esqueleto vazio antes, se preciso). Só então entra o mínimo
  de código para passar.
- Commits: `test(015): … (vermelho)` antes de `feat(015): …` do mesmo assunto, citando as tarefas.
- Nenhum `.skip`, `.only` ou teste apagado. Os testes da 009 a 011 continuam verdes sem mudar de
  sentido: o pedido do QR code só passa a ter `source = QR`.
- Dinheiro sempre em `Decimal`; nada de `number` para valor.
- O foco é o software funcionar para o garçom no salão; valores fixos nos testes são bem-vindos.
- `[P]` = pode andar em paralelo. `[USn]` = história da spec.
- Números dos testes: os do [quickstart](quickstart.md) (Mesa 12, João e Maria garçons, X-Burger
  R$ 30,00 com "Fatia de queijo" R$ 2,00 e "sem cebola", Chope R$ 12,00; 2 × X-Burger com + 2
  queijo = R$ 68,00).
- A migração é a `0015_staff_orders` (a `0014` ficou com o caixa do dia).

## Fase 1: Ferramentas de teste

- [x] T001 Modo `staff` em `vitest.config.mts` e script `test:staff` em `package.json`: projetos `unit` e `integration` juntos, cobertura de `src/domain/ordering/{kitchen-note,staff-request,reorder,similar-orders}.ts`, `src/domain/menu/{staff-menu,search}.ts`, `src/application/ordering/{staff-orders,staff-order-input,save-order}.ts` e `src/components/staff-ordering/**`, limite de 100% de linhas, desvios e funções, relatório em `coverage/staff`
- [x] T002 `stryker.config.json`: os arquivos novos do domínio entram no `mutate`
- [x] T003 `.github/workflows/ci.yml`: `pnpm test:staff` no job `integracao`

## Fase 2: Base (bloqueia todas as histórias)

### Domínio

- [x] T004 [P] [teste] `src/domain/access/permissions.test.ts` (FR-001): `order.place` e `order.cancel_own` são de `MANAGER`, `CASHIER` e `WAITER`; `CHEF` e os papéis do estoque não têm; `order.cancel` continua de `MANAGER` e `CHEF`
- [x] T005 [P] `order.place` e `order.cancel_own` em `src/domain/access/permissions.ts` (verde o T004)
- [x] T006 [P] [teste] `src/domain/ordering/order.test.ts` (FR-006, FR-010): `ORDER_SOURCES = ["QR", "STAFF"]`; `CANCEL_REASONS` inclui `ENTERED_BY_MISTAKE` com o rótulo "Lançado errado"; `cancelScope({ status, source, placedById }, { userId, canCancel, canCancelOwn })`: com `order.cancel` → `ANY` em qualquer não final; só com `cancel_own` → `OWN` no pedido `STAFF` do próprio usuário em `RECEIVED`, `KITCHEN_STARTED` em `IN_PREPARATION`/`READY`, `FORBIDDEN` no pedido de outro ou do QR code; final → `FINAL`
- [x] T007 [P] `ORDER_SOURCES`, `ENTERED_BY_MISTAKE` e `cancelScope` em `src/domain/ordering/order.ts` (verde o T006)
- [x] T008 [P] [teste] `src/domain/ordering/kitchen-note.test.ts` (FR-018): `checkKitchenNote` apara espaços; vazio vira `null`; 140 letras passa; 141 → `NOTE_TOO_LONG`; acento conta 1 letra
- [x] T009 [P] `src/domain/ordering/kitchen-note.ts` (verde o T008)
- [x] T010 [P] [teste] `src/domain/ordering/checkout.test.ts`: `kitchenNote` passa da linha pedida para a linha conferida sem mudar preço nem total; duas linhas iguais com observação diferente continuam separadas
- [x] T011 [P] `kitchenNote` em `RequestedLine` e `PricedLine` (`src/domain/ordering/checkout.ts`) (verde o T010)
- [x] T012 [P] [teste] `src/domain/menu/staff-menu.test.ts` (FR-003): `buildStaffMenu` dá as mesmas seções, ordem e preços de `buildCustomerMenu`; esgotado aparece no fim da seção com `soldOut: true`, sem adicionais nem retiradas; sem preço ou inativo não aparece; seção só com esgotados continua
- [x] T013 [P] `src/domain/menu/staff-menu.ts` (verde o T012)
- [x] T014 [P] [teste] `src/domain/menu/search.test.ts` (US5-2): `normalizeSearch` tira acento, caixa e espaços das pontas; `matchesSearch("Purê de batata", "pure")` e `("X-Burger", "burg")` acham; busca vazia acha tudo
- [x] T015 [P] `src/domain/menu/search.ts` (verde o T014)
- [x] T016 [P] [teste] `src/domain/ordering/staff-request.test.ts` (FR-011): `sameRequest(stored, requested)` é verdadeiro com a mesma mesa e as mesmas linhas em qualquer ordem (adicionais e retiradas também em qualquer ordem); falso com outra mesa, outra quantidade, outro adicional, outra observação ou uma linha a mais
- [x] T017 [P] `src/domain/ordering/staff-request.ts` (verde o T016)
- [x] T018 [P] Códigos `STAFF_TABLE_INACTIVE`, `KITCHEN_STARTED` e `REQUEST_REUSED` em `src/domain/shared/result.ts`; [teste] e textos em `src/components/forms/error-messages.{test,ts}` com as mensagens do contrato

### Banco

- [x] T019 [teste] `tests/integration/ordering/staff-schema.test.ts` (data-model): `orders_source_shape` recusa `STAFF` sem `placed_by`, `STAFF` com acesso, `QR` sem acesso e `QR` com `placed_by`; `orders_staff_client_request` recusa o mesmo `(placed_by, client_request_id)`; `orders_status_only` recusa mudar `source`, `placed_by` e `menu_access_id`; `kitchen_note` recusa vazio e 141; `ENTERED_BY_MISTAKE` existe; pedidos antigos viram `QR`; RLS isola por restaurante
- [x] T020 Migração `src/infra/db/migrations/0015_staff_orders.sql` + snapshot e diário do Drizzle; `orderSourceEnum`, colunas e índices em `src/infra/db/schema/ordering.ts` (verde o T019)
- [x] T021 [teste] `tests/integration/ordering/orders.test.ts` e `kitchen.test.ts` continuam verdes depois de `NewOrder` virar união por origem; [teste] novo no repositório: `findStaffByClientRequest`, `staffTables()` numa ida ao banco, `load` com `source`, `placedById`, `placedByName` e `kitchenNote` nas linhas
- [x] T022 `src/application/ordering/ports.ts` (`OrderRecord`, `OrderLineView`, `NewOrder`, `OrderFilter`, `OrderRepo`) e `src/infra/db/repositories/ordering-repository.ts` (verde o T021)
- [x] T023 [teste] `tests/integration/ordering/submit-order.test.ts`: o pedido do QR code grava `source = QR`, `placed_by` nulo; comportamento da 009 a 011 igual
- [x] T024 `src/application/ordering/save-order.ts` (número do dia, conta aberta ou nova, pedido, linhas, evento, `OPENED`), usado pelo `submitOrder` (verde o T023)

**Ponto de controle**: `pnpm test:unit` e `pnpm test:integration` verdes; pedidos antigos e do QR code intactos.

## Fase 3: US1 — Garçom lança o pedido da mesa (P1) 🎯 MVP

- [x] T025 [P] [teste] [US1] `src/application/ordering/staff-order-input.test.ts`: `parseStaffOrderInput` aceita o formato do contrato com `kitchenNote` e `tabIdSeen`; recusa campo a mais (`strictObject`), uuid inválido e preço com 3 casas
- [x] T026 [P] [US1] `src/application/ordering/staff-order-input.ts` (verde o T025)
- [x] T027 [teste] [US1] `tests/integration/ordering/staff-orders.test.ts` (FR-001 a FR-007, FR-011, FR-014, FR-015): João lança 2 × X-Burger + 2 queijo sem cebola na Mesa 12 → pedido com `source = STAFF`, `placed_by = João`, total R$ 68,00, número na sequência do QR code, conta aberta com `OPENED` de João, evento `RECEIVED` com `user_id`, auditoria `CREATE`; com a chave do QR code desligada e 10 pedidos no acesso, lança igual; mesa inativa → `STAFF_TABLE_INACTIVE`; observação de 141 → `NOTE_TOO_LONG`; preço mudou → `PRICE_CHANGED`; mesmo envio duas vezes → mesmo pedido; mesmo envio com outro conteúdo → `REQUEST_REUSED` sem gravar; QR e equipe em paralelo na mesa sem conta → uma conta só; conta fechada no meio (`tabIdSeen` antigo) → conta nova e `previousTabClosed`; chef → `FORBIDDEN` com `DENIED`; outro restaurante não vê a mesa
- [x] T028 [teste] [US1] no mesmo arquivo: `listTablesForStaff` (ativas na ordem do nome, conta aberta com total e hora, prontos, `qrOrdersOff`) e `getStaffMenu` (esgotado no fim, mesa inativa → `STAFF_TABLE_INACTIVE`, outra mesa → `NOT_FOUND`)
- [x] T029 [US1] `src/application/ordering/staff-orders.ts` com `listTablesForStaff`, `getStaffMenu` e `placeStaffOrder` (verde o T027 e o T028)
- [x] T030 [US1] `src/actions/staff-orders.ts` com `placeStaffOrderAction`
- [x] T031 [P] [teste] [US1] `src/components/ordering/cart-state.test.ts`: `kitchenNote` entra na chave da linha; mesma escolha com observação diferente vira outra linha; sem observação soma como hoje
- [x] T032 [P] [US1] `kitchenNote` em `src/components/ordering/cart-state.ts` (verde o T031)
- [x] T033 [P] [teste] [US1] `src/components/ordering/dish-options.test.tsx`: com `allowKitchenNote` mostra "Observação para a cozinha" com o contador "0/140" e devolve a observação; sem ele (cliente) não há campo de texto
- [x] T034 [P] [US1] Campo da observação em `src/components/ordering/dish-options.tsx` / `product-customization.tsx` (verde o T033)
- [x] T035 [P] [teste] [US1] `src/components/staff-ordering/table-grid.test.tsx`: mesas em grade com "Livre" ou "Ocupada · R$ 120,00 · há 35 min", "2 prontos", "Carrinho: 3 itens"; busca pelo nome; aviso do QR code desligado
- [x] T036 [P] [US1] `src/components/staff-ordering/table-grid.tsx` (verde o T035)
- [x] T037 [P] [teste] [US1] `src/components/staff-ordering/staff-cart.test.tsx` e `confirm-order.test.tsx`: carrinho com **Limpar** e **Enviar pedido**; resumo "Conferir: Mesa 12" com o total; **Confirmar** chama a ação com o mesmo `clientRequestId`; sucesso "Pedido 5 enviado para a cozinha · Mesa 12 · R$ 68,00" e carrinho vazio; aviso de conta anterior fechada; recusas com a mensagem
- [x] T038 [P] [US1] `staff-cart.tsx`, `confirm-order.tsx` e `cart-bar.tsx` (barra fixa "Carrinho · 3 itens · R$ 98,00") (verde o T037)
- [x] T039 [teste] [US1] `src/components/staff-ordering/table-menu.test.tsx`: topo "Mesa 12" + **Trocar mesa**; seções do cardápio; esgotado apagado com o selo e sem botão; tocar no produto abre a tela do prato com a observação
- [x] T040 [US1] `src/components/staff-ordering/table-menu.tsx` (verde o T039)
- [x] T041 [US1] Páginas `app/(app)/pedidos/lancar/page.tsx` e `app/(app)/pedidos/lancar/[mesa]/page.tsx`; `nav.tsx` com **Lançar pedido** (`NotebookPen`, `order.place`) entre Cozinha e Garçom e `homeFor` do garçom em `/pedidos/lancar`, com [teste] em `nav.test.tsx`

## Fase 4: US2 — Quem lançou cada pedido (P1)

- [x] T042 [teste] [US2] Integração: `listKitchenOrders` e `listReadyOrders` trazem `source`, `placedByName` e `kitchenNote`; `listReadyOrders({ onlyMine })` só os do usuário; `listOrders({ placedBy: "QR" | userId })` filtra; `summary` por origem com contagem, total dos não cancelados e cancelados por motivo batendo centavo por centavo (SC-005); `placedByOptions`; `getOrder` com quem lançou e quem cancelou; `getTab` com origem e `OPENED` com o nome
- [x] T043 [US2] `kitchen.ts`, `orders.ts`, `src/application/billing/tabs.ts` e o repositório (`summaryBySource`) (verde o T042)
- [x] T044 [P] [teste] [US2] Componentes: cartão da cozinha com "João" ou "QR code" embaixo da mesa e a observação em destaque; Garçom com quem lançou e **Só os meus**; consulta com filtro **Lançado por**, coluna e resumo; detalhe "Lançado por João às 20:14"; conta com a origem por pedido e "Conta aberta por João (pedido 5)"
- [x] T045 [P] [US2] `kitchen-board.tsx`, `ready-list.tsx`, `line-changes.tsx` (`KitchenNote`), páginas `/pedidos`, `/pedidos/[id]`, `/pedidos/garcom` e componentes da conta (verde o T044)

## Fase 5: US3 — Pedidos da mesa (P1)

- [x] T046 [teste] [US3] Integração: `listTableOrders` dá os pedidos da conta aberta de todas as origens, mais novo primeiro, com linhas, mudanças, observação, `again`, `canCancel`, `canDeliver` e o total da conta com a taxa; mesa sem conta → `tab: null`, `orders: []`
- [x] T047 [US3] `listTableOrders` em `staff-orders.ts` (verde o T046)
- [x] T048 [P] [teste] [US3] `src/components/staff-ordering/table-orders.test.tsx`: lista com número, hora, origem, situação e total; "Nenhum pedido aberto nesta mesa."; **Entregue** no pronto; **Ver conta** leva à conta da mesa
- [x] T049 [P] [US3] `table-orders.tsx` e a aba **Pedidos da mesa** (`?aba=pedidos`) com `AutoRefresh`; `markDeliveredAction` revalida a mesa; a conta mostra "Voltar à Mesa 12" para quem tem `order.place` e não mostra **Lançar pagamento** para o garçom (verde o T048)

## Fase 6: US4 — Cancelar o próprio (P2)

- [x] T050 [teste] [US4] Integração (FR-010): João cancela o próprio pedido em Recebido com "Lançado errado"; não cancela o de Maria nem o do QR code (`FORBIDDEN`, `DENIED`); depois do Começar preparo → `KITCHEN_STARTED`; corrida com Começar preparo: só um vale e o estoque não baixa de cancelado; `ingredientsUsed` ignorado para quem só tem `cancel_own`
- [x] T051 [US4] `cancelOrder` com `cancelScope` (verde o T050) e `cancelOwnOrderAction`
- [x] T052 [P] [teste] [US4] `table-orders.test.tsx`: **Cancelar** só no pedido próprio em Recebido, com a lista de motivos; "A cozinha já começou. Peça ao chef ou ao gerente para cancelar." no próprio em preparo; pedido cancelado riscado
- [x] T053 [P] [US4] Cancelar em `table-orders.tsx` (verde o T052)

## Fase 7: US5 — Rápido no celular (P2)

- [x] T054 [P] [teste] [US5] `src/components/staff-ordering/cart-storage.test.ts` (FR-012, FR-022, R10): chave `garcom:v1:<restaurante>:<usuário>:<mesa>`; salva e lê; descarta com mais de 12 h; `clearAll` apaga os do aparelho; abrir com outro usuário apaga as chaves dos outros; `localStorage` que falha não quebra
- [x] T055 [P] [US5] `cart-storage.ts` (verde o T054)
- [x] T056 [P] [teste] [US5] `src/components/staff-ordering/send-state.test.ts` (FR-021, R22): `idle` → `sending` → `sent`/`failed`/`uncertain`; sem rede antes de enviar = "Sem conexão. O pedido não foi enviado."; em `uncertain` o carrinho não muda nem limpa; reenvio usa o mesmo `clientRequestId`
- [x] T057 [P] [US5] `send-state.ts` (verde o T056)
- [x] T058 [P] [teste] [US5] `product-row.test.tsx` e `table-menu.test.tsx`: modos **Fotos** e **Lista** lembrados no aparelho; busca "pure" acha "Purê"; "+" põe 1 sem abrir a tela do prato; "− 2 +" no produto que já está no carrinho; carrinho travado mostra **Enviar de novo** e **Ver Pedidos da mesa**
- [x] T059 [P] [US5] `product-row.tsx` e os modos em `table-menu.tsx` (verde o T058); **Sair** em `app-shell.tsx` apaga os carrinhos
- [x] T060 [US5] `tests/screens/fixtures.ts` (`asWaiter`) e `tests/screens/staff-ordering.spec.ts`: grade e mesa nos tamanhos da matriz, claro e escuro, sem rolar para o lado, sem texto cortado, toques de 44 px e axe sem violação séria

## Fase 8: US6 — Pedir de novo e pedido parecido (P2)

- [x] T061 [P] [teste] [US6] `src/domain/ordering/reorder.test.ts` (FR-019): `reorderLines` põe o mesmo produto, quantidade, adicionais, retiradas e observação com o preço de hoje; esgotado, inativo ou sem preço sai com o motivo ("Purê está esgotado hoje e não entrou."); adicional que saiu tira a linha com o motivo
- [x] T062 [P] [US6] `src/domain/ordering/reorder.ts` (verde o T061)
- [x] T063 [P] [teste] [US6] `src/domain/ordering/similar-orders.test.ts` (FR-020): avisa pedido de outra pessoa ou do QR code com produto do carrinho nos últimos 5 min ("Maria lançou 2 Chope nesta mesa há 1 min."); não avisa os próprios, os cancelados, os de mais de 5 min nem os de outro produto
- [x] T064 [P] [US6] `src/domain/ordering/similar-orders.ts` (verde o T063)
- [x] T065 [teste] [US6] `table-orders.test.tsx` e `confirm-order.test.tsx`: **Pedir de novo** na linha e no pedido enche o carrinho e mostra o que ficou de fora; o resumo com aviso troca **Confirmar** por **Lançar mesmo assim**
- [x] T066 [US6] Pedir de novo e o aviso nos componentes (verde o T065)

## Fase 9: Ponta a ponta, docs e verificação

- [x] T067 `tests/e2e/staff-ordering.spec.ts`: roteiro do quickstart (João lança na Mesa 12, chef vê "João" na cozinha, consulta filtra por João, João cancela "Lançado errado"), rede cortada depois do envio sem pedido em dobro e lançar 2 produtos sem escolhas em até 6 toques; `accessibility.spec.ts` com Lançar pedido e a mesa
- [x] T068 Docs: `docs/produto/pedidos/08-lancar-pedido.md` (novo), `00-visao-geral.md`, `03-cozinha-e-garcom.md`, `05-conta-da-mesa.md`, `02-cardapio-do-cliente.md`, `docs/produto/estoque/09-controles-e-permissoes.md`, `docs/sistema/pedidos/01-modelo-de-dados.md`, `02-regras.md`
- [x] T069 Verificação completa: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:staff`, e2e e telas da 015
