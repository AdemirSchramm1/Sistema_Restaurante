# Plano técnico: 011 — Fechar a conta da mesa e baixar o estoque pelos pedidos

**Branch**: `claude/project-thread-s5zyo4` | **Data**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Resumo

Duas partes que se apoiam no que já existe:

1. **Conta da mesa.** Uma tabela nova de contas (`table_tabs`), aberta pelo primeiro pedido da
   mesa dentro do `submitOrder` da 009, com pagamentos só inserção, taxa de serviço copiada do
   restaurante ao abrir e fechamento com trava otimista. Telas logadas **Caixa** e **Contas**,
   papel novo **Caixa**. As contas (totais, taxa, troco, divisão, pode fechar) ficam no domínio
   puro `src/domain/billing/`.
2. **Baixa do estoque.** "Começar preparo" lança, na mesma transação, uma saída `SALE_RECIPE` por
   item com o consumo da 010 e o custo médio do momento. Venda não é bloqueada por saldo.
   Cancelamento depois do preparo estorna a venda e, se os ingredientes foram usados, lança a
   perda "Pedido cancelado".

Nenhuma dependência nova.

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19 |
| Dependências novas | Nenhuma |
| Banco | PostgreSQL 17 (Neon); migração `0011_tabs` |
| Testes | Vitest (unidade e integração com Testcontainers), Playwright |
| Plataforma | Vercel; Caixa pensado para computador ou tablet |
| Desempenho | Pedido novo na conta em até 10 s (consulta a cada 5 s); fechar conta < 30 s de operação (SC-001) |
| Restrições | Dinheiro e quantidade em decimal exato; livro de estoque e pagamentos só inserção; nada cruza restaurantes |
| Escala | Dezenas de mesas; poucas centenas de pedidos e contas por dia |

Nenhum ponto em aberto: as três perguntas foram decididas pelo dono em 2026-11-11.

## Constituição

| Princípio | Como a 011 cumpre |
|---|---|
| I. Testes primeiro | `test(011)` antes de cada `feat(011)`: domínio (totais, taxa, troco, divisão, pode fechar, venda e cancelamento), integração (conta única por mesa, corrida envio × fechamento, pagamentos em paralelo, baixa uma vez só, saldo = soma do livro com vendas, isolamento) e e2e (celular → cozinha → caixa) |
| II. Domínio puro | `src/domain/billing/` (`tab.ts`, `payment.ts`, `split.ts`, `service-charge.ts`) e `planSale`/`planCancelledSale` em `src/domain/inventory/movement.ts`. Relógio e ids por parâmetro |
| III. Livro imutável | Venda, estorno e perda do cancelamento são inserções no livro; nada é editado. Pagamentos e eventos da conta também são só inserção (`app_reject_change`) |
| IV. Precisão | `numeric(12,2)` e `decimal.js`; quantidade do estoque `numeric(14,4)`. Arredondamento só na taxa de serviço (meio centavo para cima) e na divisão (centavos para a 1ª parte), pontos definidos na spec |
| V. Rastreabilidade | Pagamento, pagamento tirado, taxa, fechamento e reabertura em `tab_events` com quem e quando, e na auditoria. Venda com o pedido e quem tocou "Começar preparo". RLS em todas as tabelas novas. Papel Caixa com permissões próprias; reabrir só gerente |
| VI. Docs vivas | Neste PR: spec, plano, glossário e roadmap. No PR da implementação: `docs/produto/pedidos/05-conta-da-mesa.md`, `docs/produto/estoque/06-movimentacoes.md` (venda), `09-controles-e-permissoes.md`, `13-decisoes-adotadas.md`, `docs/sistema/pedidos/` e `docs/sistema/estoque/` (venda e saldo negativo) |
| VII. Simplicidade | Atualização por consulta (sem tempo real), divisão sem gravar nada, baixa síncrona na mesma transação, sem integração com maquininha |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1/R2 Conta**: uma conta aberta por mesa garantida por índice único parcial; o envio do
  pedido trava a conta e soma 1 no `version`, e o fechamento confere esse `version`. Pedido nunca
  fica fora de conta nem entra em conta fechada.
- **R3/R4 Pagamentos**: só inserção; "tirar" é outra inserção. Troco só em dinheiro; nas outras
  formas o valor não passa do que falta.
- **R5 Taxa**: porcentagem do restaurante (padrão 10%, nulo = desligada), copiada para a conta ao
  abrir; o caixa pode tirar a taxa de uma conta.
- **R6 Divisão**: função pura sobre o que falta; nada gravado.
- **R7/R8 Baixa**: `SALE_RECIPE` por item ao passar para Em preparo, mesma transação, índice
  único `(order_id, item_id)`; sem checagem de saldo para venda.
- **R9 Cancelamento**: estorno da venda + perda "Pedido cancelado" quando os ingredientes foram
  usados.
- **R10 Papel Caixa**: `CASHIER` com `tab.read`, `tab.pay`, `tab.history` e `order.read`.
- **R12 Cardápio aberto**: fechar a conta encerra os acessos ao cardápio da mesa.

## Modelo de dados (migração `0011_tabs`)

Resumo; detalhe em [data-model.md](data-model.md).

```text
table_tabs            table_id, status, opened_at, service_rate, service_waived, closed_at,
                      closed_by, subtotal, service_charge, total, version   (única aberta por mesa)
tab_payments          tab_id, method, amount, received, change, client_request_id   (só inserção)
tab_payment_removals  payment_id (único)                                            (só inserção)
tab_events            tab_id, kind, reason, details, at, user_id                    (só inserção)
orders                + tab_id
restaurants           + service_charge_rate numeric(5,2) default 10.00
menu_accesses         + end_reason (RESCAN, TAB_CLOSED)
stock_movements       + order_id; movement_type + SALE_RECIPE; índice único venda por pedido e item
movement_reasons      + LOSS/ORDER_CANCELLED, REVERSAL/ORDER_CANCELLED
role (enum)           + CASHIER
```

## Casos de uso

Contrato completo em [contracts/use-cases.md](contracts/use-cases.md).

- Novos: `listOpenTabs`, `getTab`, `addPayment`, `removePayment`, `setServiceWaived`, `closeTab`,
  `reopenTab`, `listTabs`, `getServiceChargeSettings`, `setServiceChargeRate`.
- Mudam: `submitOrder` (conta), `advanceOrderStatus` (baixa), `cancelOrder` (estorno e perda),
  `orderConsumption` (passa a rodar dentro da transação de quem chama).

## Estrutura

```text
src/domain/billing/            tab.ts (totais, pode fechar), payment.ts (checkPayment, troco),
                               split.ts (splitEvenly), service-charge.ts, *.test.ts
src/domain/inventory/          movement.ts (+ SALE_RECIPE, planSale, planCancelledSale),
                               movement-reasons.ts (+ 2 motivos)
src/domain/access/             permissions.ts (+ CASHIER e ações tab.*)
src/application/billing/       tabs.ts, payments.ts, settings.ts, tab-input.ts, ports.ts
src/application/ordering/      submit-order.ts, kitchen.ts, order-consumption.ts (mudanças)
src/application/inventory/     sales.ts (recordOrderSale, reverseOrderSale)
src/infra/db/                  schema/billing.ts, migrations/0011_tabs.sql,
                               repositories/billing-repository.ts (+ ordering e movements)
src/actions/                   billing.ts
src/components/billing/        open-tabs.tsx, tab-detail.tsx, payment-form.tsx, split-helper.tsx,
                               tab-print.tsx, tabs-report.tsx
src/components/ordering/       kitchen-board.tsx (pergunta "Os ingredientes já foram usados?")
app/(app)/caixa/page.tsx, caixa/[id]/page.tsx, caixa/[id]/imprimir/page.tsx
app/(app)/caixa/contas/page.tsx, caixa/contas/[id]/page.tsx
tests/integration/billing/     conta, pagamentos, fechamento, corrida, isolamento, baixa, cancelamento
tests/e2e/                     billing.spec.ts, accessibility (Caixa)
```

## Ordem de entrega (vira `tasks.md`)

1. Domínio: totais e taxa, pagamento e troco, divisão, pode fechar; venda e cancelamento no livro;
   permissões com Caixa.
2. Migração, repositórios, isolamento.
3. US4 Baixa ao começar o preparo (independe da conta e fecha o ciclo do estoque) → US1 Conta e
   total → US2 Pagamento e fechamento → US3 Dividir → US5 Cancelamento com estoque → US6 Contas e
   resumo.
4. Docs (produto e sistema, permissões, decisões, roadmap) e e2e.

## Riscos

- **Pedido de antes da 011 sem conta**: ficam fora do caixa (só na consulta de pedidos). Aceito:
  a migração não inventa contas para o passado.
- **Ficha mal cadastrada gera saldo negativo cedo**: esperado e visível (destaque no item e
  Repor); a correção é o acerto da 004.
- **Transação do "Começar preparo" maior**: trava alguns itens por pedido; ordem fixa por id evita
  deadlock. Medir se a cozinha sentir demora.

## Complexity Tracking

Nenhuma violação.
