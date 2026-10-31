# Estoque — Regras de cálculo (domínio)

Funções puras em `src/domain/inventory/`. Cada uma lista a fonte de produto e os **casos de teste
obrigatórios** (vêm dos exemplos do manual). Todas operam com decimal exato.

## Conversão de unidades — `units.ts`

```ts
convert(qty: Decimal, from: Unit, to: Unit, item?: ItemConversions): Result<Decimal, UnitError>
toStockUnit(qty: Decimal, purchaseFactor: Decimal): Decimal  // compra → estoque
```

Fonte: [02-cadastro-de-itens](../../produto/estoque/02-cadastro-de-itens.md#as-três-unidades).

| Caso | Entrada | Esperado |
|---|---|---|
| Caixa com 12 | 20 caixas, fator 12 | 240 un |
| NF-e | 2 caixas, fator 12 | 24 un |
| Massa | 1,5 kg → g | 1500 g |
| Dimensões diferentes sem conversão do item | kg → un | erro `UNIT_DIMENSION_MISMATCH` |
| Fração na contagem | 120 limões, caixa de 240 | 0,5 caixa |

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

## Tolerância de custo no recebimento

`isCostOutOfTolerance(lastCost, newCost, tolerancePct): boolean` — |novo − último| ÷ último >
tolerância. Caso: último 10,00, novo 10,60, tolerância 5% → `true`; novo 10,40 → `false`.

## Ficha técnica — `recipe.ts`

```ts
grossQuantity(net, correctionFactor)          // líquida × FC
lineCost(line, item)                          // bruta (convertida p/ unid. estoque) × custo médio
recipeCost(version, resolver)                 // soma das linhas, recursivo em sub-receitas
portionCost(version)                          // custo total ÷ porções
cogsPercent(portionCost, salePrice)           // ÷ preço × 100
inheritedAllergens(version, resolver)         // união
detectCycle(recipeId, resolver)               // sub-receita não contém a si mesma
correctionFactor(gross, net) / cookingIndex(cooked, netRaw)
```

| Caso | Entrada | Esperado |
|---|---|---|
| FC | 10 kg bruto, 8 kg limpo | 1,25 |
| Bruta | 8 kg líquido, FC 1,25 | 10 kg |
| Custo kg limpo | R$ 30/kg bruto, FC 1,25 | R$ 37,50 |
| Ciclo | A usa B, B usa A | erro `RECIPE_CYCLE` |
| Alérgenos | molho (leite) + massa (trigo) | {leite, trigo} |

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
| `countAccuracy` | iguais ÷ auditados × 100 | 96 de 100 → 96% |
| `stockoutRate` | em falta ÷ total × 100 | – |
| `lossRate` | perdas ÷ compras alimentos × 100 | – |
| `abcClassify` | ordena por valor consumido, % acumulado: A até 80%, B até 95%, C resto | caso UFMS: 3 itens = 62% → A |

Faixas da variância: ≤ 1 excelente; < 2 bom; < 3 atenção; ≥ 3 investigar.

## Validade — `expiry.ts`

```ts
labelExpiry(eventAt, rule): Date        // fabricante > Manual BP > tabela CVS (teto)
frozenShelfLifeDays(tempC): number      // tabela de congelados
receivingTempCheck(category, tempC): 'OK' | 'REJECT_SUGGESTED'
fefoOrder(lots): Lot[]                  // PVPS: vence antes, sai antes; sem validade → PEPS
```

| Caso | Entrada | Esperado |
|---|---|---|
| Carne crua aberta | 2026-11-01 10:00, 3 dias | 2026-11-04 |
| Congelado −8 °C | – | 20 dias |
| Congelado −20 °C | – | 90 dias |
| Carne refrigerada recebida a 8 °C | faixa 4–7 °C | `REJECT_SUGGESTED` |
| Pescado a 3 °C | faixa 2–3 °C | `OK` |
| Regra do Manual BP > teto CVS | 5 dias pedidos, teto 3 | 3 dias (aplica o teto) |
