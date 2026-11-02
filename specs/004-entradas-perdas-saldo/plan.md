# Plano técnico: 004 — Compras, perdas e saldo

**Branch**: `claude/project-thread-8lg7o1` | **Data**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Resumo

Livro `stock_movements` só de inserção, projeção `stock_balances` e motivos `movement_reasons`
(lista fechada global). Domínio puro para custo médio, sinal e validação de saldo. Mesma stack;
nenhuma dependência nova.

## Constituição

| Princípio | Como a 004 cumpre |
|---|---|
| I. Testes primeiro | `test(004)` antes de cada `feat(004)`: domínio, integração (inclui propriedade saldo = livro), formulário, e2e |
| II. Domínio puro | `average-cost.ts`, `movement.ts` sem banco; data e ids por parâmetro |
| III. Livro imutável | `app_user` só `SELECT, INSERT` em `stock_movements`; gatilho `app_reject_change`; estorno único por `reverses_id` |
| IV. Precisão | `numeric(14,4)` em quantidade e custo unitário, `numeric(14,2)` no total; conversão só por `units.ts` |
| V. Rastreabilidade | Quem lançou e quando em cada linha; tentativa negada na auditoria; acerto pedido por um e aprovado por outro gerente |
| VI. Docs vivas | 06-movimentacoes, 02-cadastro (custo), 13-decisões, modelo de dados, 03-movimentações, glossário |
| VII. Simplicidade | Saldo único por item (sem local), quatro tipos, motivos globais (sem cadastro por restaurante) |

## Modelo de dados (migração `0005_stock_ledger`)

```text
movement_reasons  id, movement_type, code, label, family, position   (global, só leitura)
stock_movements   id, restaurant_id, type, item_id, quantity (com sinal), entered_quantity,
                  entered_unit (texto: "kg" ou "Caixa"), unit_cost, total_cost, reason_id null,
                  notes, occurred_at, recorded_at, recorded_by, reverses_id null unique,
                  idempotency_key unique por restaurante
                  check: perda/acerto/estorno têm motivo; compra tem quantidade > 0
stock_balances    restaurant_id, item_id (pk), quantity, updated_at
adjustment_requests  id, restaurant_id, item_id, counted_quantity, system_quantity, difference,
                  reason_id, notes, status (PENDING | APPROVED | REJECTED | CANCELLED),
                  requested_by/at, decided_by/at, decision_notes, movement_id null,
                  version (trava otimista)
                  check: decided_by <> requested_by
```

- `items.average_cost` vira `numeric(18,8)`; com `last_cost` e `cost_updated_at` passa a ser escrito pela compra.
- `items.stock_unit_locked_at` é preenchido na primeira movimentação.
- Concorrência: `SELECT … FOR UPDATE` na linha do item (cria o saldo com `INSERT … ON CONFLICT`
  antes de travar), assim duas saídas simultâneas não passam do saldo.

## Decisões

- **Valor total pago** na compra (é o que está na nota); custo unitário = total ÷ quantidade na
  medida do item, guardado com 4 casas.
- **Motivos globais** semeados na migração (iguais para todos os restaurantes) — sem tela de
  cadastro de motivo.
- **Acerto com aprovação** (decisão do dono): o pedido guarda a quantidade certa, o saldo do
  sistema e a diferença; a aprovação lança a diferença do pedido. Segregação no domínio
  (`SELF_APPROVAL`) e no banco (check `decided_by <> requested_by`).
- **Estorno de compra** recalcula o custo médio: (saldo × médio − qtd × custo) ÷ (saldo − qtd);
  saldo restante zero mantém o médio.
- Telas: `/estoque/lancamentos` (formulário com tipo + lista com filtro e "Estornar"), saldo na
  lista de itens e quadro "Estoque" na página do item.

## Arquivos

```text
src/domain/inventory/        average-cost.ts, movement.ts (+ testes)
src/domain/access/           permissions.ts (movement.purchase, movement.loss, movement.adjust, movement.reverse)
src/application/inventory/   movements.ts, movement-input.ts
src/infra/db/                schema/ledger.ts, migrations/0005_stock_ledger.sql, movement-repository.ts
src/actions/                 movements.ts
src/components/movements/    movement-form.tsx, movement-table.tsx (com Estornar)
app/(app)/estoque/           lancamentos/page.tsx; itens (saldo); itens/[id] (quadro Estoque)
```

## Riscos

- Concorrência no saldo: coberta por teste de integração com saídas em paralelo.
- Data do fato no passado com custo médio: o custo médio é calculado na ordem do lançamento
  (não reprocessa o passado). Documentado; reprocessamento fica fora.
