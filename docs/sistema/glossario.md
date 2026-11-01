# Glossário: termo de negócio → nome no código

| Termo (produto) | Sigla | Nome no código | Observação |
|---|---|---|---|
| Restaurante (tenant) | – | `restaurant` | Dono de todos os dados |
| Item | – | `item` | Insumo, revenda, produzido, consumo, patrimônio |
| Tipo de item | – | `ItemType`: `INGREDIENT`, `RESALE`, `PRODUCED`, `CONSUMABLE`, `ASSET` | |
| Grupo / subgrupo | – | `item_group` / `item_subgroup` | |
| Unidade de compra / estoque / receita | – | `purchaseUnit` / `stockUnit` / `recipeUnit` | |
| Fator de conversão | – | `conversionFactor` | Unidades de estoque por unidade de compra |
| Fornecedor | – | `supplier` | |
| Vínculo item-fornecedor | – | `supplier_item` | Guarda código do fornecedor e fator |
| Local | – | `location` | |
| Ficha técnica | – | `recipe` | Versionada: `recipe_version` |
| Linha da ficha | – | `recipe_line` | |
| Sub-receita | – | `recipe` com `kind = SUB_RECIPE` | Gera item `PRODUCED` |
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
| Conferência cega | – | `blindCount` | |
| Contagem / inventário | – | `stock_count` | |
| Ajuste de inventário | – | `MovementType.ADJUSTMENT` | |
| Quarentena | – | `location.kind = QUARANTINE` | |
| Etiqueta | – | `label` | |
| Leitura de temperatura | – | `temperature_reading` | |
| PVPS / PEPS | – | `FEFO` / `FIFO` | First expired / first in, first out |
| Papel | – | `Role`: `MANAGER`, `CHEF`, `STOCKKEEPER`, `BUYER`, `ADMINISTRATIVE` | Gerente, chef, estoquista, comprador, administrativo |
| Vínculo do usuário com o restaurante | – | `membership` | |
| Convite | – | `invitation` | |
| Classe de armazenamento do grupo | – | `StorageClass`: `FOOD`, `CHEMICAL`, `OTHER_NON_FOOD` | Regra item × local |
| Unidade de compra padrão | – | `purchaseUnitLabel` + `purchaseFactor` | Fator por fornecedor fica em `supplier_item` |
| Trilha de auditoria | – | `audit_log` | Só inserção |
