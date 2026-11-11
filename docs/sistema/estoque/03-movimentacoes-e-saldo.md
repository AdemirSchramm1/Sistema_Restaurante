# Estoque — Movimentações e saldo

Princípio III da constituição: **o saldo é a soma do livro.** Este documento descreve como o código
garante isso.

> **Implementado na feature 004:** `PURCHASE`, `LOSS`, `ADJUSTMENT` (só via pedido aprovado) e
> `REVERSAL`. Migração `0005_stock_ledger`; casos de uso em
> `src/application/inventory/movements.ts`.
>
> **Feature 011:** `SALE_RECIPE` (venda pelo pedido), migração `0011_tabs`, casos de uso em
> `src/application/inventory/sales.ts`. Ver [venda pelo pedido](#venda-pelo-pedido-feature-011). Os
> outros tipos desta tabela ainda não existem.

## Tipos de movimentação

| `MovementType` | # no manual | Linhas geradas | Altera custo médio? |
|---|---|---|---|
| `PURCHASE` | 1 | +destino | Sim |
| `BONUS` | 2 | +destino | Sim (custo zero ou reposição) |
| `SUPPLIER_RETURN` | 3 | −origem | Não (sai pelo custo médio) |
| `INTERNAL_TRANSFER` | 4 | −origem, +destino | Não |
| `UNIT_TRANSFER` | 5 | −origem, +trânsito; depois −trânsito, +destino | Não |
| `PRODUCTION` | 6 | −cada ingrediente, +sub-receita | Sim, na sub-receita (custo = soma dos ingredientes ÷ rendimento real) |
| `SALE_RECIPE` | 7 | −cada item do consumo do pedido (uma linha por item) | Não |
| `SALE_RESALE` | 8 | −item | Não |
| `LOSS` | 9 | −origem | Não |
| `STAFF_MEAL` | 10 | −origem | Não |
| `COMPLIMENTARY` | 11 | −origem | Não |
| `TASTING_DONATION` | 12 | −origem | Não |
| `ADJUSTMENT` | 13 | ±local | Não |
| `REVERSAL` | – | Inverso da original | Recalcula se a original alterou |

## Fluxo de escrita

```text
Server Action
  → valida entrada (Zod) e permissão (papel + segregação)
  → caso de uso: registerMovement(cmd, deps)
       1. carrega item(s), saldo(s) e custo médio  (SELECT ... FOR UPDATE nas linhas de saldo)
       2. domínio: converte unidade, valida regras, calcula custo e novas linhas
       3. INSERT em stock_movements (todas as linhas da operação, mesmo group_id)
       4. UPDATE stock_balances e items.average_cost / last_cost
       5. INSERT em audit_log
     tudo em UMA transação
```

- **Concorrência:** `lockItem` cria a linha de saldo se faltar (`ON CONFLICT DO NOTHING`) e trava
  item e saldo com `SELECT … FOR UPDATE` antes de calcular, o que evita duas
  saídas simultâneas calcularem sobre o mesmo saldo. Teste de integração dispara operações em
  paralelo e confere o saldo final.
- **Idempotência:** cada comando traz um `idempotency_key` (gerado no cliente); índice único evita
  lançamento duplicado em reenvio de formulário ou rede instável.

- **Fornecedor na compra (feature 007):** opcional. O caso de uso confere que o fornecedor existe
  e não está bloqueado (`SUPPLIER_BLOCKED`). A medida `SUPPLIER_PACKAGE` busca a embalagem do
  fornecedor para o item em `supplier_items` e entra no domínio como embalagem com quantidade. O
  preço cadastrado em `supplier_items` não muda com a compra.

## Correção de erros

Nada de `UPDATE`/`DELETE` em movimentações. Para corrigir:

1. Lançar `REVERSAL` apontando para a original (`reverses_id`), com motivo.
2. Lançar a movimentação correta.

Uma movimentação só pode ser estornada uma vez (índice único em `reverses_id`).

## Saldo negativo

- Saídas operacionais (perda, acerto para menos, estorno): bloqueadas se o saldo ficaria negativo
  (`INSUFFICIENT_STOCK`).
- Venda (`SALE_RECIPE`) e perda "Pedido cancelado" (011): **nunca bloqueadas**, porque o pedido não
  pode parar. O item mostra o saldo negativo com o aviso, e Repor conta o negativo como zero. Como
  não há contagem de estoque (decisão de novembro de 2026), a correção é a compra que faltou ou um
  **acerto manual** com aprovação.

## Venda pelo pedido (feature 011)

```text
cozinha: RECEIVED → PREPARING (changeStatus, order.kitchen)
  → recordOrderSale(orderId), na MESMA transação da mudança de situação
       1. consumo do pedido (consumptionFor → orderConsumption da 010, pelas cópias do envio)
       2. para cada item, em ordem de id: lockItem (SELECT … FOR UPDATE)
       3. domínio: planSale(item, quantidade) — 4 casas, custo médio do momento, sem bloqueio
       4. writeMovement: SALE_RECIPE com order_id, sem motivo; atualiza stock_balances
  → se qualquer passo falhar, nem a baixa nem a mudança de situação ficam
```

- **Uma vez por pedido**: só a transição `RECEIVED → PREPARING` baixa; a trava otimista do pedido e
  o índice `stock_movements_sale_once` garantem que dois toques ou duas telas não baixam duas vezes.
- Quantidade que arredonda para zero em 4 casas (`INVALID_QUANTITY`) não vira linha.
- Custo médio nulo (item nunca comprado) sai com custo zero; a venda não muda o custo médio.
- Venda não se estorna à mão: `planReversal` recusa com `REVERSE_VIA_ORDER` ("cancele o pedido na
  cozinha").

Cancelar depois do preparo (`cancelOrder` com `ingredientsUsed`, mesma transação):

```text
reverseOrderSale(orderId, ingredientsUsed)
  para cada venda do pedido (salesForOrder), em ordem de item: lockItem
    planCancelledSale → REVERSAL "Pedido cancelado" (+ a quantidade, reverses_id = venda)
                      → se usados: LOSS "Pedido cancelado" (− a mesma quantidade e custo, order_id)
```

Estorno e perda saem com o custo da venda, não o de agora, e não são barrados por saldo: com
"Sim" o saldo final é o mesmo de antes do cancelamento; com "Não" volta ao de antes do preparo.
Dois cancelamentos ao mesmo tempo: um recebe `STALE_RECORD` (trava do pedido) e o índice único de
`reverses_id` impede estorno duplo.

## Reconstrução e verificação

- `rebuildBalances(restaurantId)` recalcula `stock_balances` a partir do livro.
- Teste de integração (propriedade): após qualquer sequência aleatória de movimentações válidas,
  `stock_balances` = soma de `stock_movements` por item e local.

## Acerto manual

Sem contagem de estoque, a diferença entre o sistema e a prateleira é corrigida por um **acerto com
aprovação** (decisão do dono, spec 004 US3):

1. `requestAdjustment`: quem lança informa quanto tem de verdade e o motivo; grava em
   `adjustment_requests` o saldo do sistema e a diferença. O livro não muda.
2. `decideAdjustment`: um gerente que **não** seja quem pediu (`SELF_APPROVAL`; check
   `adjustment_requests_other_decider` no banco) aprova ou recusa. Aprovar insere `ADJUSTMENT` com a
   diferença do pedido, `created_by` = quem pediu e `approved_by` = quem aprovou.
3. `cancelAdjustment`: quem pediu cancela enquanto está pendente.

## Auditoria

`audit_log`: `actor_id`, `action`, `entity`, `entity_id`, `payload_before`, `payload_after`, `at`,
`ip`, `user_agent`. Para cadastros (itens, fornecedores, fichas) guarda o antes/depois; para
movimentações basta a referência, pois o livro já é imutável.
