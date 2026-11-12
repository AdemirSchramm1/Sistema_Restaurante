# Tarefas — 012 Nova cara, padrões do front, limpeza e desempenho

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

Regras: cada tarefa de código vem depois do teste que a exige e esse teste é visto falhar na
asserção antes (constituição, princípio I; [01-tdd](../../docs/sistema/01-tdd.md)). Refatoração sem
comportamento novo roda a suíte inteira antes e depois. `[P]` = pode andar em paralelo. `[USn]` =
história da spec. Commits `test(012): …` antes de `feat(012)`, `perf(012)` ou `refactor(012)`.

## Fase 1: Base pura

- [ ] T001 [P] [teste] `src/domain/shared/collections.test.ts`: `groupBy` agrupa por chave numa passada, mantém a ordem de entrada dentro do grupo, devolve lista vazia para chave ausente
- [ ] T002 [P] `src/domain/shared/collections.ts`
- [ ] T003 [P] [teste] `src/domain/shared/decimal.test.ts`: `formatBrl` → "R$ 1.234,50", "R$ 0,00", até 4 casas quando pedido ("R$ 8,1234"), negativo com sinal
- [ ] T004 [P] `formatBrl` em `src/domain/shared/decimal.ts`
- [ ] T005 [P] [teste] `src/lib/search-params.test.ts`: `firstParam` devolve o texto, ignora lista e vazio
- [ ] T006 [P] `src/lib/search-params.ts`
- [ ] T007 [P] [teste] `src/lib/contrast.test.ts`: branco × preto = 21; `#777` × branco ≈ 4,48; OKLCH de branco e preto; cor fora da faixa é limitada
- [ ] T008 [P] `src/lib/contrast.ts`

## Fase 2: US4 — Telas mais rápidas (P1)

- [ ] T009 [US4] [teste] `tests/integration/performance/indexes.test.ts`: com `enable_seqscan = off` e `auto_explain` em `notice`, cardápio, cozinha, conta, caixa, pedidos, itens, grupos, fornecedores, mesas e adicionais não leem tabela do restaurante inteira (vermelho: 7 tabelas)
- [ ] T010 [US4] Índices nos esquemas `src/infra/db/schema/*.ts` e migração `0012_performance` ([data-model.md](data-model.md))
- [ ] T011 [US4] [teste] `tests/integration/access/context.test.ts`: `resolveContext` monta restaurante e papéis sem abrir transação do restaurante; membro inativo → nulo; sem papéis → lista vazia
- [ ] T012 [US4] Função `app_membership_for_user` com `roles` (mesma migração), `GlobalLookups.membershipForUser` e `resolveContext`
- [ ] T013 [US4] [teste] `tests/integration/shell.test.ts`: `getShellInfo` devolve nome e contagem do Repor numa transação; para o garçom, contagem nula e nenhuma tentativa negada
- [ ] T014 [US4] `src/application/shell.ts` e `app/(app)/layout.tsx`
- [ ] T015 [US4] [teste] `tests/integration/performance/submit-order.test.ts`: enviar pedido de 1 linha e de 3 linhas (com adicionais e retiradas) faz o mesmo número de consultas
- [ ] T016 [US4] `insertOrder` em lote em `src/infra/db/repositories/ordering-repository.ts`
- [ ] T017 [US4] `groupBy` nas junções em memória dos repositórios (pedidos, contas, cardápio, escolhas, grupos, fornecedores, fichas, membros)
- [ ] T018 [US4] `cache()` do React em `currentSession()` e `currentContext()` (`src/actions/_session.ts`)

## Fase 3: US1 — Identidade visual (P1)

- [ ] T019 [US1] [teste] `src/components/ui/tokens.test.ts`: todos os pares de texto e fundo do tema ≥ 4,5:1 no claro e no escuro (vermelho com o tema de hoje: faltam os tokens)
- [ ] T020 [US1] Tema em `app/globals.css` (paleta, sombras, raio, fontes) e fontes em `app/layout.tsx`
- [ ] T021 [US1] [teste] `src/components/ui/no-raw-colors.test.ts`: nenhuma classe de cor crua em `app/` e `src/components/` (vermelho: 16 arquivos)
- [ ] T022 [US1] [teste] Componentes do padrão: `badge`, `alert`, `button`, `card`, `table`, `text-link`, `empty-state` (tons, variantes, papéis de acessibilidade)
- [ ] T023 [US1] Componentes do padrão em `src/components/ui/`
- [ ] T024 [US1] Trocar as cores cruas pelos tons do padrão (verde o T021)

## Fase 4: US2 — Menu lateral por área (P1)

- [ ] T025 [US2] [teste] `src/components/layout/nav.test.tsx`: áreas Estoque, Operação e Configuração na ordem; links e ordem de hoje por papel; `activeHref` escolhe o mais específico (`/caixa/contas` → Contas; `/pedidos/cozinha` → Cozinha; `/estoque/itens/123` → Itens); link ativo com `aria-current`
- [ ] T026 [US2] `src/components/layout/nav.tsx`
- [ ] T027 [US2] [teste] `src/components/layout/app-shell.test.tsx`: "Pular para o conteúdo", botão "Menu" abre e fecha o menu (`aria-expanded`), escolher um link fecha, nome do restaurante e "Sair"
- [ ] T028 [US2] `src/components/layout/app-shell.tsx`, `brand.tsx` e `app/(app)/layout.tsx`

## Fase 5: US3 — Telas com o mesmo padrão (P1)

- [ ] T029 [US3] [teste] `src/components/layout/page-header.test.tsx`: `h1`, descrição, ações e voltar
- [ ] T030 [US3] `src/components/layout/page-header.tsx`
- [ ] T031 [US3] Todas as telas de `app/(app)/` com `PageHeader`, `TextLink` e tons do padrão
- [ ] T032 [US3] Entrar, criar conta, recuperar e redefinir senha, convite e sem acesso com o painel da marca
- [ ] T033 [US3] Cozinha (cor da etapa), garçom, caixa, conta e cardápio do cliente (cartões e preço em destaque)

## Fase 6: US5 — Limpeza (P2)

- [ ] T034 [US5] Apagar código morto: `listAccessOrdersAction`, `effectiveInCogsOf`, `isRaised`; imports no topo de `repositories/util.ts`
- [ ] T035 [US5] `formatBrl` no lugar das 10 cópias de "R$"; `firstParam` nas 6 páginas; `formText` nos 6 leitores de formulário

## Fase 7: US6 — Mais testes e régua (P2)

- [ ] T036 [P] [US6] [teste] Componentes sem teste: `sold-out-list`, `table-range-form`, `item-offers`, `cogs-override`, os três `*-active-toggle`, `payment-panel`, `subgroup-options`, `*-form-values`
- [ ] T037 [US6] Régua por pasta em `vitest.config.mts` (domínio 95/90/95; componentes 90/80)

## Fase 8: Fechamento

- [ ] T038 Docs: `docs/sistema/03-padroes-do-front.md`, `04-desempenho.md`, arquitetura, TDD, README dos docs; notas de implementação neste arquivo
- [ ] T039 Medição final (consultas e tempo até o 1º byte) em [research.md](research.md#r12-depois)
- [ ] T040 `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration` e e2e com axe
