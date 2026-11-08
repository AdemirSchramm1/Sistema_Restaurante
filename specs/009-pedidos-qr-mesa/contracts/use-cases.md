# Contratos: casos de uso e Server Actions (feature 009)

Mesmo formato da [001](../../001-cadastros-base/contracts/use-cases.md): ações da equipe leem a
sessão, montam o contexto no servidor, chamam o caso de uso (que faz `assertCan` e grava auditoria
`DENIED` quando nega), abrem `withTenantTx` e devolvem `Result`. Dinheiro chega e sai como string
decimal. As ações públicas estão em [public-routes.md](public-routes.md).

## Mesas e QR codes

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listTables` | `table.manage` | `includeInactive?` | `{ id, name, active, version }[]` em ordem natural ("2" antes de "10") | – |
| `createTable` | `table.manage` | `name` | `{ id }` | `INVALID_TABLE_NAME`, `TABLE_NAME_IN_USE` |
| `createTablesInRange` | `table.manage` | `from`, `to` (inteiros 1–999, `to − from < 200`) | `{ created, skipped }` | `INVALID_RANGE` |
| `renameTable` | `table.manage` | `id`, `name`, `version` | – | `INVALID_TABLE_NAME`, `TABLE_NAME_IN_USE`, `STALE_RECORD`, `NOT_FOUND` |
| `setTableActive` | `table.manage` | `id`, `active`, `version` | – | `TABLE_NAME_IN_USE` (ao reativar), `STALE_RECORD`, `NOT_FOUND` |
| `rotateTableQr` | `table.manage` | `id`, `version` | – | `STALE_RECORD`, `NOT_FOUND` |
| `tableQrCodes` | `table.manage` | `ids?` (vazio = todas as ativas) | `{ id, name, url, svg }[]` + nome do restaurante | – |
| `setAcceptingQrOrders` | `ordering.toggle` | `accepting`, `version` | – | `STALE_RECORD` |

`tableQrCodes` monta a URL com o token atual da mesa
([research R1](../research.md#r1-link-do-qr-code-e-como-achar-o-restaurante-sem-login)).

## Cozinha, garçom e consulta

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listKitchenOrders` | `order.kitchen` | – | pedidos `RECEIVED`/`PREPARING`/`READY` mais antigos primeiro: `{ id, number, tableName, submittedAt, status, late, version, lines: { quantity, productName, note }[] }` + `serverNow` | – |
| `advanceOrderStatus` | `order.kitchen` | `id`, `to` (`PREPARING` ou `READY`), `version` | – | `INVALID_ORDER_TRANSITION`, `STALE_RECORD`, `NOT_FOUND` |
| `listReadyOrders` | `order.deliver` | – | pedidos `READY`: `{ id, number, tableName, readyAt, lines }` | – |
| `markDelivered` | `order.deliver` | `id`, `version` | – | `INVALID_ORDER_TRANSITION`, `STALE_RECORD`, `NOT_FOUND` |
| `cancelOrder` | `order.cancel` | `id`, `reason`, `note?`, `version` | – | `INVALID_ORDER_TRANSITION`, `CANCEL_NOTE_REQUIRED`, `NOTE_TOO_LONG`, `STALE_RECORD`, `NOT_FOUND` |
| `listOrders` | `order.read` | `from`, `to` (dias locais, até 31), `tableId?`, `status?` | `{ id, number, businessDay, tableName, submittedAt, status, total }[]` | `INVALID_PERIOD` |
| `getOrder` | `order.read` | `id` | pedido com linhas e eventos de situação (quem, quando, motivo) | `NOT_FOUND` |
| `setProductSoldOut` | `product.sold_out` | `recipeId`, `soldOut` | – | `NOT_A_DISH`, `NOT_FOUND` |

`STALE_RECORD` na cozinha aparece como "Este pedido mudou em outra tela" e a tela recarrega.
`setProductSoldOut` não usa trava otimista: o último clique vale (é um interruptor do dia).

## Permissões novas (`src/domain/access/permissions.ts`)

| Ação | Gerente | Chef | Garçom |
|---|---|---|---|
| `table.manage` | ✓ | | |
| `ordering.toggle` | ✓ | | |
| `order.kitchen` | ✓ | ✓ | |
| `order.cancel` | ✓ | ✓ | |
| `product.sold_out` | ✓ | ✓ | |
| `order.deliver` | ✓ | ✓ | ✓ |
| `order.read` | ✓ | ✓ | ✓ |

Estoquista, comprador e administrativo não ganham nada. O garçom não tem `catalog.read`.

## Auditoria

| Operação | `entity` | Campos |
|---|---|---|
| Mesa criada, renomeada, inativada, reativada | `dining_table` | `name`, `active` |
| QR code trocado | `dining_table` | `qrRotatedAt` (o token não vai para a auditoria) |
| Chave de pedidos | `restaurant` | `acceptingQrOrders` |
| Esgotado | `recipe` | `soldOutOn` |
| Mudança de situação e cancelamento | `order_status_events` (já é a trilha) | – |

