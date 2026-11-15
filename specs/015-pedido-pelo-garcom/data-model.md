# Modelo de dados: 015 — Garçom lança o pedido da mesa

Migração `0015_staff_orders`. A `0014` é do caixa do dia (014); se a 015 for implementada antes,
os números trocam e a migração é renomeada no PR da implementação (o diário do Drizzle não aceita
buraco). Nenhuma tabela nova: só colunas, um índice, um valor de enum e o gatilho atualizado.

## `orders` (009) — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `source` | enum `order_source` (`QR`, `STAFF`) | Obrigatória. Pedidos que já existem viram `QR` (default só durante a migração) |
| `placed_by` | `uuid` → `users(id)` | Quem lançou. Preenchida só em `STAFF`; igual ao `created_by` do pedido |
| `menu_access_id` | `uuid` (muda para aceitar nulo) | Só no `QR` |

Checks:

- `orders_source_shape`: `(source = 'QR' and menu_access_id is not null and placed_by is null) or
  (source = 'STAFF' and menu_access_id is null and placed_by is not null)` (FR-006).

Índices:

- `orders_staff_client_request` único `(restaurant_id, placed_by, client_request_id) where source =
  'STAFF'` (envio sem duplicar, R2). O `orders_client_request` do QR code continua; com
  `menu_access_id` nulo ele não pega o pedido da equipe (nulos são distintos).
- `orders_placed_by` `(restaurant_id, placed_by, business_day) where source = 'STAFF'` (filtro
  "Lançado por" e "Só os meus").

Gatilho `orders_status_only` (009): a lista do que não pode mudar no `UPDATE` ganha `source`,
`placed_by` e `menu_access_id`.

## `order_lines` (009) — coluna nova

| Coluna | Tipo | Regra |
|---|---|---|
| `kitchen_note` | `text` nulo | Observação para a cozinha (FR-018). Check `order_lines_kitchen_note`: `char_length(kitchen_note) between 1 and 140`. Só o caso de uso da equipe preenche (R4). Só inserção, como a linha |

## `order_cancel_reason` (009) — valor novo

`ENTERED_BY_MISTAKE` ("Lançado errado"). `ALTER TYPE … ADD VALUE` fica em instrução própria da
migração; nada na mesma migração usa o valor.

## `order_status_events` (009)

Sem mudança de estrutura. O evento do envio (`from_status` nulo, `to_status = RECEIVED`) passa a ter
`user_id = placed_by` no pedido da equipe (FR-006); continua nulo no QR code.

## `tab_events` (011)

Sem mudança de estrutura. O `OPENED` gravado por pedido da equipe leva `user_id` de quem lançou
(o check `tab_events_user` já aceita) e `details = { orderId }` como hoje (FR-007).

## RLS, permissões do banco e auditoria

- As tabelas já têm RLS por `restaurant_id` (`0001_security`, `0009_ordering`); colunas novas
  herdam. `app_user` continua com `SELECT, INSERT` em `order_lines` e `order_status_events`.
- `audit_log`: o envio da equipe grava `entity = order`, `action = CREATE`,
  `changes = { source: STAFF, tableId, number, total }` com `user_id` e `origin`; o cancelamento
  grava como hoje; a negativa grava `DENIED` (FR-014).

## Tipos no código

| Onde | O que muda |
|---|---|
| `src/domain/ordering/order.ts` | `ORDER_SOURCES = ["QR", "STAFF"]`, `ORDER_SOURCE_LABELS` (`QR` → "QR code"; `STAFF` mostra o nome); `CANCEL_REASONS` + `ENTERED_BY_MISTAKE`; `cancelScope` (R6) |
| `src/domain/ordering/kitchen-note.ts` (novo) | `KITCHEN_NOTE_MAX = 140`, `checkKitchenNote` |
| `src/domain/ordering/checkout.ts` | `RequestedLine` e `PricedLine` ganham `kitchenNote: string \| null` (o cliente sempre manda `null`) |
| `src/domain/menu/staff-menu.ts` (novo) | `buildStaffMenu`, `StaffMenuRow = CustomerMenuRow & { soldOut: boolean }` |
| `src/domain/menu/search.ts` (novo) | `normalizeSearch`, `matchesSearch` |
| `src/application/ordering/ports.ts` | `OrderRecord` + `source`, `placedById`, `placedByName`; `OrderLineView` + `kitchenNote`; `NewOrder` vira união `{ source: "QR", menuAccessId } \| { source: "STAFF", placedBy }`; `OrderFilter` + `placedBy?: "QR" \| string`; `OrderRepo` + `findStaffByClientRequest(placedBy, clientRequestId)`, `summaryBySource(filter)`, `staffTables()` |
| `src/infra/db/schema/ordering.ts` | `orderSourceEnum`, colunas e índices acima |

## Carrinho do garçom (só no aparelho)

Não é banco. `localStorage`, chave `garcom:v1:<restaurantId>:<userId>:<tableId>` (R10):

| Campo | Regra |
|---|---|
| `lines` | `CartLineData[]` da 009/010 + `kitchenNote` |
| `clientRequestId` | uuid do envio em curso; troca depois de enviar ou limpar |
| `tabIdSeen` | conta aberta quando a mesa foi aberta (R11) |
| `savedAt` | descartado com mais de 12 horas |

Apagado ao enviar com sucesso, ao tocar **Limpar** e ao **Sair**; chaves de outro usuário ou
restaurante são apagadas ao abrir **Lançar pedido**.

## Estados do pedido

Não mudam (009): Recebido → Em preparo → Pronto → Entregue; Cancelado de qualquer não final. O que
muda é **quem** pode cancelar em Recebido:

| Situação | Gerente, chef (`order.cancel`) | Quem lançou (`order.cancel_own`) | Outra pessoa da equipe |
|---|---|---|---|
| Recebido | ✓ | ✓ (só pedido `STAFF` dele) | – (`FORBIDDEN`) |
| Em preparo, Pronto | ✓ (com "ingredientes usados?", 011) | – (`KITCHEN_STARTED`) | – |
| Entregue, Cancelado | – | – | – |
