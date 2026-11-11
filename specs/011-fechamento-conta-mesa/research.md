# Pesquisa: 011 — Fechar a conta da mesa e baixar o estoque pelos pedidos

Cada decisão no formato: decisão, motivo e alternativas. As três perguntas da spec já foram
decididas pelo dono (tabela "Decisões" da [spec](spec.md)); aqui ficam as escolhas técnicas.

## R1. Conta da mesa: uma aberta por mesa, aberta pelo primeiro pedido

- **Decisão**: tabela `table_tabs` com `status` (`OPEN`, `CLOSED`) e índice único parcial
  `(restaurant_id, table_id) where status = 'OPEN'`. O `submitOrder` da 009, na mesma transação do
  pedido, faz `INSERT … ON CONFLICT DO NOTHING` da conta aberta, lê a conta com
  `SELECT … FOR UPDATE`, grava `orders.tab_id` e soma 1 em `table_tabs.version`. Pedidos antigos
  (antes da 011) ficam com `tab_id` nulo; pedido novo sempre tem conta (check pela data da
  migração não é necessário: o caso de uso sempre preenche, e o teste de integração confere).
- **Motivo**: o banco garante "no máximo uma conta aberta" (FR-001) mesmo com dois celulares
  enviando ao mesmo tempo; a trava na linha da conta serializa envio e fechamento (caso-limite
  "pedido no mesmo instante do fechamento").
- **Alternativas**: conta aberta à mão pelo garçom (o dono quer que nada mude para o cliente e a
  cozinha); conta calculada só por período entre fechamentos, sem tabela (não daria para reabrir
  nem guardar a taxa e quem fechou).

## R2. Fechar sem perder pedido que chegou junto

- **Decisão**: "Fechar conta" manda o `version` da conta que a tela mostrou. O caso de uso trava a
  conta (`FOR UPDATE`), confere `version` (`STALE_RECORD` → "A conta mudou. Confira de novo."),
  recalcula o total no domínio, confere falta = 0 e nenhum pedido em aberto, e só então grava
  `CLOSED`. Como o envio de pedido soma 1 no `version` da conta, um pedido que entrou depois da
  tela carregada derruba o fechamento; um pedido que chega depois do fechamento abre conta nova.
- **Motivo**: SC-003 (nenhum pedido fora de conta ou em conta fechada) sem fila nem trava longa.
- **Alternativas**: bloquear envios da mesa durante o fechamento (trava visível ao cliente);
  fechar e mover pedidos atrasados para a próxima conta (confunde o caixa).

## R3. Pagamentos imutáveis

- **Decisão**: `tab_payments` só inserção (gatilho `app_reject_change`): forma, valor, recebido e
  troco (só dinheiro), `client_request_id` único por conta (toque duplo devolve o mesmo
  pagamento). "Tirar pagamento" insere em `tab_payment_removals` (`payment_id` único), com quem e
  quando. Pago = soma dos pagamentos sem remoção.
- **Motivo**: mesma linha do livro de estoque (princípio III aplicado a dinheiro): nada some, o
  histórico explica cada centavo, e o resumo por forma de pagamento (US6) é uma soma simples.
- **Alternativas**: coluna `removed_at` com `UPDATE` (quebra o "só inserção"); apagar o pagamento
  (perde rastreabilidade, princípio V).

## R4. Dinheiro, troco e o limite do "falta"

- **Decisão**: valores em `numeric(12,2)` e `decimal.js`. No domínio (`checkPayment`): valor > 0,
  no máximo 2 casas; nas formas que não são dinheiro, valor ≤ falta (`PAYMENT_EXCEEDS_REMAINING`);
  em dinheiro, `received ≥ valor`, `amount = min(received, falta)` e `change = received − amount`.
  O caso de uso recalcula o falta com a conta travada, então dois caixas não passam do total.
- **Motivo**: FR-003 e SC-005 (nunca pago diferente do total); o troco fica registrado para
  conferir a gaveta depois.

## R5. Taxa de serviço

- **Decisão**: `restaurants.service_charge_rate numeric(5,2) null default 10.00` (nulo =
  desligada; 0 a 20). A conta copia a porcentagem quando abre (`table_tabs.service_rate`), então
  mudar a configuração vale para as contas abertas dali em diante e a conta fechada guarda a sua.
  `table_tabs.service_waived boolean` (tirar e pôr de volta), com evento em `tab_events`.
  Taxa = `round(subtotal × rate / 100, 2, ROUND_HALF_UP)` em `serviceCharge()`.
- **Motivo**: FR-014; arredondamento num ponto só, definido na spec (princípio IV).
- **Alternativas**: taxa por linha (centavos diferentes do que o cliente calcula); porcentagem lida
  na hora do fechamento (a conta mudaria de valor no meio do atendimento).

## R6. Dividir em partes iguais

- **Decisão**: função pura `splitEvenly(remaining, people)` (2 a 20): parte = falta ÷ pessoas
  truncada em centavos; os centavos que sobram vão para a **primeira** parte. Nada é gravado: a
  tela guarda o número de pessoas e preenche o valor do próximo pagamento. Refaz sobre o falta a
  cada pagamento.
- **Motivo**: decisão Q2 do dono; soma das partes sempre igual ao falta (caso-limite).
- **Alternativas**: gravar a divisão (complexidade sem uso: a divisão muda toda hora).

## R7. Baixa do estoque ao começar o preparo

- **Decisão**: `advanceOrderStatus` para `PREPARING` chama, **na mesma transação**, o consumo do
  pedido (o `orderConsumption` da 010 vira `consumptionFor(repos, orderId)`, que roda dentro da
  transação existente) e grava uma movimentação `SALE_RECIPE` por item: quantidade negativa na
  medida do item, `unit_cost` = custo médio do momento (zero se o item nunca foi comprado),
  `order_id` de referência, `occurred_at` = hora da mudança, `created_by` = quem tocou. Os itens
  são travados em ordem de id (evita deadlock entre duas cozinhas). Índice único parcial
  `(order_id, item_id) where type = 'SALE_RECIPE'` impede baixa dupla mesmo se a transição falhar
  ao meio. Domínio: `planSale(item, quantity)` sem a checagem de saldo.
- **Motivo**: decisão Q1 do dono; princípio III (o saldo continua sendo a soma do livro) e
  FR-006/FR-007. Mesma transação: ou o pedido muda de situação e baixa, ou nada acontece.
- **Alternativas**: baixa em segundo plano depois da mudança (pode falhar sem ninguém ver);
  uma movimentação por linha do pedido (mais linhas sem ganho: o consumo já soma por item).

## R8. Saldo negativo só para venda

- **Decisão**: `SALE_RECIPE` e a perda "Pedido cancelado" (R9) não passam pela checagem
  `INSUFFICIENT_STOCK`. Compra, perda comum, acerto e estorno continuam com ela. O item com saldo
  negativo aparece em destaque na lista e na página (texto, não só cor) e conta como "Acabou" na
  tela Repor (006).
- **Motivo**: "o pedido não pode parar" (proposta da 004, confirmada na spec, FR-007).

## R9. Cancelamento depois do preparo

- **Decisão**: `cancelOrder` ganha `ingredientsUsed?: boolean`, obrigatório quando o pedido está
  `PREPARING` ou `READY` (`INGREDIENTS_USED_REQUIRED`). Para cada `SALE_RECIPE` do pedido grava um
  `REVERSAL` (motivo novo "Pedido cancelado", família Estorno); se usados, grava também `LOSS` com o
  mesmo item, quantidade e custo (motivo novo "Pedido cancelado", família Erro na operação) e
  `order_id`. Tudo na transação do cancelamento.
- **Motivo**: FR-008: nada é apagado; a saída passa de venda para perda, e os gráficos e o CMV
  distinguem as duas.
- **Alternativas**: deixar a venda como está (o cancelado viraria venda, distorcendo o CMV teórico);
  só a perda, sem estorno (contaria a saída duas vezes).

## R10. Papel Caixa e permissões

- **Decisão**: `CASHIER` no enum `role`, rótulo "Caixa". Ações novas: `tab.read` (gerente, caixa,
  garçom), `tab.pay` (registrar e tirar pagamento, tirar a taxa, fechar: gerente, caixa),
  `tab.history` (contas fechadas e resumo: gerente, caixa), `tab.reopen` (gerente),
  `tab.settings` (taxa de serviço: gerente). O caixa também ganha `order.read`. A baixa usa a
  permissão que já existe (`order.kitchen`).
- **Motivo**: FR-010; o menu já é filtrado por permissão (R8 da 009).

## R11. Atualização e impressão

- **Decisão**: a tela Caixa e a conta usam o `auto-refresh` da 009 (consulta a cada 5 s). A conta
  impressa é uma página própria com CSS de impressão, como a folha de QR codes.
- **Motivo**: SC "pedido novo aparece na conta em até 10 s" sem tempo real (princípio VII).

## R12. Cardápio aberto quando a conta fecha

- **Decisão**: fechar a conta grava `ended_at` e `end_reason = 'TAB_CLOSED'` nos acessos ao
  cardápio abertos naquela mesa (coluna nova `menu_accesses.end_reason`: `RESCAN`, `TAB_CLOSED`).
  O envio com acesso assim encerrado devolve `TAB_CLOSED` ("Esta conta foi fechada. Escaneie o QR
  code da mesa para pedir de novo.").
- **Motivo**: US2-7: o próximo cliente da mesa não herda o cardápio aberto do anterior.
