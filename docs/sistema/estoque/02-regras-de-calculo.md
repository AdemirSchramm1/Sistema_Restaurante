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
| Saldo negativo antes da entrada | −2 un + 10 un a R$ 5 | custo = custo da compra (regra a confirmar) |

## Tolerância de custo na entrada

`isCostOutOfTolerance(lastCost, newCost, tolerancePct): boolean` — |novo − último| ÷ último >
tolerância. Caso: último 10,00, novo 10,60, tolerância 5% → `true`; novo 10,40 → `false`.

## Produtos (ficha técnica) — `recipe.ts`

> Na primeira versão da tela de Produtos (feature 003) entram só a quantidade de cada item e o
> custo. FC, IC e sub-receitas ficam para depois.

```ts
grossQuantity(net, correctionFactor)          // líquida × FC
lineCost(line, item)                          // bruta (convertida p/ unid. estoque) × custo médio
recipeCost(version, resolver)                 // soma das linhas, recursivo em sub-receitas
portionCost(version)                          // custo total ÷ porções
cogsPercent(portionCost, salePrice)           // ÷ preço × 100
detectCycle(recipeId, resolver)               // sub-receita não contém a si mesma
correctionFactor(gross, net) / cookingIndex(cooked, netRaw)
```

| Caso | Entrada | Esperado |
|---|---|---|
| FC | 10 kg bruto, 8 kg limpo | 1,25 |
| Bruta | 8 kg líquido, FC 1,25 | 10 kg |
| Custo kg limpo | R$ 30/kg bruto, FC 1,25 | R$ 37,50 |
| Ciclo | A usa B, B usa A | erro `RECIPE_CYCLE` |

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
