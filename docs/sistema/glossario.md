# Glossário: termo de negócio → nome no código

| Termo (produto) | Sigla | Nome no código | Observação |
|---|---|---|---|
| Restaurante (tenant) | – | `restaurant` | Dono de todos os dados |
| Item | – | `item` | Insumo, revenda, produzido, consumo, patrimônio |
| Tipo de item | – | `ItemType`: `INGREDIENT`, `RESALE`, `PRODUCED`, `CONSUMABLE`, `ASSET` | |
| Grupo / subgrupo | – | `item_group` / `item_subgroup` | |
| Medida do item | – | `stockUnit` | kg, g, l, ml ou un. O saldo fica e baixa nela |
| Embalagem de compra | – | `purchaseUnitLabel` + `purchaseFactor` | Opcional: "Caixa" com 20 (na medida do item). A embalagem de cada fornecedor fica em `supplier_item` |
| Fornecedor | – | `supplier` | Só dados comerciais. Bloqueado = `active` falso |
| Item do fornecedor | – | `supplier_item` | Embalagem dele (`packageLabel`, `packageQuantity`), preço e preferido |
| Preço por medida | – | `pricePerUnit` | Preço ÷ quantidade da embalagem |
| Embalagem do fornecedor na compra | – | `SUPPLIER_PACKAGE` | Medida do formulário de compra |
| Permissão de fornecedores | – | `supplier.write` | Gerente e comprador |
| Local | – | – | Retirado na 002; não existe mais |
| Produto (ficha técnica) | – | `recipe` | O que o cliente pede e quanto de cada item usa. Versionada: `recipe_version` |
| Linha da ficha | – | `recipe_line` | |
| Tipo de produto | – | `RecipeKind`: `DISH` (vendido), `SUB_RECIPE` (preparo) | |
| Preparo (sub-receita) | – | `recipe` com `kind = SUB_RECIPE` | Tem rendimento; é usado dentro de outros produtos e baixa pelos ingredientes. Item `PRODUCED` e ordem de produção ainda não existem |
| Explodir o produto | – | `explode` (`recipe-graph.ts`) | Produto → itens e quantidades na medida do item |
| Permissão de produtos | – | `recipe.write` | Gerente e chef; também define o preço de venda (feature 008) |
| Preço de venda | – | `salePrice` (`recipes.sale_price`) | Só produto vendido; na tela "Vendo por (R$)" |
| Custo no preço | % CMV da ficha | `costShare` | custo ÷ preço × 100; na tela "Custo no preço" |
| Faixa do custo | – | `CostBand`: `OK`, `WARN`, `HIGH` | Na tela: dentro da faixa, atenção, alto |
| Sobra por venda | – | `margin` | preço − custo |
| O que mais pesa | – | `heaviest` | Linha mais cara do produto |
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
| Par / máximo | – | `parLevel` | Na tela: "Comprar até" (feature 006) |
| Aviso de reposição | – | `reorder` (`item.reorder`) | Tela "Repor"; na tela o PP é "Avisar quando chegar em" |
| Saída (gráficos) | – | `outflow` | Movimentação negativa, não estorno, não estornada |
| Entrada (gráficos) | – | `inflow` | Compra não estornada |
| Gráficos do estoque | – | `stockReport` | Menu "Gráficos" |
| Custo da mercadoria vendida | CMV | `cogs` | Cost of goods sold |
| CMV teórico | – | `theoreticalCogs` | |
| Variância | – | `variance` | |
| Recebimento | – | `receiving` | |
| Acerto de estoque | – | `MovementType.ADJUSTMENT` | Substitui o ajuste de inventário (sem contagem). Só nasce de pedido aprovado |
| Pedido de acerto | – | `adjustment_request` (`AdjustmentStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`) | Quem pediu não aprova |
| Estorno | – | `MovementType.REVERSAL` (`reverses_id`) | Uma vez por movimentação |
| Lançamento | – | `stock_movement` | Nome na tela do menu "Lançamentos" |
| Permissões de lançamento | – | `movement.purchase`, `movement.loss`, `adjustment.request`, `adjustment.approve`, `movement.reverse` | Ver spec 004, FR-006 |
| Papel | – | `Role`: `MANAGER`, `CHEF`, `STOCKKEEPER`, `BUYER`, `ADMINISTRATIVE`, `WAITER` | Gerente, chef, estoquista, comprador, administrativo, garçom (`WAITER` entra na feature 009) |
| Vínculo do usuário com o restaurante | – | `membership` | |
| Convite | – | `invitation` | |
| Classe de armazenamento do grupo | – | `StorageClass`: `FOOD`, `CHEMICAL`, `OTHER_NON_FOOD` | Informativa desde a 002 |
| Trilha de auditoria | – | `audit_log` | Só inserção |
| Mesa | – | `dining_table` | Tem o QR code (`qrToken`). Feature 009 |
| Trocar QR code | – | `rotateTableQr` | Invalida o link antigo da mesa |
| Acesso ao cardápio | – | `menu_access` | Aberto pela leitura do QR code; fecha 20 minutos depois (`MENU_ACCESS_MINUTES`) |
| Cardápio | – | `menu` | Produtos vendidos, ativos, com preço e não esgotados |
| Pedido | – | `order` | Da mesa, enviado pelo cliente. Não confundir com pedido de acerto nem com ponto de pedido |
| Linha do pedido | – | `order_line` | Produto, versão, quantidade, preço do produto (`basePrice`) e preço com adicionais (`unitPrice`) no envio. Sem observação livre (010). Só inserção |
| Número do pedido | – | `order.number` + `businessDay` | Reinicia a cada dia do restaurante |
| Situação do pedido | – | `OrderStatus`: `RECEIVED`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED` | Recebido, em preparo, pronto, entregue, cancelado |
| Motivo de cancelamento | – | `OrderCancelReason`: `CUSTOMER_GAVE_UP`, `OUT_OF_PRODUCT`, `IMPROPER_ORDER`, `OTHER` | |
| Esgotado hoje | – | `soldOutOn` (`recipes.sold_out_on`) | Volta sozinho no dia seguinte |
| Recebendo pedidos pelo QR code | – | `acceptingQrOrders` | Chave do restaurante |
| Permissões de pedidos | – | `table.manage`, `ordering.toggle`, `order.kitchen`, `order.cancel`, `order.deliver`, `order.read`, `product.sold_out` | Ver spec 009, FR-010 |
| Adicional | – | `addon` | Item ou preparo com quantidade e preço, que o cliente adiciona por botão ("+ Fatia de queijo"). Feature 010 |
| Retirada | – | `removable` (`recipe_removables`) | Componente do produto que o cliente pode tirar ("Sem cebola") |
| Adicionar e tirar (quadro do produto) | – | `customization` | Adicionais permitidos (com máximo de vezes) e retiradas de um produto |
| Mudanças da linha | – | `changes` (`describeChanges`) | Texto da cozinha: "+ 2 Fatia de queijo", "SEM cebola" |
| Consumo da linha | – | `lineConsumption` | O que uma linha do pedido usa de cada item; a 005 baixa isso |
| Permissões de adicionais | – | `addon.read`, `addon.write` | Ver: gerente e chef. Mudar (inclusive preço): gerente |

Termos retirados na feature 002 (não usar em código novo): unidade de receita (`recipeUnit`),
conversão do item, quarentena, conferência cega, contagem/inventário (`stock_count`), leitura de
temperatura, PVPS/FEFO, etiqueta de validade.
