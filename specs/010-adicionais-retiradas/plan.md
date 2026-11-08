# Plano técnico: 010 — Adicionar e tirar ingredientes por botão

**Branch**: `claude/project-thread-qmc5hs` | **Data**: 2026-11-08 | **Spec**: [spec.md](spec.md)

## Resumo

Constrói em cima do [plano da 009](../009-pedidos-qr-mesa/plan.md) e é implementada junto com ela.
Entra um cadastro de **adicionais** (item ou preparo + quantidade + preço), a lista do que cada
produto vendido pode adicionar e tirar, e o pedido passa a guardar essas escolhas em vez da
observação livre. Regras novas em `src/domain/ordering/customization.ts` (escolha válida, preço da
linha, texto para a cozinha) e `consumption.ts` (o que a linha consome, para a 005), reaproveitando
`explode` e `recipeCost` da 003. Nenhuma dependência nova.

## Contexto técnico

| Item | Valor |
|---|---|
| Base | Mesma stack e decisões da 009 (Next.js 16, PostgreSQL, Drizzle, Vitest, Playwright) |
| Dependências novas | Nenhuma |
| Migração | `0010_addons` (depois da `0009_ordering`) |
| Desempenho | O cardápio continua numa requisição: 200 produtos com até 20 opções cada |
| Restrições | Preço em decimal; opções do pedido imutáveis depois do envio; só gerente muda preço |

Nenhum ponto em aberto: o dono decidiu "só botões, sem texto livre" em 2026-11-08.

## Constituição

| Princípio | Como a 010 cumpre |
|---|---|
| I. Testes primeiro | `test(010)` antes de cada `feat(010)`; a regra de consumo tem os exemplos da spec como testes nomeados |
| II. Domínio puro | `customization.ts` e `consumption.ts` sem banco; recebem produto, opções, preços e o grafo da 003 |
| III. Livro imutável | Adicionais e retiradas do pedido são só inserção, como as linhas da 009. Não mexe no estoque (é a 005) |
| IV. Precisão | Preço do adicional `numeric(12,2)`, quantidade `numeric(14,4)`; preço da linha somado em decimal |
| V. Rastreabilidade | Adicional com trava otimista e auditoria; mudanças do quadro "Adicionar e tirar" no histórico do produto; permissões novas `addon.write` e `addon.read` |
| VI. Docs vivas | 009 atualizada neste PR (contratos e modelo sem observação); docs de produto e sistema de pedidos no PR da implementação; glossário já agora |
| VII. Simplicidade | Preço único por adicional; sem grupos obrigatórios; retirada presa ao componente, não à linha |

Sem violação.

## Decisões principais

Detalhes em [research.md](research.md).

- **R1 Retirada presa ao componente** (item ou preparo do produto), não ao id da linha: a 003 cria
  linhas novas a cada versão, e "Sem cebola" deve sobreviver a uma versão nova que ainda tem
  cebola. Se o componente sai da versão mais nova, a retirada some do cardápio e o quadro avisa.
- **R2 Adicional reaproveita a linha de produto**: `{ component, quantity, unit }` igual a
  `RecipeLineData`, validado pelas mesmas regras (`compatibleUnits`, quantidade > 0, até 4 casas).
  Custo do adicional = `recipeCost` de uma linha só.
- **R3 Preço zero permitido** só para adicional ("Grátis"); preço de venda do produto continua > 0.
- **R4 Pedido guarda cópia**: cada adicional da linha guarda nome, vezes, preço, componente,
  quantidade e medida no envio; cada retirada guarda o componente e o texto do botão. Mudar o
  adicional depois não muda o pedido nem o que a 005 vai baixar.
- **R5 Preço da linha calculado no domínio** e conferido no envio: o cliente manda o preço que viu
  (produto + adicionais); diferença devolve `PRICE_CHANGED` com os preços novos, como na 009.
- **R6 Consumo da linha** = `explode(linhas da versão sem os componentes retirados) +
  Σ explode(adicional) × vezes`, tudo × quantidade. Fica pronto e testado; a 005 só chama.
- **R7 Quadro do produto salva de uma vez**: a lista inteira (adicionais com máximo e retiradas
  com texto) é trocada numa transação, com a trava otimista do produto (`STALE_RECORD`) e um
  registro de auditoria com antes e depois. Não cria versão do produto.

## Modelo de dados (migração `0010_addons`)

Detalhe em [data-model.md](data-model.md).

```text
addons                 name, name_normalized, item_id | sub_recipe_id, quantity, unit_id,
                       price (≥ 0), active                                  + editable
recipe_addons          recipe_id, addon_id, max_times (1..5), position
recipe_removables      recipe_id, item_id | sub_recipe_id, label, position
order_line_addons      order_line_id, addon_id, name, times, unit_price,
                       item_id | sub_recipe_id, quantity, unit_id           (só inserção)
order_line_removals    order_line_id, item_id | sub_recipe_id, label        (só inserção)
order_lines (009)      − note; unit_price passa a ser produto + adicionais;
                       + base_price (preço do produto no envio)
```

## Casos de uso

Contrato em [contracts/use-cases.md](contracts/use-cases.md).

- Gerente: `createAddon`, `updateAddon`, `setAddonActive`, `setProductCustomization`.
- Gerente e chef: `listAddons`, `getAddon` (com custo e faixa), `getProductCustomization`.
- Público (estende a 009): `getMenu` traz as opções de cada produto; `submitOrder` recebe as
  escolhas por linha.
- Domínio para a 005: `lineConsumption`.

## Estrutura

```text
src/domain/ordering/          customization.ts (+ teste), consumption.ts (+ teste)
src/domain/access/            permissions.ts (+ addon.write, addon.read)
src/application/ordering/     addons.ts, customization.ts, submit-order.ts (escolhas), menu.ts
src/infra/db/                 schema/ordering.ts, migrations/0010_addons.sql,
                              repositories/addon-repository.ts, ordering-repository.ts
src/actions/                  addons.ts, recipes.ts (quadro), menu.ts
src/components/ordering/      addon-form.tsx, product-customization.tsx, dish-options.tsx (celular),
                              line-changes.tsx (texto "+ 2 Fatia de queijo · SEM cebola")
app/(app)/pedidos/adicionais/ page.tsx, novo/page.tsx, [id]/page.tsx
app/(app)/estoque/produtos/[id] quadro "Adicionar e tirar"
tests/integration/ordering/   adicionais, quadro do produto, envio com escolhas, isolamento
tests/e2e/                    ordering.spec.ts (+ personalizar no celular, ver na cozinha)
```

## Ordem de entrega

1. Domínio: escolha válida, preço da linha, texto da cozinha, consumo (com o exemplo da spec).
2. Migração e repositórios.
3. US1 Adicionais → US2 Quadro do produto → US3 Cardápio com botões (junto com a US2 da 009) →
   US4 Cozinha e garçom → US5 Consumo.

## Riscos

- **Componente repetido**: um produto pode ter o mesmo preparo em duas versões com quantidades
  diferentes; a retirada tira o componente inteiro da versão vigente, o que é o esperado ("Sem
  molho").
- **Tela do prato no celular** com muitas opções: limitar a 10 adicionais e 10 retiradas por produto
  (domínio, `TOO_MANY_OPTIONS`).

## Complexity Tracking

Nenhuma violação.
