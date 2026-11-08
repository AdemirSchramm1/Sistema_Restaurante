# Pesquisa: 010 — Adicionar e tirar ingredientes por botão

## R1. A que a retirada fica presa

- **Decisão**: ao componente do produto (`item_id` ou `sub_recipe_id`), em `recipe_removables`. No
  cardápio, a retirada aparece se a versão mais nova do produto ainda tem uma linha com esse
  componente. O quadro do produto mostra as retiradas órfãs com o aviso "Cebola saiu do produto e
  não aparece mais como opção" e o gerente pode removê-las.
- **Motivo**: a 003 grava linhas novas a cada versão (`recipe_lines` pertence a `recipe_versions`);
  presa ao id da linha, toda edição do produto apagaria as retiradas.
- **Alternativas**: id da linha (quebra a cada versão); texto livre do gerente sem ligação (o
  estoque não saberia o que saiu).

## R2. Formato do adicional

- **Decisão**: o adicional tem `{ component, quantity, unit }` com o mesmo tipo `RecipeLineData` da
  003 e as mesmas validações (`compatibleUnits`, quantidade > 0 com até 4 casas, item ou preparo
  ativo). Custo = `recipeCost` com essa única linha; faixa = `costBand` da 008 sobre o preço.
- **Motivo**: zero regra nova de unidade; o painel da 008 e a baixa da 005 já sabem tratar.
- **Alternativas**: adicional como produto do tipo preparo (misturaria cardápio com cadastro de
  produto e pediria versão); só item, sem preparo (não cobre "Molho especial").

## R3. Preço zero

- **Decisão**: `addons.price >= 0`; zero aparece como "Grátis". O preço de venda do produto continua
  `> 0` (check da 008).
- **Motivo**: "cebola extra" sem cobrar ainda baixa estoque e aparece na cozinha.
- **Alternativas**: retirada ou observação para extras grátis (perderia a baixa).

## R4. O que o pedido guarda

- **Decisão**: `order_line_addons` e `order_line_removals`, só inserção (trigger `app_reject_change`
  como as linhas da 009), com cópia de nome, preço, componente, quantidade e medida no envio.
  `order_lines.base_price` guarda o preço do produto; `order_lines.unit_price` passa a ser produto +
  adicionais. A observação (`note`) sai de `order_lines`.
- **Motivo**: o pedido explica o que foi cobrado e o que a 005 deve baixar, mesmo se o gerente mudar
  o adicional depois (princípio III aplicado ao pedido).
- **Alternativas**: só referência ao adicional (mudança de preço reescreveria o passado); JSON numa
  coluna (sem chave estrangeira nem check).

## R5. Preço e conferência no envio

- **Decisão**: o carrinho manda, por linha, `recipeId`, `quantity`, `addons: { addonId, times,
  unitPrice }[]`, `removals: { componentKind, componentId }[]` e o `unitPrice` total que o cliente
  viu. O domínio (`priceLine`) recalcula com os preços atuais e `checkOrder` (009) passa a comparar
  também os adicionais. Adicional inativo, não ligado ao produto, acima do máximo ou com componente
  inativo: `PRODUCT_UNAVAILABLE` com o adicional em `details.addonIds`. Retirada que não existe mais:
  `OPTION_UNAVAILABLE`.
- **Motivo**: o cliente nunca paga um valor que não viu; a mesma tela de aviso da 009 serve.
- **Alternativas**: confiar no preço do cliente; aceitar e corrigir em silêncio.

## R6. Consumo da linha

- **Decisão**: função pura `lineConsumption({ versionLines, removed, addons, quantity }, graph,
  items)`: filtra as linhas cujo componente está em `removed`, chama `explode(filtradas, 1)`, soma
  `explode([adicional], times)` de cada adicional, e multiplica tudo por `quantity`. Devolve
  `Map<itemId, Decimal>` na medida do item.
- **Motivo**: a 005 lança exatamente isso; o exemplo da spec (2 X-Burgers, + 2 queijo, sem cebola)
  vira teste.
- **Alternativas**: calcular na 005 (a regra ficaria longe da spec que a define).

## R7. Salvar o quadro do produto

- **Decisão**: `setProductCustomization(recipeId, version, addons[], removables[])` troca as duas
  listas numa transação, usa a trava otimista de `recipes` (incrementa `version`) e grava um
  `audit_log` com `customization: [antes, depois]` em texto legível ("+ Fatia de queijo (até 3)",
  "Sem cebola"). Permissão `addon.write`.
- **Motivo**: o gerente monta tudo e salva uma vez; o histórico mostra o que mudou.
- **Alternativas**: salvar cada botão separado (muitos registros de auditoria, conflitos parciais).

## R8. Permissões

- **Decisão**: `addon.write` (gerente) para adicionais, preços e quadro do produto; `addon.read`
  (gerente e chef) para ver. Estoquista, comprador, administrativo e garçom não veem a página
  "Adicionais".
- **Motivo**: spec FR-008: preços só pelo gerente.
- **Alternativas**: usar `recipe.write` (daria ao chef poder de mudar preço).
