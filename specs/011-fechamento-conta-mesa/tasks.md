# Tarefas — 011 Fechar a conta da mesa e baixar o estoque pelos pedidos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

Regras: cada tarefa de código vem depois do teste que a exige e esse teste é visto falhar na
asserção antes (constituição, princípio I; [01-tdd](../../docs/sistema/01-tdd.md)). `[P]` = pode
andar em paralelo (arquivos diferentes, sem depender de tarefa aberta). `[USn]` = história da spec.
Commits `test(011): …` antes de `feat(011): …`.

## Fase 1: Preparação

- [X] T001 Criar as pastas `src/domain/billing/`, `src/application/billing/`, `src/components/billing/`, `tests/integration/billing/`

## Fase 2: Base (bloqueia todas as histórias)

Domínio puro, permissões e banco.

- [X] T002 [P] [teste] `src/domain/billing/service-charge.test.ts`: taxa = subtotal × porcentagem ÷ 100 com meio centavo para cima (R$ 68,00 × 10% = R$ 6,80; R$ 33,35 × 10% = R$ 3,34); nula ou tirada = R$ 0,00; porcentagem "0 a 20" com até 2 casas (`INVALID_RATE`)
- [X] T003 [P] `src/domain/billing/service-charge.ts`
- [X] T004 [P] [teste] `src/domain/billing/tab.test.ts`: subtotal ignora cancelados; total = subtotal + taxa; pago ignora pagamentos tirados; falta = total − pago; "pode fechar" só com falta 0 e sem pedido em `RECEIVED`/`PREPARING`/`READY` (`REMAINING_NOT_ZERO`, `PENDING_ORDERS`); conta com todos os pedidos cancelados fecha com R$ 0,00
- [X] T005 [P] `src/domain/billing/tab.ts`
- [X] T006 [P] [teste] `src/domain/billing/payment.test.ts`: valor > 0 com até 2 casas (`INVALID_AMOUNT`); fora do dinheiro, valor ≤ falta (`PAYMENT_EXCEEDS_REMAINING`); em dinheiro, recebido ≥ valor (`RECEIVED_TOO_LOW`), valor = mín(recebido, falta) e troco = recebido − valor (falta R$ 24,93, recebido R$ 50,00 → troco R$ 25,07)
- [X] T007 [P] `src/domain/billing/payment.ts`
- [X] T008 [P] [teste] `src/domain/billing/split.test.ts`: "2 a 20" pessoas (`INVALID_PEOPLE`); R$ 100,00 ÷ 3 = 33,34 + 33,33 + 33,33; R$ 74,80 ÷ 3 = 24,94 + 24,93 + 24,93; soma das partes sempre igual ao falta (propriedade com valores aleatórios); R$ 0,01 ÷ 2 = 0,01 + 0,00
- [X] T009 [P] `src/domain/billing/split.ts`
- [X] T010 [P] [teste] `src/domain/inventory/movement.test.ts`: `planSale` gera quantidade negativa na medida do item, custo = custo médio (zero sem custo), **sem** `INSUFFICIENT_STOCK` mesmo deixando saldo negativo; `planCancelledSale` gera estorno (+) e, se usados, perda (−) com o mesmo custo, também sem bloqueio; perda comum continua bloqueada
- [X] T011 [P] `src/domain/inventory/movement.ts` (`SALE_RECIPE`, rótulo "Venda", `planSale`, `planCancelledSale`) e `movement-reasons.ts` (motivos `LOSS/ORDER_CANCELLED` e `REVERSAL/ORDER_CANCELLED`, "Pedido cancelado")
- [X] T012 [P] [teste] `src/domain/access/permissions.test.ts`: `CASHIER` ("Caixa") e as ações `tab.read`, `tab.pay`, `tab.history`, `tab.reopen`, `tab.settings` com a matriz de [contracts/use-cases.md](contracts/use-cases.md#permissões-novas-srcdomainaccesspermissionsts); caixa com `order.read` e sem `catalog.read`; garçom só `tab.read`
- [X] T013 [P] `src/domain/access/permissions.ts`
- [X] T014 [teste] `tests/integration/billing/schema.test.ts`: uma conta aberta por mesa (índice parcial); `tab_payments`, `tab_payment_removals` e `tab_events` recusam `UPDATE`/`DELETE` (`APPEND_ONLY`); check do dinheiro (`received = amount + change`); `closed_at`/`closed_by` obrigatórios se `CLOSED`; `service_charge_rate` 0–20; `SALE_RECIPE` exige `order_id` e dispensa motivo; venda única por `(order_id, item_id)`
- [X] T015 Migração `src/infra/db/migrations/0011_tabs.sql` e `src/infra/db/schema/billing.ts`: tabelas e colunas de [data-model.md](data-model.md), `ALTER TYPE role ADD VALUE 'CASHIER'`, `ALTER TYPE movement_type ADD VALUE 'SALE_RECIPE'`, seed dos dois motivos, `end_reason` com `RESCAN` nos acessos já encerrados, RLS e `GRANT` em todas
- [X] T016 [teste] `tests/integration/billing/isolation.test.ts`: restaurante A não lê nem grava contas, pagamentos e eventos de B, com e sem o filtro da aplicação
- [X] T017 [P] `src/application/billing/ports.ts` e `src/infra/db/repositories/billing-repository.ts`; `movements` ganha `insertSale`, `salesForOrder`
- [X] T018 [teste] `src/components/layout/nav.test.tsx`: caixa vê só "Caixa", "Contas" e "Pedidos" e entra direto no Caixa; garçom passa a ver "Caixa" (só leitura)
- [X] T019 `src/components/layout/nav.tsx` (itens Caixa e Contas filtrados por `can()`)

**Ponto de checagem**: domínio verde, migração aplicada, isolamento provado.

## Fase 3: US4 — O estoque baixa sozinho pelos pedidos (P1)

**Objetivo**: "Começar preparo" baixa o consumo do pedido.
**Teste independente**: 2 × X-Burger + 2 Fatia de queijo sem cebola → queijo −0,14 kg, pão −2 un,
carne −0,3 kg, cebola sem saída.

- [X] T020 [US4] [teste] `tests/integration/billing/sale.test.ts`: `advanceOrderStatus` para `PREPARING` grava uma `SALE_RECIPE` por item com o consumo da 010 (exemplo da spec, com preparo explodido pelo rendimento), custo médio do momento, `order_id`, quem e quando; saldo = soma do livro; saldo negativo permitido; item sem custo baixa com custo zero; repetir a transição (duas abas) não baixa duas vezes; falha no meio desfaz a mudança de situação; ficha mudada depois do envio não muda a baixa
- [X] T021 [US4] `src/application/ordering/order-consumption.ts` (roda dentro da transação de quem chama), `src/application/inventory/sales.ts` (`recordOrderSale`, travando itens em ordem de id) e `advanceOrderStatus` em `src/application/ordering/kitchen.ts`
- [X] T022 [P] [US4] [teste] Página do item e lista de lançamentos: saída "Venda — pedido 7, Mesa 12", "Sem custo" quando custo zero, saldo negativo com texto de aviso (não só cor) — testes dos componentes existentes em `src/components/items/` e `src/components/movements/`
- [X] T023 [P] [US4] Ajustar os componentes de lançamentos e saldo do item; tela Repor conta saldo negativo como "Acabou"
- [X] T024 [US4] [teste] `tests/integration/reorder/reorder.test.ts` e `src/components/reports/`: gráficos da 006 contam a venda como "Venda", separada das famílias de perda
- [X] T025 [US4] `src/infra/db/repositories/report-repository.ts` e rótulos dos gráficos

## Fase 4: US1 — Ver a conta da mesa com o total (P1)

**Objetivo**: o caixa vê as mesas com conta aberta e o total de cada uma.
**Teste independente**: dois pedidos entregues da mesa 12 → subtotal R$ 77,00, taxa e total.

- [X] T026 [US1] [teste] `tests/integration/billing/tab-open.test.ts`: primeiro pedido abre a conta com a taxa do restaurante copiada; pedidos seguintes (dois celulares) entram na mesma; dois envios simultâneos de uma mesa sem conta criam uma conta só; mudar a taxa do restaurante não muda conta aberta; pedido sempre com `tab_id`
- [X] T027 [US1] `submitOrder` em `src/application/ordering/submit-order.ts` e `orders` no repositório (abre/acha a conta, trava, soma `version`)
- [X] T028 [US1] [teste] `tests/integration/billing/tabs.test.ts`: `listOpenTabs` (total, pedidos não entregues, `serverNow`) e `getTab` (linhas com `changes`, cancelado fora do total com motivo, pagamentos, eventos, `canClose`, `blockers`); permissões (`tab.read`; estoquista `FORBIDDEN` com auditoria `DENIED`)
- [X] T029 [US1] `src/application/billing/tabs.ts` (`listOpenTabs`, `getTab`) e `src/actions/billing.ts`
- [X] T030 [P] [US1] [teste] `src/components/billing/open-tabs.test.tsx` e `tab-detail.test.tsx`: mesa, total, "há 35 min", "2 pedidos ainda não foram entregues"; linhas com "+ 2 Fatia de queijo" e "SEM cebola"; cancelado riscado; subtotal, "Serviço 10%", total, pago, falta
- [X] T031 [US1] `src/components/billing/open-tabs.tsx`, `tab-detail.tsx`, `app/(app)/caixa/page.tsx`, `app/(app)/caixa/[id]/page.tsx` (com o `auto-refresh` da 009)
- [X] T032 [P] [US1] [teste] `src/components/billing/tab-print.test.tsx`: restaurante, mesa, linhas, subtotal, taxa, total e "Não é documento fiscal"
- [X] T033 [US1] `src/components/billing/tab-print.tsx` e `app/(app)/caixa/[id]/imprimir/page.tsx` (CSS de impressão)
- [X] T034 [US1] [teste] `tests/integration/billing/service-charge.test.ts`: `setServiceWaived` (tirar e pôr de volta, evento com quem e quando, `NO_SERVICE_CHARGE` em conta sem taxa, tirar recusado se o pago passaria do total) e `setServiceChargeRate` (só gerente, 0–20 ou desligada, auditoria `serviceChargeRate`, `STALE_RECORD`)
- [X] T035 [US1] `src/application/billing/settings.ts`, `setServiceWaived` em `tabs.ts`, botões "Tirar taxa de serviço"/"Pôr taxa de volta" e a configuração da taxa no topo do Caixa (só gerente)

## Fase 5: US2 — Registrar o pagamento e liberar a mesa (P1)

**Objetivo**: pagar, fechar e liberar a mesa.
**Teste independente**: R$ 77,00 em Pix, "Fechar conta", próximo pedido abre conta nova.

- [X] T036 [US2] [teste] `tests/integration/billing/payments.test.ts`: `addPayment` nas cinco formas; dinheiro com troco; `PAYMENT_EXCEEDS_REMAINING`; dois caixas pagando ao mesmo tempo nunca passam do total; toque duplo (`clientRequestId`) devolve o mesmo pagamento; `removePayment` grava a remoção e o evento (`ALREADY_REMOVED`); conta fechada recusa (`TAB_CLOSED`); permissão `tab.pay` (garçom `FORBIDDEN`)
- [X] T037 [US2] `src/application/billing/payments.ts`
- [X] T038 [US2] [teste] `tests/integration/billing/close.test.ts`: `closeTab` com falta 0 e pedidos entregues grava valores, quem e quando; `REMAINING_NOT_ZERO`; `PENDING_ORDERS`; `STALE_RECORD` quando um pedido entrou depois da tela carregada; pedido enviado depois do fechamento abre conta nova; acessos ao cardápio da mesa encerrados com `TAB_CLOSED` e o envio por eles recusado com `TAB_CLOSED`; mesa inativada com conta aberta ainda fecha
- [X] T039 [US2] `closeTab` em `src/application/billing/tabs.ts`; `submitOrder` devolve `TAB_CLOSED`; mensagem no cardápio do cliente ("Esta conta foi fechada. Escaneie o QR code da mesa para pedir de novo.")
- [X] T040 [P] [US2] [teste] `src/components/billing/payment-form.test.tsx`: formas, valor preenchido com o falta, "Troco: R$ 23,00" no dinheiro, mensagens de erro em português, "Fechar conta" desabilitado com o motivo, confirmação ao tirar pagamento
- [X] T041 [US2] `src/components/billing/payment-form.tsx` e ligação na página da conta

## Fase 6: US3 — Dividir a conta (P1)

**Objetivo**: dividir por pessoas e pagar cada parte.
**Teste independente**: R$ 100,00 ÷ 3, três pagamentos em formas diferentes, fechar.

- [X] T042 [P] [US3] [teste] `src/components/billing/split-helper.test.tsx`: "Dividir por 3" mostra 33,34 / 33,33 / 33,33; "Pagar parte 1 de 3" preenche o valor; depois de um pagamento as partes são refeitas sobre o falta; mudar o número de pessoas refaz; valor livre continua possível
- [X] T043 [US3] `src/components/billing/split-helper.tsx` (usa `splitEvenly`; nada gravado)

## Fase 7: US5 — Pedido cancelado devolve ou vira perda (P2)

- [X] T044 [US5] [teste] `tests/integration/billing/cancel-stock.test.ts`: cancelar `RECEIVED` não mexe no estoque; cancelar `PREPARING`/`READY` sem resposta → `INGREDIENTS_USED_REQUIRED`; "Sim" → estorno de cada venda + perda "Pedido cancelado" com mesmo item, quantidade e custo, saldo igual; "Não" → estorno e saldo volta; nada editado ou apagado; perda do cancelamento não é bloqueada por saldo negativo
- [X] T045 [US5] `reverseOrderSale` em `src/application/inventory/sales.ts` e `cancelOrder` em `kitchen.ts`
- [X] T046 [P] [US5] [teste] `src/components/ordering/kitchen-board.test.tsx`: cancelar pedido em preparo ou pronto pergunta "Os ingredientes já foram usados?" (padrão Sim); pedido recebido não pergunta
- [X] T047 [US5] `src/components/ordering/kitchen-board.tsx` e `src/actions/kitchen.ts`

## Fase 8: US6 — Consultar contas e o que entrou no dia (P2)

- [X] T048 [US6] [teste] `tests/integration/billing/history.test.ts`: `listTabs` por período "até 31" dias e mesa (`INVALID_PERIOD`), resumo por forma de pagamento sem os tirados e com o total de taxa; `reopenTab` só gerente, motivo 1–140 (`REASON_REQUIRED`, `NOTE_TOO_LONG`), `TABLE_HAS_OPEN_TAB`, volta com os pagamentos e guarda os valores de antes no evento
- [X] T049 [US6] `listTabs` e `reopenTab` em `src/application/billing/tabs.ts`
- [X] T050 [P] [US6] [teste] `src/components/billing/tabs-report.test.tsx`: lista, resumo por forma e "Reabrir conta" só para gerente
- [X] T051 [US6] `src/components/billing/tabs-report.tsx`, `app/(app)/caixa/contas/page.tsx`, `app/(app)/caixa/contas/[id]/page.tsx`

## Fase 9: Ponta a ponta, docs e acabamento

- [X] T052 [teste] `tests/e2e/billing.spec.ts` (vermelho antes das telas finais): roteiro do [quickstart](quickstart.md) com celular emulado, cozinha e caixa em contextos separados; dois restaurantes
- [X] T053 [P] [teste] `tests/e2e/accessibility.spec.ts`: Caixa, conta, conta impressa e Contas sem violações do axe
- [X] T054 [P] Docs de produto: `docs/produto/pedidos/05-conta-da-mesa.md` (novo) e `00-visao-geral.md`; `docs/produto/estoque/06-movimentacoes.md` (venda, saldo negativo para venda, perda "Pedido cancelado"), `09-controles-e-permissoes.md` (Caixa e ações `tab.*`), `13-decisoes-adotadas.md` (decisões da 011), `00-visao-geral.md` (005 e 011 feitas); `docs/README.md`
- [ ] T055 [P] Docs de sistema: `docs/sistema/pedidos/01-modelo-de-dados.md` (contas e pagamentos), `02-regras.md` (domínio `billing`), plano de testes; `docs/sistema/estoque/01-modelo-de-dados.md` e `03-movimentacoes-e-saldo.md` (`SALE_RECIPE`, `order_id`, saldo negativo só para venda)
- [ ] T056 Rodar `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (cobertura do domínio ≥ 90%), `pnpm test:integration`, `pnpm test:e2e`; marcar as tarefas

## Dependências

```text
Fase 1 → Fase 2 → US4 (baixa) ─────────────────────┐
                → US1 (conta) → US2 (pagar, fechar) → US3 (dividir) → US6 → Fase 9
                  US4 → US5 (cancelamento com estoque) ┘
```

- US4 só depende da Fase 2: dá para entregar a baixa do estoque antes do caixa.
- US2 precisa da conta (US1); US3 precisa do pagamento (US2).
- US5 precisa da baixa (US4). US6 precisa do fechamento (US2).

## Paralelo

- Fase 2: os pares de domínio T002–T013 em paralelo (arquivos separados).
- US4 e US1 podem andar em paralelo depois da Fase 2 (arquivos diferentes, exceto o repositório
  de pedidos: combinar a ordem de T021 e T027).
- Fase 9: T053, T054, T055 em paralelo.

## Estratégia

1. **MVP**: Fases 1–6 (baixa do estoque, conta, pagamento, fechamento e divisão). É o que o dono
   pediu.
2. Depois: cancelamento com estoque (US5) e consulta de contas (US6).
3. PRs pequenos por fase, cada um com testes e docs da parte entregue.
