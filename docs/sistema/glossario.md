# Glossário: termo de negócio → nome no código

| Termo (produto) | Sigla | Nome no código | Observação |
|---|---|---|---|
| Restaurante (tenant) | – | `restaurant` | Dono de todos os dados |
| Item | – | `item` | Insumo, revenda, produzido, consumo, patrimônio |
| Tipo de item | – | `ItemType`: `INGREDIENT`, `RESALE`, `PRODUCED`, `CONSUMABLE`, `ASSET` | |
| Grupo / subgrupo | – | `item_group` / `item_subgroup` | |
| Medida do item | – | `stockUnit` | kg, g, l, ml ou un. O saldo fica e baixa nela |
| Embalagem de compra | – | `purchaseUnitLabel` + `purchaseFactor` | Opcional: "Caixa" com 20 (na medida do item). Fator por fornecedor fica em `supplier_item` |
| Fornecedor | – | `supplier` | |
| Vínculo item-fornecedor | – | `supplier_item` | Guarda código do fornecedor e fator |
| Local | – | – | Retirado na 002; não existe mais |
| Produto (ficha técnica) | – | `recipe` | O que o cliente pede e quanto de cada item usa. Versionada: `recipe_version` |
| Linha da ficha | – | `recipe_line` | |
| Tipo de produto | – | `RecipeKind`: `DISH` (vendido), `SUB_RECIPE` (preparo) | |
| Preparo (sub-receita) | – | `recipe` com `kind = SUB_RECIPE` | Tem rendimento; é usado dentro de outros produtos e baixa pelos ingredientes. Item `PRODUCED` e ordem de produção ainda não existem |
| Explodir o produto | – | `explode` (`recipe-graph.ts`) | Produto → itens e quantidades na medida do item |
| Permissão de produtos | – | `recipe.write` | Gerente e chef |
| Ordem de produção | OP | `production_order` | |
| Movimentação | – | `stock_movement` | Livro imutável |
| Tipo de movimentação | – | `MovementType` | Ver `estoque/03-movimentacoes-e-saldo.md` |
| Motivo | – | `movement_reason` | Lista fechada |
| Saldo | – | `stock_balance` | Projeção do livro |
| Custo médio ponderado | CMP | `averageCost` | |
| Último custo | – | `lastCost` | |
| Fator de correção | FC | `correctionFactor` | bruto ÷ líquido |
| Índice de cocção | IC | `cookingIndex` | cozido ÷ líquido cru |
| Índice de rendimento | IR | `yieldIndex` | |
| Consumo médio diário | CMD | `averageDailyUsage` | |
| Lead time | LT | `leadTimeDays` | |
| Ciclo de reposição | C | `reorderCycleDays` | |
| Estoque de segurança | ES | `safetyStock` | |
| Ponto de pedido | PP | `reorderPoint` | Também é o "mínimo" exibido |
| Par / máximo | – | `parLevel` | |
| Custo da mercadoria vendida | CMV | `cogs` | Cost of goods sold |
| CMV teórico | – | `theoreticalCogs` | |
| Variância | – | `variance` | |
| Recebimento | – | `receiving` | |
| Acerto de estoque | – | `MovementType.ADJUSTMENT` | Substitui o ajuste de inventário (sem contagem). Só nasce de pedido aprovado |
| Pedido de acerto | – | `adjustment_request` (`AdjustmentStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`) | Quem pediu não aprova |
| Estorno | – | `MovementType.REVERSAL` (`reverses_id`) | Uma vez por movimentação |
| Lançamento | – | `stock_movement` | Nome na tela do menu "Lançamentos" |
| Permissões de lançamento | – | `movement.purchase`, `movement.loss`, `adjustment.request`, `adjustment.approve`, `movement.reverse` | Ver spec 004, FR-006 |
| Papel | – | `Role`: `MANAGER`, `CHEF`, `STOCKKEEPER`, `BUYER`, `ADMINISTRATIVE` | Gerente, chef, estoquista, comprador, administrativo |
| Vínculo do usuário com o restaurante | – | `membership` | |
| Convite | – | `invitation` | |
| Classe de armazenamento do grupo | – | `StorageClass`: `FOOD`, `CHEMICAL`, `OTHER_NON_FOOD` | Informativa desde a 002 |
| Trilha de auditoria | – | `audit_log` | Só inserção |

Termos retirados na feature 002 (não usar em código novo): unidade de receita (`recipeUnit`),
conversão do item, quarentena, conferência cega, contagem/inventário (`stock_count`), leitura de
temperatura, PVPS/FEFO, etiqueta de validade.
