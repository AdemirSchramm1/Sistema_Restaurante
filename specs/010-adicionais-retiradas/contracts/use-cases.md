# Contratos: 010 — Adicionar e tirar ingredientes por botão

Mesmo formato das contratos da [009](../../009-pedidos-qr-mesa/contracts/use-cases.md). Dinheiro e
quantidade entram como string no formato brasileiro (`"3,00"`, `"20"`) e passam por
`parseBrDecimal`.

## Adicionais (equipe)

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listAddons` | `addon.read` | `includeInactive?` | `{ id, name, componentName, quantity, unit, price, active, cost, costShare, band }[]` em ordem alfabética | – |
| `getAddon` | `addon.read` | `id` | adicional + custo, % do preço, faixa, produtos que o usam, aviso de componente inativo | `NOT_FOUND` |
| `createAddon` | `addon.write` | `name`, `component { kind, id }`, `quantity`, `unit`, `price` | `{ id }` | `INVALID_NAME`, `NAME_IN_USE`, `COMPONENT_INACTIVE`, `NOT_A_SUB_RECIPE`, `INCOMPATIBLE_UNIT`, `INVALID_QUANTITY`, `INVALID_PRICE` |
| `updateAddon` | `addon.write` | os mesmos + `id`, `version` | – | os mesmos + `STALE_RECORD`, `NOT_FOUND` |
| `setAddonActive` | `addon.write` | `id`, `active`, `version` | – | `NAME_IN_USE` (ao reativar), `STALE_RECORD`, `NOT_FOUND` |

`INVALID_PRICE` aqui aceita zero (só recusa negativo e mais de 2 casas).

## Quadro "Adicionar e tirar" do produto

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `getProductCustomization` | `addon.read` | `recipeId` | `{ version, addons: { addonId, name, price, maxTimes }[], removables: { component, label, orphan }[], candidates: { component, name }[] }` | `NOT_FOUND`, `NOT_A_DISH` |
| `setProductCustomization` | `addon.write` | `recipeId`, `version`, `addons: { addonId, maxTimes }[]`, `removables: { component, label? }[]` | – | `NOT_A_DISH`, `ADDON_INACTIVE`, `INVALID_MAX_TIMES`, `NOT_IN_PRODUCT`, `INVALID_LABEL`, `DUPLICATE_OPTION`, `TOO_MANY_OPTIONS`, `STALE_RECORD` |

`candidates` são os componentes da versão mais nova do produto (para escolher o que pode tirar).
`orphan` marca retirada cujo componente saiu do produto.

## Cardápio e envio (estende as rotas públicas da 009)

`MenuView.products[]` ganha:

```ts
{
  id: string; name: string; price: string;
  addons: { id: string; name: string; price: string; maxTimes: number }[];
  removables: { kind: "ITEM" | "RECIPE"; id: string; label: string }[];
}
```

Entrada de `submitOrderAction` por linha (substitui `note`):

```ts
{
  recipeId: string;
  quantity: number;          // 1 a 20
  unitPrice: string;         // produto + adicionais, como o cliente viu
  addons: { addonId: string; times: number; unitPrice: string }[];
  removals: { kind: "ITEM" | "RECIPE"; id: string }[];
}
```

Conferências novas, depois das da 009:

| Conferência | Erro |
|---|---|
| Adicional ligado ao produto, ativo, com componente ativo | `PRODUCT_UNAVAILABLE` + `details.addonIds` |
| `1 ≤ times ≤ maxTimes`, sem adicional repetido | `INVALID_ADDON_TIMES` |
| Retirada configurada e componente na versão mais nova | `OPTION_UNAVAILABLE` + `details.removals` |
| Preço de cada adicional e preço da linha iguais aos atuais | `PRICE_CHANGED` + `details.prices` (produtos) e `details.addonPrices` |

Mensagens:

| Código | Texto |
|---|---|
| `PRODUCT_UNAVAILABLE` (adicional) | {adicional} não está mais disponível. |
| `OPTION_UNAVAILABLE` | "{texto do botão}" não está mais disponível para {produto}. |
| `PRICE_CHANGED` (adicional) | O preço de {adicional} mudou para R$ {preço}. |

Saídas de cozinha, garçom, "Meus pedidos" e consulta trocam `note` por
`changes: string[]` (ex.: `["+ 2 Fatia de queijo", "SEM cebola"]`), montado por `describeChanges`.

## Domínio exposto para a 005

```ts
lineConsumption(
  input: { versionLines: RecipeLineData[]; removed: ComponentRef[];
           addons: { line: RecipeLineData; times: number }[]; quantity: number },
  graph: Map<string, RecipeNode>,
  items: (id: string) => ItemCostInfo | undefined,
): Result<Map<string, Decimal>>
```

## Permissões novas

| Ação | Gerente | Chef |
|---|---|---|
| `addon.read` | ✓ | ✓ |
| `addon.write` | ✓ | |

## Auditoria

| Operação | `entity` | Campos |
|---|---|---|
| Adicional criado, editado, inativado, reativado | `addon` | `name`, `component`, `quantity`, `unit`, `price`, `active` |
| Quadro do produto | `recipe` | `customization` (texto legível antes e depois) |
