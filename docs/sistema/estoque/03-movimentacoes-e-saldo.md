# Estoque — Movimentações e saldo

Princípio III da constituição: **o saldo é a soma do livro.** Este documento descreve como o código
garante isso.

## Tipos de movimentação

| `MovementType` | # no manual | Linhas geradas | Altera custo médio? |
|---|---|---|---|
| `PURCHASE` | 1 | +destino | Sim |
| `BONUS` | 2 | +destino | Sim (custo zero ou reposição) |
| `SUPPLIER_RETURN` | 3 | −origem | Não (sai pelo custo médio) |
| `INTERNAL_TRANSFER` | 4 | −origem, +destino | Não |
| `UNIT_TRANSFER` | 5 | −origem, +trânsito; depois −trânsito, +destino | Não |
| `PRODUCTION` | 6 | −cada ingrediente, +sub-receita | Sim, na sub-receita (custo = soma dos ingredientes ÷ rendimento real) |
| `SALE_RECIPE` | 7 | −cada insumo da ficha | Não |
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

- **Concorrência:** `SELECT … FOR UPDATE` nas linhas de `stock_balances` envolvidas evita duas
  saídas simultâneas calcularem sobre o mesmo saldo. Teste de integração dispara operações em
  paralelo e confere o saldo final.
- **Idempotência:** cada comando traz um `idempotency_key` (gerado no cliente); índice único evita
  lançamento duplicado em reenvio de formulário ou rede instável.

## Correção de erros

Nada de `UPDATE`/`DELETE` em movimentações. Para corrigir:

1. Lançar `REVERSAL` apontando para a original (`reverses_id`), com motivo.
2. Lançar a movimentação correta.

Uma movimentação só pode ser estornada uma vez (índice único em `reverses_id`).

## Saldo negativo

- Saídas operacionais (perda, transferência, devolução): bloqueadas se o saldo ficaria negativo.
- Vendas (`SALE_*`): *(a decidir na feature 004)* — proposta: permitir e gerar alerta, porque o
  pedido não pode parar. Como não há contagem de estoque (decisão de novembro de 2026), a correção
  é um **acerto manual** com motivo, feito pelo gerente.

## Reconstrução e verificação

- `rebuildBalances(restaurantId)` recalcula `stock_balances` a partir do livro.
- Teste de integração (propriedade): após qualquer sequência aleatória de movimentações válidas,
  `stock_balances` = soma de `stock_movements` por item e local.

## Acerto manual

Sem contagem de estoque, a diferença entre o sistema e a prateleira é corrigida por um **acerto
manual**: o gerente informa a quantidade certa e o motivo, e o sistema insere uma movimentação
`ADJUSTMENT` com a diferença. Detalhes na spec da feature 004.

## Auditoria

`audit_log`: `actor_id`, `action`, `entity`, `entity_id`, `payload_before`, `payload_after`, `at`,
`ip`, `user_agent`. Para cadastros (itens, fornecedores, fichas) guarda o antes/depois; para
movimentações basta a referência, pois o livro já é imutável.
