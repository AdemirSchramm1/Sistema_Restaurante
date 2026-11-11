# Contratos: casos de uso e Server Actions (feature 011)

Mesmo formato da [009](../../009-pedidos-qr-mesa/contracts/use-cases.md): a ação lê a sessão,
monta o contexto, chama o caso de uso (que faz `assertCan` e grava auditoria `DENIED` quando nega),
abre `withTenantTx` e devolve `Result`. Dinheiro chega e sai como string decimal.

## Caixa

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listOpenTabs` | `tab.read` | – | `{ id, tableName, openedAt, total, pendingOrders, version }[]` por mesa + `serverNow` | – |
| `getTab` | `tab.read`; conta fechada também `tab.history` (gerente e caixa) | `id` | conta com pedidos (linhas, `changes`, situação, motivo se cancelado), `subtotal`, `serviceRate`, `serviceWaived`, `serviceCharge`, `total`, `paid`, `remaining`, pagamentos (com tirados), eventos, `canClose`, `blockers` (`REMAINING_NOT_ZERO`, `PENDING_ORDERS`), `version` | `NOT_FOUND` |
| `addPayment` | `tab.pay` | `tabId`, `method`, `amount`, `received?` (só `CASH`), `clientRequestId` | `{ paymentId, change }` | `INVALID_AMOUNT`, `PAYMENT_EXCEEDS_REMAINING`, `RECEIVED_TOO_LOW`, `TAB_CLOSED`, `NOT_FOUND` |
| `removePayment` | `tab.pay` | `tabId`, `paymentId` | – | `ALREADY_REMOVED`, `TAB_CLOSED`, `NOT_FOUND` |
| `setServiceWaived` | `tab.pay` | `tabId`, `waived`, `version` | – | `NO_SERVICE_CHARGE`, `PAYMENT_EXCEEDS_REMAINING` (ver nota), `STALE_RECORD`, `TAB_CLOSED` |
| `closeTab` | `tab.pay` | `tabId`, `version` | – | `STALE_RECORD` ("A conta mudou. Confira de novo."), `REMAINING_NOT_ZERO`, `PENDING_ORDERS`, `TAB_CLOSED`, `NOT_FOUND` |
| `reopenTab` | `tab.reopen` | `tabId`, `reason`, `version` | – | `REASON_REQUIRED`, `NOTE_TOO_LONG`, `TABLE_HAS_OPEN_TAB`, `STALE_RECORD`, `NOT_FOUND` |
| `listTabs` | `tab.history` | `from`, `to` (dias locais, até 31), `tableId?` | contas fechadas `{ id, tableName, openedAt, closedAt, total, serviceCharge, closedBy }[]` + resumo `{ byMethod: { method, amount }[], serviceCharge, total }` | `INVALID_PERIOD` |
| `getServiceChargeSettings` / `setServiceChargeRate` | `tab.read` / `tab.settings` | `rate` (0–20, até 2 casas) ou `null`, `version` | – | `INVALID_RATE`, `STALE_RECORD` |

Notas:

- `setServiceWaived(false)` (pôr a taxa de volta) só aumenta o total; nunca deixa o pago acima do
  total. `setServiceWaived(true)` pode deixar o pago acima do novo total: nesse caso é recusado
  com `PAYMENT_EXCEEDS_REMAINING` e a tela pede para tirar um pagamento antes.
- Dividir a conta não tem caso de uso: `splitEvenly` roda na tela sobre o `remaining` de `getTab`.
- `closeTab` encerra os acessos ao cardápio abertos da mesa (`end_reason = TAB_CLOSED`).

## Mudanças em casos de uso da 009

| Caso de uso | Mudança |
|---|---|
| `submitOrder` (público) | Abre ou acha a conta aberta da mesa, grava `tab_id`, soma 1 no `version` da conta. Acesso encerrado por fechamento devolve `TAB_CLOSED` |
| `advanceOrderStatus` para `PREPARING` | Na mesma transação: consumo do pedido e uma `SALE_RECIPE` por item. Erro novo possível: `CONSUMPTION_FAILED` (componente da versão sumiu; não deve acontecer, pois versões são imutáveis) |
| `cancelOrder` | Entrada nova `ingredientsUsed?: boolean`, obrigatória em `PREPARING`/`READY` (`INGREDIENTS_USED_REQUIRED`). Estorna cada `SALE_RECIPE` e, se usados, lança a perda "Pedido cancelado" |

## Permissões novas (`src/domain/access/permissions.ts`)

| Ação | Gerente | Caixa | Garçom | Chef |
|---|---|---|---|---|
| `tab.read` | ✓ | ✓ | ✓ | |
| `tab.pay` | ✓ | ✓ | | |
| `tab.history` | ✓ | ✓ | | |
| `tab.reopen` | ✓ | | | |
| `tab.settings` | ✓ | | | |
| `order.read` (009) | ✓ | ✓ (novo) | ✓ | ✓ |

## Auditoria

| Operação | Onde |
|---|---|
| Pagamento, pagamento tirado, taxa tirada e posta, fechamento, reabertura | `tab_events` (já é a trilha) + `audit_log` com `entity = table_tab` |
| Taxa de serviço do restaurante | `audit_log`, `entity = restaurant`, `serviceChargeRate` |
| Saída por venda, estorno e perda do cancelamento | `stock_movements` + `audit_log` (como na 004) |
