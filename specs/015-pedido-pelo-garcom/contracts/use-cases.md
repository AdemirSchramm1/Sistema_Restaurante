# Contratos: casos de uso, Server Actions e telas (feature 015)

Mesmo formato da [011](../../011-fechamento-conta-mesa/contracts/use-cases.md) e da
[014](../../014-fechamento-caixa/contracts/use-cases.md): a ação lê a sessão, monta o contexto,
chama o caso de uso (que faz `authorize` e grava auditoria `DENIED` quando nega), abre
`withTenantTx` e devolve `Result`. Dinheiro chega e sai como string decimal (`"68.00"`). O
restaurante vem sempre da sessão (FR-002, FR-015); nenhum caso de uso recebe `restaurantId`.

## Lançar pedido

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listTablesForStaff` | `order.place` | – | `{ qrOrdersOff: boolean, tables: { id, name, tab: null \| { id, openedAt, total }, readyCount }[] }` (ativas, ordem do nome) | – |
| `getStaffMenu` | `order.place` | `tableId` | `{ table: { id, name }, tab: null \| { id, total }, qrOrdersOff, showSectionTitles, sections: { id, name, products: StaffMenuProduct[] }[] }` | `NOT_FOUND`, `STAFF_TABLE_INACTIVE` (`{ tableName }`) |
| `placeStaffOrder` | `order.place` | `tableId`, `clientRequestId`, `tabIdSeen` (`uuid \| null`), `lines: { recipeId, quantity, unitPrice, addons: { addonId, times, unitPrice }[], removals: { kind, id }[], kitchenNote: string \| null }[]` | `{ orderId, number, total, tableName, previousTabClosed: boolean }` | `VALIDATION`, `NOT_FOUND`, `STAFF_TABLE_INACTIVE`, `EMPTY_ORDER`, `TOO_MANY_LINES`, `INVALID_QUANTITY`, `NOTE_TOO_LONG` (`lines.N.kitchenNote`), `PRODUCT_UNAVAILABLE`, os da escolha da 010 (`NOT_IN_PRODUCT`, `INVALID_ADDON_TIMES`, `DUPLICATE_OPTION`, `OPTION_UNAVAILABLE`), `PRICE_CHANGED` |
| `listTableOrders` | `order.place` | `tableId` | `{ table: { id, name }, tab: null \| { id, subtotal, serviceCharge, total, paid, remaining }, orders: { id, number, submittedAt, source, placedByName, status, total, version, canCancel, canDeliver, lines: { quantity, productName, changes, kitchenNote }[] }[] }` (mais novo primeiro) | `NOT_FOUND` |

`StaffMenuProduct` = `MenuProduct` da 013 (`id`, `name`, `price`, `description`, `photo`, `addons`,
`removables`) + `soldOut: boolean`. Esgotado vem no fim da seção, sem adicionais nem retiradas.

Notas de `placeStaffOrder`:

- Ordem das conferências: permissão → formato (`parseStaffOrderInput`, `strictObject`) → mesmo
  envio já gravado (`findStaffByClientRequest(ctx.userId, clientRequestId)` devolve o pedido, com
  `previousTabClosed` recalculado) → mesa existe e está ativa → `checkKitchenNote` por linha →
  `checkOrder(lines, catalog, 0)` → `saveOrder` (número do dia, conta, pedido, evento com
  `user_id`, `OPENED` com `user_id`) → auditoria `CREATE`.
- Não lê a chave "Recebendo pedidos pelo QR code", não conta pedidos do acesso, não exige acesso.
- `STAFF_TABLE_INACTIVE` → "A {mesa} foi inativada. Fale com o gerente." (não usa a mensagem
  `TABLE_INACTIVE` do cliente, que manda chamar o garçom).
- Usuário removido da equipe: `resolveContext` já devolve `null` e a ação responde "Sem acesso"; o
  carrinho fica no aparelho.

## Cancelar

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `cancelOrder` (009/011, muda) | `order.cancel` **ou** `order.cancel_own` (R6) | igual: `id`, `reason`, `note`, `version`, `ingredientsUsed?` | – | os de hoje + `FORBIDDEN` (pedido de outra pessoa ou do QR code, com auditoria `DENIED`), `KITCHEN_STARTED` ("A cozinha já começou. Peça ao chef ou ao gerente para cancelar.") |

`reason` aceita `ENTERED_BY_MISTAKE`. Com só `order.cancel_own`, `ingredientsUsed` é ignorado
(em Recebido nada saiu da prateleira).

## Mudanças em casos de uso existentes

| Caso de uso | Mudança |
|---|---|
| `submitOrder` (009) | Passa a gravar `source = QR` pelo ajudante `saveOrder`; o comportamento não muda. `kitchenNote` continua recusado na entrada (FR-016) |
| `listKitchenOrders` | Cada pedido traz `source`, `placedByName`; cada linha `kitchenNote` |
| `listReadyOrders` | Igual, mais `placedById`; entrada `{ onlyMine?: boolean }` |
| `listOrders` | Entrada `placedBy?: "QR" \| userId`; cada linha `source`, `placedByName`; saída ganha `summary: { source, placedById, name, count, total }[]` e `placedByOptions: { value, label }[]` |
| `getOrder` | `source`, `placedByName`; linhas com `kitchenNote`; o primeiro evento já vem com `userName` |
| `getTab`, `listTabs` (011) | Pedidos com `source`, `placedByName` e linhas com `kitchenNote`; evento `OPENED` com `userName` |

## Server Actions (`src/actions/staff-orders.ts`, novo)

| Ação | Chama | Depois |
|---|---|---|
| `placeStaffOrderAction(input)` | `placeStaffOrder` | `revalidatePath("/pedidos/lancar")` |
| `cancelOwnOrderAction(input)` | `cancelOrder` | `revalidatePath("/pedidos/lancar/[mesa]")` |
| `markDeliveredAction` | já existe (`kitchen.ts`) | também revalida a mesa |

As leituras (`listTablesForStaff`, `getStaffMenu`, `listTableOrders`) rodam nas páginas (Server
Components), como Cozinha e Garçom.

## Permissões (`src/domain/access/permissions.ts`)

| Ação | Gerente | Caixa | Garçom | Chef | Estoquista, Comprador, Administrativo |
|---|---|---|---|---|---|
| `order.place` (novo) | ✓ | ✓ | ✓ | | |
| `order.cancel_own` (novo) | ✓ | ✓ | ✓ | | |
| `order.cancel` | ✓ | | | ✓ | |

## Telas

| Endereço | Permissão | O que é |
|---|---|---|
| `/pedidos/lancar` (novo) | `order.place` | Grade de mesas ativas com busca; cada mesa: "Livre" ou "Ocupada · R$ 120,00 · há 35 min", "2 prontos", "Carrinho: 3 itens" (do aparelho). Aviso "O QR code está desligado: só a equipe lança pedidos." quando a chave está desligada. Atualiza a cada 10 s |
| `/pedidos/lancar/[mesa]` (novo) | `order.place` | Topo fixo "Mesa 12" + **Trocar mesa**; abas **Cardápio** e **Pedidos da mesa** (`?aba=pedidos`). Cardápio: busca no topo, modos **Fotos** / **Lista**, seções da 013, esgotados apagados com o selo. Tela do prato da 010 + **Observação para a cozinha** (contador "0/140"). Carrinho com **Limpar** e **Enviar pedido** → resumo "Conferir: Mesa 12" + total → **Confirmar** |
| `/pedidos/cozinha` (009) | `order.kitchen` | Cartão ganha "João" ou "QR code" embaixo da mesa e a observação em destaque por linha |
| `/pedidos/garcom` (009) | `order.deliver` | Quem lançou em cada pronto; filtro **Só os meus** (`?meus=1`) |
| `/pedidos` (009) | `order.read` | Filtro **Lançado por**, coluna "Lançado por", resumo por origem no fim |
| `/pedidos/[id]` (009) | `order.read` | "Lançado por João às 20:14"; observação nas linhas |
| `/caixa/[id]` e `/caixa/[id]/imprimir` (011) | `tab.read` | Origem por pedido, observação; histórico "Conta aberta por João (pedido 5)" |

Menu: **Lançar pedido** (ícone `NotebookPen`) na seção Operação, entre Cozinha e Garçom. `homeFor`
leva o garçom para `/pedidos/lancar`; caixa, chef e gerente continuam onde estão (R15).

## Mensagens novas (`src/components/forms/error-messages.ts`)

| Código | Texto |
|---|---|
| `STAFF_TABLE_INACTIVE` | "A {mesa} foi inativada. Fale com o gerente." |
| `KITCHEN_STARTED` | "A cozinha já começou. Peça ao chef ou ao gerente para cancelar." |
| `NOTE_TOO_LONG` (observação) | "A observação passa de 140 letras." |
| sem rede no envio | "Sem conexão. O pedido não foi enviado." (no componente, não vem do servidor) |
| `previousTabClosed` | "A conta anterior desta mesa foi fechada. Este pedido abriu uma conta nova." |
