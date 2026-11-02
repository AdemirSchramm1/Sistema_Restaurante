# Tarefas — 003 Produtos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD). `[teste]` = escrever o teste e vê-lo falhar antes da tarefa seguinte.

## Fase 0: Escopo

- [ ] T000 Confirmar com o dono: sub-receitas fora da primeira versão; preço de venda opcional (US3.4)

## Fase 1: Domínio (US1, US3)

- [ ] T001 [teste] `recipe.test.ts`: linha na medida do item ou da mesma família; família diferente recusada (`UNIT_DIMENSION_MISMATCH`); quantidade > 0 e até 4 casas; item repetido (`DUPLICATE_RECIPE_ITEM`); produto sem linha (`RECIPE_EMPTY`); item inativo em linha nova (`ITEM_INACTIVE`)
- [ ] T002 `src/domain/inventory/recipe.ts`
- [ ] T003 [teste] `recipe.test.ts`: salvar sem mudança não gera versão; versão vigente numa data
- [ ] T004 `recipe.ts`: `hasChanges`, `versionAt`
- [ ] T005 [teste] `recipe-cost.test.ts`: custo da linha (150 g de item em kg a R$ 40,00/kg = R$ 6,00); soma; sem custo quando falta custo médio
- [ ] T006 `src/domain/inventory/recipe-cost.ts`
- [ ] T007 [teste] `permissions.test.ts`: `recipe.write` para gerente e chef; demais só leem
- [ ] T008 `permissions.ts`

## Fase 2: Banco e casos de uso (US1, US2)

- [ ] T009 [teste] Integração: migração cria `recipes`, `recipe_versions`, `recipe_lines` com RLS; UPDATE/DELETE em versão e linha falham
- [ ] T010 Schema, migração `0004_recipes` e `recipe-repository.ts`
- [ ] T011 [teste] `recipe-input.test.ts`: entrada do formulário (linhas, quantidade com vírgula)
- [ ] T012 `recipe-input.ts`
- [ ] T013 [teste] Integração: criar produto; nome repetido entre ativos; editar cria versão 2 e mantém a 1; trava otimista (`STALE_RECORD`); isolamento de tenant; auditoria; chef pode, estoquista não (`DENIED`)
- [ ] T014 `create-recipe.ts`, `update-recipe.ts`, `set-recipe-active.ts`, `list-recipes.ts`, `get-recipe.ts`, `actions/recipes.ts`

## Fase 3: Tela (US1, US2, US3)

- [ ] T015 [teste] `recipe-form.test.tsx`: adicionar/remover linha, medida filtrada pela família do item, erros no campo, mantém o que foi digitado, custo por linha e "Sem custo ainda"
- [ ] T016 `src/components/recipes/recipe-form.tsx`
- [ ] T017 Páginas `estoque/produtos` (lista com busca, novo, editar com histórico) e item "Produtos" no menu
- [ ] T018 [teste] E2E: cadastrar "X-Burger" com pão, carne e queijo, editar e ver a versão 2; acessibilidade (axe) nas telas de produtos

## Fase 4: Docs e convergência

- [ ] T019 Atualizar `docs/produto/estoque/04-fichas-tecnicas.md` (escopo da primeira versão), `00-visao-geral.md` (roadmap: 003 em andamento/feito), `docs/sistema/estoque/01-modelo-de-dados.md`, `04-plano-de-testes.md` e glossário (`recipe.write`, códigos de erro)
- [ ] T020 Rodar lint, tipos, unidade, integração e E2E; marcar tarefas
