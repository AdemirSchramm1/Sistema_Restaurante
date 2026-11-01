# Tarefas — 002 Simplificar cadastro

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD).

## Fase 1: Cadastro simplificado (PR #4)

- [x] T001 Atualizar `docs/produto` (02, 05, 00, 04, 13) e `docs/sistema/estoque/01-modelo-de-dados.md`
- [x] T002 [teste] Domínio do item: só medida e embalagem opcional (`item.test.ts`)
- [x] T003 Domínio do item simplificado (`item.ts`); remover `allergens.ts`, `ean.ts`, conversão do item em `units.ts`
- [x] T004 [teste] Entrada do formulário (`item-input.test.ts`) rejeita campos removidos
- [x] T005 `item-input.ts` simplificado
- [x] T006 [teste] Formulário do item (`item-form.test.tsx`): três blocos, frase "1 Caixa = 20 kg", sem campos removidos
- [x] T007 `item-form.tsx` reescrito com rótulos claros
- [x] T008 [teste] Domínio e entrada de local (`location.test.ts`, `location-input.test.ts`)
- [x] T009 `location.ts`, `location-input.ts`, sugestões e tela de locais simplificados; folha de contagem removida
- [x] T010 [teste] Integração: item sem embalagem, embalagem incompleta, locais sem temperatura
- [x] T011 Migração `0002_simplify_items`, schema e repositórios
- [x] T012 E2E e acessibilidade atualizados

## Fase 2: Sincronizar specs, docs e tarefas antigas

- [x] T013 Escrever o `plan.md` da 002 (faltava no fluxo Spec Kit)
- [x] T014 Marcar em `specs/001-cadastros-base/` (spec, tasks, plan, data-model, research) o que a 002 mudou ou removeu
- [x] T015 Atualizar `specs/001-cadastros-base/contracts/use-cases.md` e `quickstart.md` para o comportamento atual
- [x] T016 Reescrever `docs/sistema/estoque/04-plano-de-testes.md` pelo roadmap novo (003 Produtos … 008 Painel)
- [x] T017 Retirar validade, contagem, temperatura e unidade de receita de `docs/sistema` (regras de cálculo, movimentações, glossário, TDD, convenções)
- [x] T018 Marcar o escopo simplificado em `docs/produto/estoque` 01, 03, 06, 08, 09 e 10; registrar o acerto manual como decisão em aberto em 13
- [x] T019 Ajustar a constituição (v1.0.2): exemplos de II e IV sem validade e unidade de receita

## Fase 3: Convergência

- [x] T020 [teste] Textos da tela de grupos sem sigla solta (`src/components/groups/group-labels.test.ts`) per FR-005 (partial)
- [x] T021 Tela de grupos usa "Que tipo de coisa é" e "Conta no custo dos pratos (CMV)" (`group-labels.ts`, `app/(app)/estoque/grupos/page.tsx`) per FR-005 (partial)
