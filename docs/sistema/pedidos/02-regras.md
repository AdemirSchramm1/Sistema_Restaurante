# Pedidos — Regras (domínio)

Funções puras em `src/domain/ordering/`, testadas em unidade. Dinheiro em `Decimal`.

## Acesso de 20 minutos — `menu-access.ts`

| Regra | Função |
|---|---|
| Fecha em `abertura + 20 min` (`MENU_ACCESS_MINUTES`) | `accessExpiresAt` |
| Aberto: sem `ended_at` e `agora ≤ expires_at` | `isAccessOpen` |
| Envio aceito até `expires_at + 15 s` (`SUBMIT_GRACE_SECONDS`) | `canSubmitWith` |
| Aviso "Faltam 2 minutos" só com algo no carrinho (`WARN_SECONDS = 120`) | `shouldWarn` |

A tela conta a partir de `serverNow` e `expiresAt` vindos do servidor; o relógio do celular só mede
quanto passou desde que a página carregou.

## Cardápio — `menu.ts`

Produto aparece se `kind = DISH`, ativo, com preço de venda e `sold_out_on ≠ hoje` (`isOnMenu`).
Ordem alfabética sem diferenciar maiúsculas e acentos (`buildMenu`). "Hoje" é o dia local do
restaurante (`businessDay(agora, fuso)`).

## Forma do pedido — `order-lines.ts`

- Quantidade inteira de 1 a 20 (`MAX_LINE_QUANTITY`); até 30 linhas (`MAX_LINES`, `TOO_MANY_LINES`).
- Até 10 pedidos por acesso (`MAX_ORDERS_PER_ACCESS`, `ACCESS_ORDER_LIMIT`).
- Total = Σ(preço unitário × quantidade) (`orderTotal`).

## Conferência do envio — `checkout.ts`

`checkOrder(linhas pedidas, catálogo de agora)` devolve as linhas com preço ou:

| Erro | Quando | `details` |
|---|---|---|
| `PRODUCT_UNAVAILABLE` | Produto fora do cardápio | `recipeIds`, `addonIds` |
| `OPTION_UNAVAILABLE` | Adicional ou retirada que o produto não oferece mais | ids do que saiu |
| `INVALID_ADDON_TIMES` | Vezes fora de 1 a `max_times` | |
| `PRICE_CHANGED` | Preço do produto ou de um adicional diferente do que o celular viu | preços novos por produto e adicional |

O celular corrige o carrinho com os `details` e pede nova confirmação.

## Preço da linha (010) — `customization.ts`

- `priceLine`: `unitPrice = basePrice + Σ(addon.price × times)`; total da linha = `unitPrice × quantity`.
- Escolha válida (`validateChoice`): adicional ligado ao produto, ativo, com componente
  ativo, `1 ≤ times ≤ max_times`, sem repetir; retirada que está no quadro e cujo componente existe
  na versão mais nova, sem repetir.
- Quadro do produto (`validateCustomizationConfig`): até 10 adicionais e 10 retiradas (`TOO_MANY_OPTIONS`),
  `max_times` 1 a 5, texto até 40 (padrão `defaultRemovalLabel`: "Sem cebola").
- Texto da cozinha (`describeChanges`): "+ {vezes} {nome}" na ordem do produto, depois
  "SEM {resto}" das retiradas.

## Situações — `order.ts`

- `checkTransition`: só `RECEIVED → PREPARING → READY → DELIVERED`, um passo por vez
  (`INVALID_ORDER_TRANSITION`). `DELIVERED` e `CANCELLED` são finais.
- `checkCancel`: de qualquer situação não final, com motivo da lista; `OTHER` pede nota de 1 a 140
  (`CANCEL_NOTE_REQUIRED`, `NOTE_TOO_LONG`).
- `isLate`: `RECEIVED` ou `PREPARING` há mais de 20 minutos (`LATE_MINUTES`).

## Consumo da linha (010) — `consumption.ts`

`lineConsumption({ versionLines, removed, addons, quantity }, grafo, itens)`:

1. tira da ficha da versão do envio as linhas cujo componente foi retirado;
2. explode o resto em itens (preparos viram seus itens, pelo rendimento);
3. soma cada adicional × vezes (explodido do mesmo jeito);
4. multiplica tudo pela quantidade.

Devolve `Map<itemId, Decimal>` na medida do item. Na aplicação, `orderConsumption(deps,
restaurantId, orderId)` lê as cópias gravadas no pedido (`order_lines`, `order_line_addons`,
`order_line_removals`) e soma as linhas; a feature 005 lança isso como saída do estoque.

Exemplo da spec: 2 × X-Burger (pão 1 un, carne 150 g, queijo 30 g, cebola 20 g) + 2 Fatia de
queijo (20 g) sem cebola → pão 2 un, carne 0,3 kg, queijo 0,14 kg, nenhuma cebola.

## Envio sem duplicar e número do dia (aplicação, `submit-order.ts`)

1. Acesso pelo cookie; `ACCESS_EXPIRED` se fechado (com a tolerância de 15 s).
2. Mesa ativa (`TABLE_INACTIVE`) e chave ligada (`ORDERING_PAUSED`).
3. Mesmo `(acesso, clientRequestId)` já gravado → devolve o mesmo pedido.
4. `checkOrder` com o catálogo de agora.
5. Num savepoint: reserva o número do dia em `order_day_counters` e insere pedido, linhas,
   adicionais, retiradas e o evento `→ RECEIVED`. Se outro envio igual ganhou a corrida (índice
   `orders_client_request`), relê e devolve o pedido dele.
