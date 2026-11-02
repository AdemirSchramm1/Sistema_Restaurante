# Plano técnico: 008 — Painel de custo dos produtos

**Branch**: `claude/project-thread-tx99is` | **Data**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Resumo

Uma coluna nova no produto (`sale_price`), domínio puro `product-cost.ts` (custo no preço, faixa,
sobra, o que mais pesa, ordem e resumo) e `usesItem` em `recipe-graph.ts`, um caso de uso de
leitura que monta o painel a partir do que a 003 já calcula, uma página `/estoque/custos`, o quadro
"Preço de venda" no produto e "Usado nos produtos" no item. Nenhuma dependência nova.

## Constituição

| Princípio | Como a 008 cumpre |
|---|---|
| I. Testes primeiro | `test(008)` antes de cada `feat(008)`: domínio, integração, componentes e e2e, todos vistos vermelhos pela asserção |
| II. Domínio puro | `product-cost.ts` sem banco nem data; recebe custos e preços |
| III. Livro imutável | Só leitura do custo médio; o preço fica no produto, não na versão |
| IV. Precisão | Decimal em toda conta; % arredondada só na tela (1 casa) |
| V. Rastreabilidade | Preço com trava otimista e auditoria; permissão `recipe.write` |
| VI. Docs vivas | 04-fichas, 10-indicadores, 13-decisões, visão geral, modelo de dados, regras de cálculo, glossário, plano de testes |
| VII. Simplicidade | Sem tabela nova, sem cache, sem biblioteca de gráfico; calcula na hora |

## Modelo de dados (migração `0008_sale_price`)

```text
recipes + sale_price numeric(12,2) null
        checks: sale_price > 0; sale_price só com kind = 'DISH'
```

## Casos de uso

- `setRecipeSalePrice(id, version, price | null)`: `recipe.write`, produto vendido, trava
  otimista, auditoria `salePrice`.
- `listProductCosts()`: produtos vendidos ativos (versão mais nova), grafo de preparos e custo
  médio dos itens numa leitura; `recipeCost` por produto; ordena e resume no domínio.
- `itemUsage(itemId)`: produtos ativos cuja versão mais nova usa o item (via `usesItem`), com custo
  e % do preço.
- Repositório: `recipes.activeWithLatest()` (produtos ativos com a versão mais nova e o preço) e
  `recipes.setSalePrice(...)`; `get` passa a trazer `salePrice`.

## Decisões

- **Preço no produto, não na versão**: preço muda por decisão comercial, não pelo que vai no prato;
  fica na auditoria.
- **Barra pela % do preço** (escala fixa 0–100%), não pelo maior valor: "30% do preço" se lê
  direto, e a marca dos 35% mostra a faixa.
- **Faixa só em três níveis** para ser lida de primeira; o manual diz que não há meta universal
  (até 40% à la carte), por isso 35–40% é "atenção", não "alto".
- **O que mais pesa por linha** (não por ingrediente explodido): é o nome que a pessoa vê no
  produto (ex.: "Molho de tomate").

## Arquivos

```text
src/domain/inventory/        product-cost.ts (+ teste), recipe-graph.ts (usesItem)
src/application/inventory/   product-costs.ts, recipe-input.ts (parseSalePriceForm)
src/infra/db/                schema/catalog.ts, migrations/0008_sale_price.sql, repositories/recipe-repository.ts
src/actions/                 recipes.ts (setSalePriceAction)
src/components/costs/        product-cost-table.tsx, cost-share-bar.tsx, item-usage.tsx
src/components/recipes/      sale-price.tsx
app/(app)/estoque/           custos/page.tsx; produtos/[id] (quadro); itens/[id] (quadro); layout (menu)
```
