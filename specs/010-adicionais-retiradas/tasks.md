# Tarefas — 010 Adicionar e tirar ingredientes por botão

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[quickstart.md](quickstart.md).

Implementada **junto com a [009](../009-pedidos-qr-mesa/tasks.md)**. Numeração própria (T1xx) para
não confundir com as tarefas da 009. Mesmas regras: teste antes, visto falhar na asserção; `[P]` em
paralelo; `[USn]` = história desta spec. Commits `test(010): …` antes de `feat(010): …`.

## Fase 1: Preparação

Nenhuma dependência nova. Usa as pastas criadas na Fase 1 da 009.

## Fase 2: Base (antes da Fase 4 da 009)

- [ ] T101 [P] [teste] `src/domain/ordering/customization.test.ts`: `priceLine` (28,00 + 2 × 3,00 = 34,00; × 2 = 68,00; adicional "Grátis" com preço 0); `validateCustomization` (adicional não ligado ao produto, inativo, com componente inativo, `times` fora de "1 a 5" ou acima de `max_times` → `INVALID_ADDON_TIMES`, repetido, retirada fora do produto ou componente fora da versão mais nova → `OPTION_UNAVAILABLE`); limite "até 10 adicionais e 10 retiradas" (`TOO_MANY_OPTIONS`); `describeChanges` ("+ 1 Fatia de queijo", "+ 2 Fatia de queijo", "SEM cebola", ordem do produto)
- [ ] T102 [P] `src/domain/ordering/customization.ts`
- [ ] T103 [P] [teste] `src/domain/ordering/addon.test.ts`: nome "1 a 40 caracteres", item **ou** preparo, medida da mesma família (`compatibleUnits` da 003), quantidade "> 0" com até 4 casas, preço "`>= 0`" com até 2 casas (`INVALID_PRICE` só para negativo e 3 casas)
- [ ] T104 [P] `src/domain/ordering/addon.ts`
- [ ] T105 [P] [teste] `src/domain/ordering/consumption.test.ts`: exemplo da spec (2 × X-Burger, + 2 Fatia de queijo, sem cebola → pão 2 un, carne 0,3 kg, queijo 0,14 kg, nenhuma cebola); retirada de preparo tira o preparo inteiro; adicional de preparo desce pelos ingredientes; sem escolhas = `explode` da 003 × quantidade
- [ ] T106 [P] `src/domain/ordering/consumption.ts` (`lineConsumption`, usa `explode`)
- [ ] T107 [P] [teste] `src/domain/access/permissions.test.ts`: `addon.read` (gerente, chef) e `addon.write` (só gerente)
- [ ] T108 [P] `addon.read` e `addon.write` em `src/domain/access/permissions.ts`
- [ ] T109 [teste] `tests/integration/ordering/addons-schema.test.ts`: checks da `0010_addons` (exatamente um de `item_id`/`sub_recipe_id`; `price >= 0`; `max_times` "1 a 5"; nome único entre ativos; `order_line_addons` e `order_line_removals` só inserção; únicos por linha) e isolamento entre restaurantes nas cinco tabelas
- [ ] T110 Migração `src/infra/db/migrations/0010_addons.sql`, `src/infra/db/schema/ordering.ts` (`addons`, `recipe_addons`, `recipe_removables`, `order_line_addons`, `order_line_removals`), RLS e `GRANT`; `src/infra/db/repositories/addon-repository.ts`

## Fase 3: US1 — Adicionais com preço (P1)

**Teste independente**: cadastrar "Fatia de queijo" (queijo 20 g, R$ 3,00) e ver custo e % do preço.

- [ ] T111 [US1] [teste] `tests/integration/ordering/addons.test.ts`: `createAddon`, `updateAddon` (`STALE_RECORD`), `setAddonActive`, `NAME_IN_USE` sem diferenciar acentos, `COMPONENT_INACTIVE`, `NOT_A_SUB_RECIPE`, `INCOMPATIBLE_UNIT`; `listAddons`/`getAddon` com custo (`recipeCost` de uma linha), % e faixa da 008, aviso de componente inativo, produtos que usam; chef lê e recebe `FORBIDDEN` ao escrever (auditoria `DENIED`); auditoria de preço
- [ ] T112 [US1] `src/application/ordering/addons.ts`, `src/actions/addons.ts`
- [ ] T113 [P] [US1] [teste] `src/components/ordering/addon-form.test.tsx`: campos, preço 0 vira "Grátis", erros por campo; chef vê sem editar
- [ ] T114 [US1] `src/components/ordering/addon-form.tsx`, `app/(app)/pedidos/adicionais/page.tsx`, `novo/page.tsx`, `[id]/page.tsx`; menu "Adicionais" para quem tem `addon.read`

## Fase 4: US2 — Quadro "Adicionar e tirar" do produto (P1)

**Teste independente**: ligar queijo e bacon e marcar cebola e picles no X-Burger; o cardápio mostra
os quatro botões.

- [ ] T115 [US2] [teste] `tests/integration/ordering/customization.test.ts`: `getProductCustomization` (candidatos da versão mais nova, `orphan` depois de versão nova sem cebola); `setProductCustomization` troca as listas numa transação, `max_times` "1 a 5", texto padrão "Sem {nome}" e "até 40", `NOT_A_DISH`, `ADDON_INACTIVE`, `NOT_IN_PRODUCT`, `DUPLICATE_OPTION`, `TOO_MANY_OPTIONS`, trava otimista do produto (`STALE_RECORD`), não cria versão nova, auditoria `customization` legível
- [ ] T116 [US2] `src/application/ordering/customization.ts`, ação em `src/actions/recipes.ts`
- [ ] T117 [P] [US2] [teste] `src/components/ordering/product-customization.test.tsx`: duas listas, máximo por adicional, editar texto do botão, aviso de retirada órfã; não aparece em preparo
- [ ] T118 [US2] `src/components/ordering/product-customization.tsx` no quadro de `app/(app)/estoque/produtos/[id]/page.tsx`

## Fase 5: US3 — Cliente personaliza por botões (P1) ↔ 009 Fase 4

Feita junto com T034–T042 da 009.

- [ ] T119 [US3] [teste] Estender `tests/integration/ordering/submit-order.test.ts` (T034 da 009): linha com adicionais e retiradas grava `order_line_addons`/`order_line_removals` com cópia de nome, preço, componente, quantidade e medida; `unit_price = base_price + Σ`; adicional com preço mudado → `PRICE_CHANGED` com `addonPrices`; adicional inativo → `PRODUCT_UNAVAILABLE` com `addonIds`; retirada que sumiu → `OPTION_UNAVAILABLE`; pedido antigo não muda quando o adicional muda
- [ ] T120 [US3] Escolhas em `src/application/ordering/submit-order.ts` e `order-input.ts`; `addons` e `removables` no `MenuView` (`src/application/ordering/menu.ts`)
- [ ] T121 [P] [US3] [teste] `src/components/ordering/dish-options.test.tsx`: botões − e + com contagem e + indisponível no máximo, "Sem cebola" liga e desliga (`aria-pressed`), preço do prato atualizado (34,00; 68,00 com 2), nenhum campo de texto, "Precisa de outra mudança? Chame um garçom.", produto sem opções adiciona direto
- [ ] T122 [US3] `src/components/ordering/dish-options.tsx`; carrinho (`cart.tsx`) com linhas separadas para o mesmo produto com escolhas diferentes

## Fase 6: US4 — Cozinha, garçom e cliente veem as mudanças (P1)

- [ ] T123 [P] [US4] [teste] `src/components/ordering/line-changes.test.tsx`: "+ 2 Fatia de queijo" e "SEM cebola" com "SEM" em maiúsculas e destaque que não depende só de cor
- [ ] T124 [US4] `src/components/ordering/line-changes.tsx` usado em `kitchen-board.tsx`, `ready-list.tsx`, `my-orders.tsx` e na consulta; `changes` nas saídas de `kitchen.ts` e `orders.ts` (estende T043/T050 da 009)

## Fase 7: US5 — Consumo para a 005 (P2)

- [ ] T125 [US5] [teste] `tests/integration/ordering/consumption.test.ts`: para um pedido gravado, montar a entrada de `lineConsumption` a partir de `order_lines`, `order_line_addons` e `order_line_removals` e conferir o exemplo da spec com a versão do envio (não a atual)
- [ ] T126 [US5] `src/application/ordering/order-consumption.ts` (lê o pedido e chama o domínio; a 005 usa)

## Fase 8: Ponta a ponta e docs

- [ ] T127 [teste] Estender `tests/e2e/ordering.spec.ts` (T052 da 009) com o roteiro do [quickstart](quickstart.md): cadastrar adicional, ligar ao produto, personalizar no celular, ver na cozinha, preço mudado no meio
- [ ] T128 [P] Docs: `docs/produto/pedidos/` (adicionais e retiradas), permissões em `09-controles-e-permissoes.md`, `docs/sistema/pedidos/` (tabelas e regras de preço e consumo), roadmap (010 feita)
- [ ] T129 Rodar lint, typecheck e todas as suítes; marcar as tarefas

## Dependências

```text
009 Fase 2 → 010 Fase 2 → US1 → US2 → US3 (com 009 US2+US3) → US4 (com 009 US4) → US5 → Fase 8
```

- US1 (adicionais) pode começar logo depois da Fase 2, em paralelo com a US1 da 009 (mesas).
- US3 precisa da US2 (produto com opções) e do cardápio da 009.
- US5 só precisa de pedidos gravados com escolhas.

## Paralelo

- Fase 2: T101–T108 em paralelo.
- US1 da 010 e US1 da 009 em paralelo.
- T117, T121 e T123 em paralelo assim que os casos de uso de cada um existirem.

## Estratégia

MVP conjunto 009 + 010: mesas e QR codes, adicionais e quadro do produto, cardápio com botões,
cozinha e garçom. A US5 (consumo) fecha a ponte para a 005.
