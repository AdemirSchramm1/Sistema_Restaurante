# Estoque — Regras de cálculo (domínio)

Funções puras em `src/domain/inventory/`. Cada uma lista a fonte de produto e os **casos de teste
obrigatórios** (vêm dos exemplos do manual). Todas operam com decimal exato.

## Medida e embalagem — `units.ts`, `item.ts`

```ts
convert(qty: Decimal, from: Unit, to: Unit): Result<Decimal>          // só dentro da mesma família
toStockUnit(qty: Decimal, purchaseFactor: Decimal): Result<Decimal>  // embalagens → medida do item
describePurchase({ purchaseUnitLabel, purchaseFactor, stockUnit })  // "1 Caixa = 20 kg"
```

Fonte: [02-cadastro-de-itens](../../produto/estoque/02-cadastro-de-itens.md). Desde a feature 002 o
item tem uma medida só; não há unidade de receita nem conversão do item entre famílias.

| Caso | Entrada | Esperado |
|---|---|---|
| Caixa com 12 | 20 caixas, 12 un cada | 240 un |
| Massa | 1,5 kg → g | 1500 g |
| Volume | 1000 ml → l | 1 l |
| Famílias diferentes | kg → un | erro `UNIT_DIMENSION_MISMATCH` |
| Frase da embalagem | Caixa, 20, kg | "1 Caixa = 20 kg" |

## Custo médio ponderado — `average-cost.ts`

```ts
applyPurchase(current: {qty, avgCost}, purchase: {qty, unitCost}): {qty, avgCost}
```

Fórmula: (qtd × custo atual + qtd compra × custo compra) ÷ (qtd + qtd compra). Saídas **não**
alteram o custo médio. Fonte: [02-cadastro-de-itens](../../produto/estoque/02-cadastro-de-itens.md#custo-do-item).

| Caso | Entrada | Esperado |
|---|---|---|
| Exemplo do manual | 10 un a R$ 20 + 20 un a R$ 25 | R$ 23,3333… (exibe 23,33) |
| Estoque zerado | 0 un + 5 un a R$ 10 | R$ 10 |
| Bonificação custo zero | 10 un a R$ 20 + 10 un a R$ 0 | R$ 10 |
| Saldo negativo antes da entrada | −2 un + 10 un a R$ 5 | custo = custo da compra |
| Estorno de compra | 70 kg a 3,857… − 60 kg a R$ 4 | volta a R$ 3 (`removePurchase`) |
| Estorno que zera o saldo | 60 kg a R$ 4 − 60 kg a R$ 4 | mantém R$ 4 |

Arredondamento (spec 004, FR-008): custo unitário da movimentação com 4 casas, total com 2, custo
médio com 8 (`items.average_cost numeric(18,8)`). Planejamento das linhas em `movement.ts`
(`planPurchase`, `planLoss`, `planAdjustmentRequest`, `checkAdjustmentDecision`,
`planAdjustmentApproval`, `planReversal`).

## Fornecedores — `cnpj.ts`, `supplier.ts` (feature 007)

**CNPJ** (`isValidCnpj`): 14 caracteres, os 12 primeiros `0-9A-Z` e os 2 últimos dígitos. Cada
caractere vale o código ASCII − 48 (0–9 → 0–9, A → 17 … Z → 42). Dígito: soma dos valores × pesos
(5,4,3,2,9,8,7,6,5,4,3,2 no primeiro; 6,5,4,3,2,9,8,7,6,5,4,3,2 no segundo) módulo 11; resto < 2 →
0, senão 11 − resto. Todos iguais é inválido. O mesmo cálculo serve para o CNPJ só de números.

| Caso | CNPJ | Esperado |
|---|---|---|
| Numérico | 11.222.333/0001-81 | válido |
| Dígito errado | 11.222.333/0001-80 | `INVALID_CNPJ` |
| Alfanumérico (exemplo da Receita) | 12.ABC.345/01DE-35 | válido |

**Preço por medida** (`pricePerUnit`): preço ÷ quantidade da embalagem; sem embalagem, o próprio
preço. Exato (decimal); a tela mostra 2 casas. **Mais barato** (`cheapestOffer`): menor preço por
medida entre duas ou mais ofertas; empate fica com a primeira.

| Oferta | Preço por medida |
|---|---|
| Caixa de 18 kg a R$ 90,00 | R$ 5,00/kg |
| Solto a R$ 4,80/kg | R$ 4,80/kg (mais barato) |

Compra na embalagem do fornecedor: `planPurchase` recebe `{ packageLabel, packageQuantity }` como
medida; 2 caixas de 18 kg = 36 kg.

## Tolerância de custo na entrada

`isCostOutOfTolerance(lastCost, newCost, tolerancePct): boolean` — |novo − último| ÷ último >
tolerância. Caso: último 10,00, novo 10,60, tolerância 5% → `true`; novo 10,40 → `false`.

## Produtos e preparos — `recipe.ts`, `recipe-graph.ts`

Fonte: [04-fichas-tecnicas](../../produto/estoque/04-fichas-tecnicas.md). Feature 003.

```ts
validateRecipe(data, lookup, { previous, selfId, graph })  // nome, rendimento, linhas, medidas, ciclo
compatibleUnits(unit)                                      // g/kg, ml/l, un
checkSubRecipeChange(current, next | null, usedBy)          // preparo em uso (RECIPE_IN_USE)
hasVersionChanges(current, next)                            // rendimento ou linhas mudaram?
versionAt(versions, at)                                     // versão vigente na data
findCycle(selfId, lines, graph)                             // caminho do ciclo ou null
explode(lines, times, graph, items)                         // itens e quantidades na medida do item
recipeCost(lines, graph, items)                             // custo por linha e total (via explode)
```

Linha de preparo: quantidade convertida para a medida do rendimento ÷ rendimento = fração do
preparo; cada ingrediente do preparo entra multiplicado por essa fração (recursivo).

| Caso | Entrada | Esperado |
|---|---|---|
| Medida da linha | carne em kg, linha em un | `UNIT_DIMENSION_MISMATCH` |
| Explosão | 2 × X-Burger (pão 1 un, carne 150 g, queijo 30 g) | pão 2, carne 0,3 kg, queijo 0,06 kg |
| Preparo | 50 g de molho que rende 2 kg (2,5 kg tomate, 200 g cebola) | tomate 0,0625 kg, cebola 0,005 kg |
| Custo da linha | 150 g de carne a R$ 40,00/kg | R$ 6,00 |
| Custo de preparo | 50 g do molho acima (tomate R$ 8, cebola R$ 5) | R$ 0,525 |
| Sem custo | um item sem custo médio | total `null` e o item listado |
| Ciclo | A usa B, B usa A | `RECIPE_CYCLE` com o caminho [A, B, A] |

Ficam para depois (fora da 003): FC, IC, porções, preço de venda e % de custo no preço.

## Reposição — `reorder.ts`

Fonte: [08-ciclo-operacional](../../produto/estoque/08-ciclo-operacional.md#planejamento).

```
ES  = CMD × C × margem
PP  = CMD × LT + ES
Par = CMD × C + ES
Pedir = Par − (saldo − CMD × LT) − em trânsito   (mín. 0; converter p/ unid. compra; ×FC se par em peso limpo)
```

| Caso | Entrada | Esperado |
|---|---|---|
| Filé mignon | CMD 6, LT 1, C 3, margem 0,2, saldo 9,6 | ES 3,6; PP 9,6; Par 21,6; pedir 18 |
| Com trânsito | igual, em trânsito 5 | pedir 13 |
| Acima do par | saldo 30 | pedir 0 |
| Arredondar p/ embalagem | pedir 18 kg, caixa 5 kg | 4 caixas (arredonda para cima) |

Implementado na feature 006 (`calculateReorder`, `orderQuantity`, `roundUpToPackage`,
`isAtReorderPoint`, `validateReorderLevels`, `suggestReorderLevels`, `planOrder`). Sem pedido de
compra, "em trânsito" é sempre 0. Sugestão (`suggestReorderLevels`): CMD = saídas dos últimos 30
dias ÷ 30; LT = prazo do fornecedor preferido (sem: 1); C = 7 ÷ dias de entrega do preferido (sem:
7); margem 20%. Ex.: 45 kg em 30 dias, LT 1, entrega seg e qui → PP 2,55 e par 6,3. Sem consumo,
sem sugestão.

## Gráficos do estoque — `stock-report.ts` (feature 006)

| Função | Regra | Caso |
|---|---|---|
| `parsePeriod` | 7, 30 ou 90 dias para trás; outro valor → 30 | `"15"` → 30 |
| `rankOutflow` | Mais saíram: só com saída, maior R$ primeiro. Menos saíram: com saída ou com estoque parado, menor R$ primeiro; 10 por gráfico; empate em ordem alfabética | Arroz parado vem antes do Sal (R$ 2) |
| `barPercents` | % do maior, meio para cima; valor > 0 tem no mínimo 2% | 300, 150, 30 → 100, 50, 10 |

Ordena por R$ porque medidas diferentes não se comparam.

## CMV e indicadores — `cogs.ts`, `indicators.ts`

Fonte: [10-indicadores](../../produto/estoque/10-indicadores.md).

| Função | Fórmula | Casos |
|---|---|---|
| `cogs` | EI + (compras − devoluções) − EF | 4000+2000−3000 = 3000; com devolução 200 → 2800 |
| `cogsPercent` | CMV ÷ faturamento × 100 | 3000 / 10000 = 30%; 2800 → 28% |
| `theoreticalCogs` | Σ custo ficha × vendidas | – |
| `variancePp` | CMV% real − CMV% teórico | 31% − 29,5% = 1,5 p.p. → faixa "bom" |
| `itemVariance` | (real − teórico) ÷ teórico | 11 vs 10 = 10% → não alerta; 11,1 → alerta (> 10%) |
| `turnover` | CMV ÷ estoque médio | – |
| `coverageDays` | estoque ÷ CMD | – |
| `stockoutRate` | em falta ÷ total × 100 | – |
| `lossRate` | perdas ÷ compras alimentos × 100 | – |
| `abcClassify` | ordena por valor consumido, % acumulado: A até 80%, B até 95%, C resto | caso UFMS: 3 itens = 62% → A |

Faixas da variância: ≤ 1 excelente; < 2 bom; < 3 atenção; ≥ 3 investigar.
