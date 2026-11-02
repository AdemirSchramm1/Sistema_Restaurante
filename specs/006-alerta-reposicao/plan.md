# Plano técnico: 006 — Alerta de reposição e gráficos do estoque

**Branch**: `claude/project-thread-fb5wm0` | **Data**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Resumo

Duas colunas novas no item (`reorder_point`, `par_level`), domínio puro de reposição
(`reorder.ts`) e de gráficos (`stock-report.ts`), um repositório só de leitura (`reports`) com
consultas agregadas e duas páginas (`/estoque/repor`, `/estoque/graficos`). Barras feitas com
`<div>` e largura em %, renderizadas no servidor. Nenhuma dependência nova.

## Constituição

| Princípio | Como a 006 cumpre |
|---|---|
| I. Testes primeiro | `test(006)` antes de cada `feat(006)`: domínio, integração, componentes, e2e |
| II. Domínio puro | `reorder.ts` e `stock-report.ts` sem banco nem data atual (recebem `now`) |
| III. Livro imutável | Só leitura do livro; estornos e estornados ficam fora das saídas |
| IV. Precisão | Decimal em todas as contas; largura das barras calculada em decimal e arredondada só no fim |
| V. Rastreabilidade | Mudança do aviso vai para a auditoria do item; permissão `item.reorder` |
| VI. Docs vivas | 08-ciclo, 09-permissões, 10-indicadores, 13-decisões, modelo de dados, regras de cálculo, glossário, plano de testes |
| VII. Simplicidade | Sem biblioteca de gráfico, sem cache, sem tabela nova |

## Modelo de dados (migração `0007_reorder_levels`)

```text
items  + reorder_point numeric(14,4) null, par_level numeric(14,4) null
       checks: reorder_point >= 0; par_level só com reorder_point e par_level > reorder_point
```

## Consultas (repositório `reports`, só leitura)

- `reorderRows()`: itens ativos com ponto, saldo, embalagem do item e o fornecedor preferido
  (nome, telefone, prazo, dias de entrega, embalagem dele).
- `countReorder()`: `count(*)` dos itens no ponto (menu).
- `outflowByItem(from, to)`: por item ativo, soma das saídas (quantidade e R$) e o saldo.
- `outflowByReason(from, to)`: soma das saídas em R$ por motivo.
- `weeklyTotals(from, to, timezone)`: entradas (compras não estornadas) e saídas por semana.
- `inflowTotal(from, to)`: compras não estornadas em R$.
- Filtro comum de saída: `quantity < 0 and type <> 'REVERSAL' and not exists (estorno dela)`.
  Índice `stock_movements_item (restaurant_id, item_id, created_at)` já cobre o volume previsto.

## Decisões

- **Campos digitados, sistema sugere**: sem a 005, o consumo é quase só perda; uma conta
  automática obrigatória daria números sem sentido. O usuário digita e pode usar a sugestão.
- **Ordem por R$**: quantidades de medidas diferentes não se somam nem se comparam.
- **"Menos saíram"** inclui itens ativos com estoque e nenhuma saída (aparecem como "parado").
- **Menu com contador**: uma consulta `count` leve por página; vale pelo aviso sempre visível.
- **Período por link** (`?dias=7|30|90`): sem JavaScript no navegador.

## Arquivos

```text
src/domain/inventory/        reorder.ts, stock-report.ts (+ testes)
src/domain/access/           permissions.ts (item.reorder)
src/application/inventory/   reorder.ts, stock-report.ts, reorder-input.ts
src/infra/db/                schema/catalog.ts, migrations/0007_reorder_levels.sql, repositories/report-repository.ts
src/actions/                 reorder.ts
src/components/reports/      bar-list.tsx, weekly-bars.tsx
src/components/items/        reorder-levels.tsx
app/(app)/estoque/           repor/page.tsx, graficos/page.tsx; itens (selo), itens/[id] (quadro); layout (menu)
```
