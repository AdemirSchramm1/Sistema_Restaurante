# Contratos: casos de uso e Server Actions (feature 001)

> **Atualizado com a [feature 002](../../002-simplificar-cadastro/spec.md).** As tabelas abaixo
> descrevem o que o código faz hoje. Saíram: `getCountSheet`, `previewConversion`, a entrada
> `recipeUnit`/`conversions`, os campos de FR-025 e os erros de temperatura, químicos, FC,
> rendimento, EAN, alérgenos e NCM.

A aplicação não expõe API pública nesta feature. A interface com o usuário passa por **Server
Actions** finas que chamam **casos de uso** em `src/application/`. Este arquivo é o contrato entre as
duas camadas: entrada (validada por Zod), saída e erros. Toda ação:

1. Lê a sessão; sem sessão → `UNAUTHENTICATED`.
2. Monta o contexto `{ userId, restaurantId, roles, origin }` a partir da sessão (nunca do cliente).
3. Chama o caso de uso, que faz `assertCan(roles, action)` → `FORBIDDEN` (e auditoria `DENIED`).
4. Abre transação, `set_config('app.restaurant_id', …, true)`, escreve, grava `audit_log`, confirma.
5. Devolve `Result`: `{ ok: true, data }` ou `{ ok: false, error: { code, field?, details? } }`.

Números chegam como **string** no formato brasileiro (`"1,5"`) e são convertidos por
`parseBrDecimal`. Escritas de edição recebem `version` (trava otimista, R9).

## Acesso

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `signUpRestaurant` | público | `restaurantName`, `userName`, `email`, `password` | `restaurantId` | `EMAIL_IN_USE`, `WEAK_PASSWORD` |
| `inviteMember` | `user.invite` | `email`, `roles[]` | `invitationId` | `ALREADY_MEMBER`, `INVITATION_PENDING`, `EMAIL_BELONGS_TO_OTHER_RESTAURANT` |
| `acceptInvitation` | público (token) | `token`, `name`, `password` | `userId` | `INVITATION_INVALID`, `INVITATION_EXPIRED` |
| `revokeInvitation` | `user.invite` | `invitationId` | – | `NOT_FOUND` |
| `setMemberRoles` | `user.manage` | `membershipId`, `roles[]`, `version` | – | `LAST_MANAGER`, `STALE_RECORD` |
| `deactivateMember` / `reactivateMember` | `user.manage` | `membershipId`, `version` | – | `LAST_MANAGER`, `STALE_RECORD` |

Login, logout e recuperação de senha usam os endpoints do Better Auth, com páginas próprias.

## Grupos e subgrupos

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listGroupTree` | `catalog.read` | `includeInactive?` | árvore com códigos, `storageClass`, `inCogs` | – |
| `createGroup` | `group.manage` | `name`, `storageClass`, `inCogs` | `{ id, code }` | `NAME_IN_USE`, `GROUP_CODES_EXHAUSTED` |
| `createSubgroup` | `group.manage` | `groupId`, `name` | `{ id, code }` | `NAME_IN_USE`, `GROUP_CODES_EXHAUSTED` |
| `renameGroup` / `renameSubgroup` | `group.manage` | `id`, `name`, `version` | – | `NAME_IN_USE`, `STALE_RECORD` |
| `deactivateGroup` / `deactivateSubgroup` | `group.manage` | `id`, `version` | – | `SYSTEM_RECORD`, `SUBGROUP_HAS_ACTIVE_ITEMS` |

## Locais

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listLocations` | `catalog.read` | `includeInactive?` | locais em ordem alfabética | – |
| `createLocation` / `updateLocation` | `location.manage` | `name`, `kind` (+ `id`, `version`) | `{ id }` | `VALIDATION`, `NAME_IN_USE`, `STALE_RECORD` |
| `applySuggestedLocations` | `location.manage` | `keys[]` (modelos do doc 05) | ids criados | `NAME_IN_USE` |
| `deactivateLocation` / `reactivateLocation` | `location.manage` | `id`, `version` | – | `SYSTEM_RECORD`, `LOCATION_IN_USE`, `NAME_IN_USE` |

## Itens

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `listItems` | `catalog.read` | `q?` (código, nome), `groupId?`, `subgroupId?`, `type?`, `locationId?`, `status?`, `page` | página de 50 + total | – |
| `getItem` | `catalog.read` | `id` | item completo, locais, `effectiveInCogs` | `NOT_FOUND` |
| `createItem` | `item.write` | ver abaixo | `{ id, code }` | `ITEM_DUPLICATE_DESCRIPTION` (com `details.existingCode`), `INVALID_DESCRIPTION`, `UNKNOWN_UNIT`, `PURCHASE_FACTOR_REQUIRED`, `PURCHASE_LABEL_REQUIRED`, `INVALID_FACTOR`, `SUBGROUP_INACTIVE`, `SUBGROUP_SEQUENCE_EXHAUSTED` |
| `updateItem` | `item.write` | `id`, `version`, campos editáveis | – | os de `createItem` + `ITEM_UNIT_LOCKED`, `STALE_RECORD` |
| `setItemCogsOverride` | `item.cogs_override` | `id`, `version`, `inCogsOverride: boolean \| null` | – | `STALE_RECORD` |
| `deactivateItem` / `reactivateItem` | `item.write` | `id`, `version` | – | `ITEM_DUPLICATE_DESCRIPTION` (reativação) |
| `setItemLocations` | `item_location.manage` | `itemId`, `links[{ locationId, isDefault }]` | – | `MULTIPLE_DEFAULTS`, `LOCATION_INACTIVE`, `NOT_FOUND` |
| `getAuditHistory` | `catalog.read` | `entity`, `entityId` | eventos com usuário, data, mudanças | – |

**Entrada de `createItem`**: `description`, `subgroupId`, `type`, `stockUnit` (kg, g, l, ml, un) e,
opcionalmente, `purchaseUnitLabel` + `purchaseFactor` (os dois juntos, quantidade > 0 na medida do
item). `code`, custos e `abcClass` **não** são aceitos, nem os campos retirados pela 002 (Zod
`strict` rejeita campo desconhecido).

## Matriz de permissões (FR-003)

| Ação | Gerente | Chef | Estoquista / Comprador / Administrativo |
|---|:-:|:-:|:-:|
| `catalog.read` | ✓ | ✓ | ✓ |
| `item.write` | ✓ | ✓ | |
| `item.cogs_override` | ✓ | | |
| `item_location.manage` | ✓ | | |
| `group.manage` | ✓ | | |
| `location.manage` | ✓ | | |
| `user.invite`, `user.manage` | ✓ | | |

## Erros: códigos estáveis e texto da interface

| Código | Mensagem (pt-BR) |
|---|---|
| `UNAUTHENTICATED` | Sua sessão expirou. Entre novamente. |
| `FORBIDDEN` | Você não tem permissão para esta ação. |
| `NOT_FOUND` | Registro não encontrado. (também para registro de outro restaurante) |
| `STALE_RECORD` | Outra pessoa alterou este registro. Revise os dados atuais antes de salvar. |
| `ITEM_DUPLICATE_DESCRIPTION` | Já existe um item ativo com este nome neste grupo ({existingCode}). |
| `ITEM_UNIT_LOCKED` | A medida não pode mudar depois que o item já teve entrada ou saída. Inative o item e crie outro. |
| `UNIT_DIMENSION_MISMATCH` | Essas medidas não se convertem (ex.: quilo e unidade). |
| `INVALID_FACTOR` | A quantidade em cada embalagem precisa ser maior que zero. |
| `INVALID_DESCRIPTION` | O nome do item precisa ter entre 3 e 200 letras. |
| `UNKNOWN_UNIT` | Escolha uma medida da lista. |
| `PURCHASE_FACTOR_REQUIRED` | Diga quanto vem em cada embalagem (ex.: 20) ou deixe a embalagem em branco. |
| `PURCHASE_LABEL_REQUIRED` | Diga o nome da embalagem (ex.: Caixa) ou deixe a quantidade em branco. |
| `SYSTEM_RECORD` | Este registro é padrão do sistema e não pode ser apagado ou inativado. |
| `LOCATION_IN_USE` | Retire os itens deste local antes de inativá-lo. |
| `SUBGROUP_HAS_ACTIVE_ITEMS` | Mova ou inative os itens deste subgrupo antes. |
| `SUBGROUP_SEQUENCE_EXHAUSTED` | Este subgrupo chegou a 9.999 itens. Crie outro subgrupo. |
| `LAST_MANAGER` | O restaurante precisa ter pelo menos um gerente ativo. |
