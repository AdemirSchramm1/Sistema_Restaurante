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
- `checkCancel(de, motivo, nota, ingredientsUsed)`: de qualquer situação não final, com motivo da
  lista; `OTHER` pede nota de 1 a 140 (`CANCEL_NOTE_REQUIRED`, `NOTE_TOO_LONG`). Depois do preparo
  (`leftTheShelf`: `PREPARING` ou `READY`, o estoque já baixou) exige dizer se os ingredientes foram
  usados (`INGREDIENTS_USED_REQUIRED`, campo `ingredientsUsed`; 011).
- `isLate`: `RECEIVED` ou `PREPARING` há mais de 20 minutos (`LATE_MINUTES`).

## Consumo da linha (010) — `consumption.ts`

`lineConsumption({ versionLines, removed, addons, quantity }, grafo, itens)`:

1. tira da ficha da versão do envio as linhas cujo componente foi retirado;
2. explode o resto em itens (preparos viram seus itens, pelo rendimento);
3. soma cada adicional × vezes (explodido do mesmo jeito);
4. multiplica tudo pela quantidade.

Devolve `Map<itemId, Decimal>` na medida do item. Na aplicação, `orderConsumption(deps,
restaurantId, orderId)` lê as cópias gravadas no pedido (`order_lines`, `order_line_addons`,
`order_line_removals`) e soma as linhas; desde a 011 isso sai do estoque como venda quando o pedido
passa para `PREPARING` (ver [estoque/03](../estoque/03-movimentacoes-e-saldo.md#venda-pelo-pedido-feature-011)).

Exemplo da spec: 2 × X-Burger (pão 1 un, carne 150 g, queijo 30 g, cebola 20 g) + 2 Fatia de
queijo (20 g) sem cebola → pão 2 un, carne 0,3 kg, queijo 0,14 kg, nenhuma cebola.

## Envio sem duplicar e número do dia (aplicação, `submit-order.ts`)

1. Acesso pelo cookie; `ACCESS_EXPIRED` se fechado (com a tolerância de 15 s).
2. Mesa ativa (`TABLE_INACTIVE`) e chave ligada (`ORDERING_PAUSED`).
3. Mesmo `(acesso, clientRequestId)` já gravado → devolve o mesmo pedido.
4. `checkOrder` com o catálogo de agora.
5. Conta da mesa (011): `tabs.openForOrder` insere a conta com `ON CONFLICT DO NOTHING` no índice
   `table_tabs_one_open`; se já existe, trava a aberta (`FOR UPDATE`) e soma 1 na `version`. A conta
   nova copia `restaurants.service_charge_rate` e ganha o evento `OPENED`.
6. Num savepoint: reserva o número do dia em `order_day_counters` e insere pedido (com `tab_id`),
   linhas, adicionais, retiradas e o evento `→ RECEIVED`. Se outro envio igual ganhou a corrida
   (índice `orders_client_request`), relê e devolve o pedido dele.

Acesso encerrado com `end_reason = TAB_CLOSED` (a conta da mesa fechou) devolve `TABLE_TAB_CLOSED`
no envio e no cardápio, antes de olhar a hora: o celular mostra "Esta conta foi fechada. Escaneie o
QR code da mesa para pedir de novo."

## Conta da mesa (011) — `src/domain/billing/`

| Regra | Função |
|---|---|
| Subtotal = Σ pedidos não cancelados; total = subtotal + taxa; pago = Σ pagamentos não tirados; falta = total − pago | `tabTotals` |
| Taxa = subtotal × % ÷ 100, em centavos, meio centavo para cima; zero se a taxa é nula ou foi tirada | `serviceCharge` |
| Taxa do restaurante: nula (desligada) ou 0 a 20 com até 2 casas (`INVALID_RATE`); padrão 10 | `checkServiceRate`, `DEFAULT_SERVICE_RATE` |
| Pagamento: forma da lista, valor `> 0` com até 2 casas (`INVALID_AMOUNT`), nunca acima do que falta (`PAYMENT_EXCEEDS_REMAINING`, `details.remaining`); recebido só em dinheiro, `≥` valor (`RECEIVED_TOO_LOW`); troco = recebido − valor | `checkPayment` |
| Dividir: 2 a 20 pessoas (`INVALID_PEOPLE`); partes truncadas em centavos e a sobra na 1ª | `splitEvenly` |
| Fechar só com falta zero (`REMAINING_NOT_ZERO`, `details.remaining`) e nenhum pedido em `RECEIVED`, `PREPARING`, `READY` (`PENDING_ORDERS`, `details.pending`); a tela mostra todos os motivos de uma vez | `checkClose`, `closeBlockers` |
| Motivo da reabertura: 1 a 140 depois de `trim` (`REASON_REQUIRED`, `NOTE_TOO_LONG`, campo `reason`) | `checkReopenReason` |
| Resumo das contas fechadas: por forma (na ordem da lista, sem as vazias), taxa e total | `closedSummary` |

Falta negativa ("Pago a mais") só acontece quando um pedido é cancelado depois de pago: a conta não
fecha (`REMAINING_NOT_ZERO`) até tirar o pagamento a mais.

## Conta da mesa (011) — aplicação, `src/application/billing/`

- Toda escrita na conta (`addPayment`, `removePayment`, `setServiceWaived`, `closeTab`,
  `reopenTab`) trava a conta (`tabs.lock`, `SELECT … FOR UPDATE`) e recalcula os totais depois da
  trava: duas telas pagando nunca passam do total.
- Toque duplo: `addPayment` procura o `clientRequestId` depois da trava e devolve o mesmo pagamento.
- Trava otimista (`version`) em `setServiceWaived`, `closeTab` e `reopenTab` (`STALE_RECORD`: "A conta
  mudou. Confira de novo."). Pagamento, pagamento tirado e cancelamento de pedido somam 1 na
  `version` (`tabs.touch`), assim como o envio de pedido.
- `setServiceWaived`: só com taxa (`NO_SERVICE_CHARGE`); tirar é recusado se o pago passaria do total
  sem a taxa (`PAYMENT_EXCEEDS_REMAINING`, `details.total` e `details.paid`).
- `closeTab`: grava `closed_*` e os valores, encerra os acessos ao cardápio abertos da mesa
  (`menuAccesses.endOpenForTable`, `end_reason = TAB_CLOSED`) e grava o evento `CLOSED`.
- `reopenTab` (`tab.reopen`): só conta fechada (`TAB_NOT_CLOSED`); volta para `OPEN` num savepoint e
  traduz o índice `table_tabs_one_open` em `TABLE_HAS_OPEN_TAB`. O evento `REOPENED` guarda o motivo e
  os valores de antes.
- `getTab`: `tab.read`; conta fechada também pede `tab.history` (o garçom não abre conta fechada).
  `listTabs` (`tab.history`): período de até 31 dias (`checkPeriod`, `INVALID_PERIOD`) por
  `closed_day`, mesa opcional.
- Id malformado (conta, pagamento) devolve `NOT_FOUND`, sem chegar ao banco.
- Auditoria (`entity = 'table_tab'`): `paymentAdded`, `paymentRemoved`, `serviceWaived`, `status`
  (fechar e reabrir, com `reason`); taxa do restaurante em `entity = 'restaurant'`
  (`serviceChargeRate`).

## Caixa do dia (014) — `src/domain/cash/`

| Regra | Função |
|---|---|
| Esperado = troco + dinheiro recebido no turno − dinheiro de outro turno tirado neste + reforços − sangrias; pode ser negativo | `expectedCash`, `sessionSummary` |
| Recebido por forma = lançados no turno − tirados no próprio turno; pagamento tirado num turno seguinte fica no de origem | `receivedByMethod` |
| Conta passo a passo do relatório | `steps` |
| Abrir: troco ≥ 0 com 2 casas; troco diferente do `previous_kept` pede observação (`OPENING_NOTE_REQUIRED`) | `checkOpening` |
| Sangria: valor > 0, motivo da lista, observação obrigatória em `OTHER`, nunca acima do esperado (`WITHDRAWAL_EXCEEDS_EXPECTED`, `details.expected`) | `checkWithdrawal` |
| Reforço: valor > 0; tirar reforço não pode deixar o esperado negativo (`EXPECTED_WOULD_BE_NEGATIVE`) | `checkSupply`, `checkSupplyRemoval` |
| Contagem: ≥ 0, 2 casas; com cédulas, a soma bate com o contado (`DENOMINATIONS_MISMATCH`) | `checkCount`, `sumDenominations` |
| Fechar: diferença = contado − esperado; com diferença, observação (`NOTE_REQUIRED`); `0 ≤ fica ≤ contado` (`KEPT_ABOVE_COUNTED`) | `closingResult`, `outcomeOf` |
| Vendas: ordem por valor e parte em % com 1 casa somando 100,0 | `salesShares` |
| Planilha: `;`, BOM, `\r\n`, vírgula decimal, apóstrofo antes de `=`, `+`, `-`, `@` | `toCsv` |

## Caixa do dia (014) — aplicação, `src/application/cash/`

- Ordem das travas: **conta → turno**. `addPayment` e `removePayment` travam a conta, depois o turno
  aberto (`cashSessions.lockOpen`); sem turno → `CASH_SESSION_REQUIRED` (`details.action`: `remove`
  muda o texto). Gravam `cash_session_id` e somam 1 na versão do turno.
- `closeTab` grava o turno aberto sem travá-lo. Conta de R$ 0,00 fecha sem turno.
- `openCashSession`: o índice único decide quem abriu; quem perde recebe `CASH_SESSION_ALREADY_OPEN`
  com quem e quando.
- `addCashEntry` trava o turno e confere o esperado depois da trava: duas sangrias ao mesmo tempo
  nunca passam do esperado. `removeCashEntry` só no turno aberto (`CASH_SESSION_CLOSED`).
- `countCash(sessionId, …)` grava a contagem com a versão do turno e só então devolve esperado e
  diferença; não soma versão. `closeCashSession(sessionId, …)` usa a última contagem
  (`COUNT_REQUIRED`, `COUNT_OUTDATED`) e grava o retrato. Quem abriu ou `cash.close_any`.
- `getCurrentCashSession` (`tab.read`): o esperado só sai do servidor com `cash.expected`.
  `getCashSessionReport` (`cash.history`): no turno aberto, o esperado só para o gerente ou depois
  de uma contagem gravada.
- `salesReport` (`sales.report`): turnos (`sessionRows`), vendas (`sales.ofPeriod`, duas consultas)
  e fuso numa transação só; o número de idas ao banco não cresce com os pedidos.
- Auditoria (`entity = 'cash_session'`): `opened`, `entryAdded`, `entryRemoved`, `counted`, `closed`.
