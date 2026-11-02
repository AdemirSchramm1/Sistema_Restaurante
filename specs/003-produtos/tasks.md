# Tarefas — 003 Produtos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD). `[teste]` = escrever o teste e vê-lo falhar antes da tarefa seguinte.

## Fase 0: Escopo

- [x] T000 Confirmar com o dono: **com preparos (sub-receitas)**, sem preço de venda, sem ordem de produção

## Fase 1: Domínio (US1, US3)

- [x] T001 [teste] `recipe.test.ts`: linha na medida do item ou da mesma família; família diferente recusada (`UNIT_DIMENSION_MISMATCH`); quantidade > 0 e até 4 casas; item repetido (`DUPLICATE_RECIPE_ITEM`); produto sem linha (`RECIPE_EMPTY`); item inativo em linha nova (`ITEM_INACTIVE`)
- [x] T002 `src/domain/inventory/recipe.ts`
- [x] T003 [teste] `recipe.test.ts`: salvar sem mudança não gera versão; versão vigente numa data
- [x] T004 `recipe.ts`: `hasChanges`, `versionAt`
- [x] T005 [teste] `recipe-graph.test.ts`: ciclo direto e indireto (`RECIPE_CYCLE`); explodir 2 X-Burger com 50 g de molho que rende 2 kg; custo da linha (150 g de item em kg a R$ 40,00/kg = R$ 6,00), custo de linha de preparo, soma; sem custo quando falta custo médio
- [x] T006 `src/domain/inventory/recipe-graph.ts` (`findCycle`, `explode`, `recipeCost`)
- [x] T007 [teste] `permissions.test.ts`: `recipe.write` para gerente e chef; demais só leem
- [x] T008 `permissions.ts`

## Fase 2: Banco e casos de uso (US1, US2)

- [x] T009 [teste] Integração: migração cria `recipes`, `recipe_versions`, `recipe_lines` com RLS; UPDATE/DELETE em versão e linha falham
- [x] T010 Schema, migração `0004_recipes` e `recipe-repository.ts`
- [x] T011 [teste] `recipe-input.test.ts`: entrada do formulário (linhas, quantidade com vírgula)
- [x] T012 `recipe-input.ts`
- [x] T013 [teste] Integração: criar produto; nome repetido entre ativos; editar cria versão 2 e mantém a 1; trava otimista (`STALE_RECORD`); isolamento de tenant; auditoria; chef pode, estoquista não (`DENIED`); preparo em uso não inativa nem troca família (`RECIPE_IN_USE`); ciclo recusado
- [x] T014 `application/inventory/recipes.ts` (criar, editar, inativar, listar, ver, versão na data, opções do formulário), `actions/recipes.ts`

## Fase 3: Tela (US1, US2, US3)

- [x] T015 [teste] `recipe-form.test.tsx`: adicionar/remover linha, medida filtrada pela família do item, erros no campo, mantém o que foi digitado (o custo fica no quadro "Quanto custa" da página, pela versão salva)
- [x] T016 `src/components/recipes/recipe-form.tsx`
- [x] T017 Páginas `estoque/produtos` (lista com busca, novo, editar com histórico) e item "Produtos" no menu
- [x] T018 [teste] E2E: cadastrar "X-Burger" com pão, carne e queijo, editar e ver a versão 2; acessibilidade (axe) nas telas de produtos

## Fase 4: Docs e convergência

- [x] T019 Atualizar `docs/produto/estoque/04-fichas-tecnicas.md` (escopo da primeira versão), `00-visao-geral.md` (roadmap: 003 em andamento/feito), `docs/sistema/estoque/01-modelo-de-dados.md`, `04-plano-de-testes.md` e glossário (`recipe.write`, códigos de erro)
- [x] T020 Rodar lint, tipos, unidade, integração e E2E; marcar tarefas
