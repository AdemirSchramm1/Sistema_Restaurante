# Tarefas — 002 Simplificar cadastro

Cada tarefa de código vem depois do teste que a exige (TDD).

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
