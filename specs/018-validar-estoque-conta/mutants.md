# Mutantes sobreviventes e o que foi feito (spec 018, FR-001 e FR-006)

Ponto de partida: `pnpm test:mutation` em todo `src/domain/` em 2026-11-26, antes de qualquer
mudança desta spec. Sobreviventes = `Survived` + `NoCoverage`. Hoje: **0 sobreviventes**, 100% em
todo o domínio (CI: `mutacao (estoque)` e `mutacao (resto)`).

Decisões (ver [data-model.md](data-model.md)):

- `teste`: faltava teste; o comportamento já estava certo.
- `removido`: código morto ou equivalente, reescrito sem mudar o que a pessoa vê (research R7).
- `erro`: o sistema estava errado; teste vermelho antes da correção.

## Domínio (`src/domain/`)

| Arquivo | Mutantes | Decisão | Nota |
|---|---|---|---|
| `access/invitation.ts` | 9 | teste | Convite vencido × inválido, papéis e textos |
| `access/memberships.ts` | 2 | teste | Último gerente não sai |
| `access/permissions.ts` | 7 | teste | Matriz de papéis por ação, nomes em português |
| `billing/payment.ts` | 5 | teste | Campo de cada recusa (R4), troco e recebido |
| `billing/service-charge.ts` | 1 | teste | Meio centavo |
| `billing/split.ts` | 6 | teste | Falta negativa ou com 3 casas, códigos e campos |
| `inventory/average-cost.ts` | 1 | teste | Item com saldo e sem média: vale o custo da compra |
| `inventory/default-tree.ts` | 65 | teste | Árvore padrão conferida contra `docs/produto/estoque/01` |
| `inventory/item-code.ts` | 8 | teste | Formato, limite de 9999 |
| `inventory/item.ts` | 27 | teste + removido | Recusas por campo; `maxPlaces: 4` repetia o padrão do `formatBrDecimal` |
| `inventory/movement-reasons.ts` | 56 | teste | Motivos e textos tabela por tabela (R4) |
| `inventory/movement.ts` | 42 | teste | Recusas por campo, venda, cancelamento, acerto |
| `inventory/product-cost.ts` | 6 | teste + removido | Ordem do painel; comparação `share && share` virou o grupo, que já garante os dois |
| `inventory/recipe-graph.ts` | 28 | teste + removido | Ciclo, preparo dentro de preparo; `?.` virou `!` (o item da linha sempre existe) |
| `inventory/recipe.ts` | 53 | teste | Rendimento, linhas, recusas por campo |
| `inventory/reorder.ts` | 3 | teste | Até 4 casas e campo da recusa |
| `inventory/stock-report.ts` | 9 | teste + removido | `top.lte(0)` era inalcançável (a lista já sai sem zeros) |
| `inventory/units.ts` | 10 | teste | Conversões e famílias |
| `ordering/addon.ts` | 14 | teste | Recusas por campo, medida de outra família |
| `ordering/checkout.ts` | 4 | teste | Linha certa na recusa |
| `ordering/consumption.ts` | 1 | teste | Adicional com item desconhecido |
| `ordering/customization.ts` | 24 | teste | Limites do quadro e da escolha |
| `ordering/order-lines.ts` | 1 | teste | Limite de linhas |
| `ordering/order.ts` | 12 | teste | Transições, cancelamento e "o próprio" do garçom |
| `ordering/table-name.ts` | 4 | teste | Faixa de mesas |
| `shared/audit.ts` | 5 | teste + removido | Comparação de decimais já coberta pela comparação de texto |
| `shared/decimal.ts` | 18 | teste + removido | `bigint` e número pelo mesmo `String(value)`; `-0` já não chega ao fim da formatação |
| `suppliers/cnpj.ts` | 7 | teste + removido | O 1º dígito verificador já está no 13º caractere |
| `suppliers/supplier.ts` | 25 | teste + removido | `offers.slice(1)` igual a `offers` (comparar o primeiro consigo não muda nada) |

## Erros do sistema achados (FR-006)

| Onde | Antes | Depois | Commits |
|---|---|---|---|
| `src/application/inventory/movement-input.ts` | Lançamento com 30/02/2026 virava 02/03/2026 | Recusa no campo da data ("dia que não existe") | `b85e056` (vermelho) → `445493d` |
| Medida de item usado em produto (`src/domain/inventory/item.ts`, `update-item.ts`) | Trocar kg por un num item que um produto ou adicional usa era aceito, e o "Começar preparo" daquele produto falhava (a linha de 150 g não converte). Era o que deixava `kitchen.ts:148` e `order-consumption.ts:55` sem teste | Recusa `ITEM_UNIT_IN_USE` no campo da medida, dizendo onde o item está; na mesma família (kg → g) pode. Decisão do Ademir em 2026-11-28; os dois ramos viraram código morto e saíram | `c116a9a` (vermelho) → `18081de` |
| Telas da Cozinha, Conta da mesa e Lançamentos | Botões, campos e "Esgotado hoje" com 24 a 40 px de toque; tabela rolável sem foco pelo teclado (axe) | Tudo com 44 px; a área da tabela recebe foco | `427e84d` (vermelho) → `2111fb4` |

## Fora do domínio (réguas de cobertura)

As réguas `test:billing`, `test:stock` e `test:orders` pediram reescritas de código morto em
aplicação, repositórios e telas, todas sem mudar o que a pessoa vê (R7): pré-checagens trocadas
pelo índice único ou pela trava otimista do banco, `!` onde a chave estrangeira garante o valor e
ramos inalcançáveis tirados. A lista está nas mensagens dos commits `0358554` e `c0e0f17`.
