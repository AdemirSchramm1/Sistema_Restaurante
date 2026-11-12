# Tarefas — 012 Nova cara, padrões do front, limpeza e desempenho

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

Regras: cada tarefa de código vem depois do teste que a exige e esse teste é visto falhar na
asserção antes (constituição, princípio I; [01-tdd](../../docs/sistema/01-tdd.md)). Refatoração sem
comportamento novo roda a suíte inteira antes e depois. `[P]` = pode andar em paralelo. `[USn]` =
história da spec. Commits `test(012): …` antes de `feat(012)`, `perf(012)` ou `refactor(012)`.

## Fase 1: Base pura

- [x] T001 [P] [teste] `src/domain/shared/collections.test.ts`: `groupBy` agrupa por chave numa passada, mantém a ordem de entrada dentro do grupo, devolve lista vazia para chave ausente
- [x] T002 [P] `src/domain/shared/collections.ts`
- [x] T003 [P] [teste] `src/domain/shared/decimal.test.ts`: `formatBrl` → "R$ 1.234,50", "R$ 0,00", até 4 casas quando pedido ("R$ 8,1234"), negativo com sinal
- [x] T004 [P] `formatBrl` em `src/domain/shared/decimal.ts`
- [x] T005 [P] [teste] `src/lib/search-params.test.ts`: `firstParam` devolve o texto, ignora lista e vazio
- [x] T006 [P] `src/lib/search-params.ts`
- [x] T007 [P] [teste] `src/lib/contrast.test.ts`: branco × preto = 21; `#777` × branco ≈ 4,48; OKLCH de branco e preto; cor fora da faixa é limitada
- [x] T008 [P] `src/lib/contrast.ts`

## Fase 2: US4 — Telas mais rápidas (P1)

- [x] T009 [US4] [teste] `tests/integration/performance/indexes.test.ts`: com `enable_seqscan = off` e `auto_explain` em `notice`, cardápio, cozinha, conta, caixa, pedidos, itens, grupos, fornecedores, mesas e adicionais não leem tabela do restaurante inteira (vermelho: 7 tabelas)
- [x] T010 [US4] Índices nos esquemas `src/infra/db/schema/*.ts` e migração `0012_performance` ([data-model.md](data-model.md))
- [x] T011 [US4] [teste] `tests/integration/access/context.test.ts`: `resolveContext` monta restaurante e papéis sem abrir transação do restaurante; membro inativo → nulo; sem papéis → lista vazia
- [x] T012 [US4] Função `app_membership_for_user` com `roles` (mesma migração), `GlobalLookups.membershipForUser` e `resolveContext`
- [x] T013 [US4] [teste] `tests/integration/shell.test.ts`: `getShellInfo` devolve nome e contagem do Repor numa transação; para o garçom, contagem nula e nenhuma tentativa negada
- [x] T014 [US4] `src/application/shell.ts` e `app/(app)/layout.tsx`
- [x] T015 [US4] [teste] `tests/integration/performance/submit-order.test.ts`: enviar pedido de 1 linha e de 3 linhas (com adicionais e retiradas) faz o mesmo número de consultas
- [x] T016 [US4] `insertOrder` em lote em `src/infra/db/repositories/ordering-repository.ts`
- [x] T017 [US4] `groupBy` nas junções em memória dos repositórios (pedidos, contas, cardápio, escolhas, grupos, fornecedores, fichas, membros)
- [x] T018 [US4] `cache()` do React em `currentSession()` e `currentContext()` (`src/actions/_session.ts`)

## Fase 3: US1 — Identidade visual (P1)

- [x] T019 [US1] [teste] `src/components/ui/tokens.test.ts`: todos os pares de texto e fundo do tema ≥ 4,5:1 no claro e no escuro (vermelho com o tema de hoje: faltam os tokens)
- [x] T020 [US1] Tema em `app/globals.css` (paleta, sombras, raio, fontes) e fontes em `app/layout.tsx`
- [x] T021 [US1] [teste] `src/components/ui/no-raw-colors.test.ts`: nenhuma classe de cor crua em `app/` e `src/components/` (vermelho: 16 arquivos)
- [x] T022 [US1] [teste] Componentes do padrão: `badge`, `alert`, `button`, `card`, `table`, `text-link`, `empty-state` (tons, variantes, papéis de acessibilidade)
- [x] T023 [US1] Componentes do padrão em `src/components/ui/`
- [x] T024 [US1] Trocar as cores cruas pelos tons do padrão (verde o T021)

## Fase 4: US2 — Menu lateral por área (P1)

- [x] T025 [US2] [teste] `src/components/layout/nav.test.tsx`: áreas Estoque, Operação e Configuração na ordem; links e ordem de hoje por papel; `activeHref` escolhe o mais específico (`/caixa/contas` → Contas; `/pedidos/cozinha` → Cozinha; `/estoque/itens/123` → Itens); link ativo com `aria-current`
- [x] T026 [US2] `src/components/layout/nav.tsx`
- [x] T027 [US2] [teste] `src/components/layout/app-shell.test.tsx`: "Pular para o conteúdo", botão "Menu" abre e fecha o menu (`aria-expanded`), escolher um link fecha, nome do restaurante e "Sair"
- [x] T028 [US2] `src/components/layout/app-shell.tsx`, `brand.tsx` e `app/(app)/layout.tsx`

## Fase 5: US3 — Telas com o mesmo padrão (P1)

- [x] T029 [US3] [teste] `src/components/layout/page-header.test.tsx`: `h1`, descrição, ações e voltar
- [x] T030 [US3] `src/components/layout/page-header.tsx`
- [x] T031 [US3] Todas as telas de `app/(app)/` com `PageHeader`, `TextLink` e tons do padrão
- [x] T032 [US3] Entrar, criar conta, recuperar e redefinir senha, convite e sem acesso com o painel da marca
- [x] T033 [US3] Cozinha (cor da etapa), garçom, caixa, conta e cardápio do cliente (cartões e preço em destaque)

## Fase 6: US5 — Limpeza (P2)

- [x] T034 [US5] Apagar código morto: `listAccessOrdersAction`, `effectiveInCogsOf`, `isRaised`; imports no topo de `repositories/util.ts`
- [x] T035 [US5] `formatBrl` no lugar das 10 cópias de "R$"; `firstParam` nas 6 páginas; `formText` nos 6 leitores de formulário

## Fase 7: US6 — Mais testes e régua (P2)

- [x] T036 [P] [US6] [teste] Componentes sem teste: `sold-out-list`, `table-range-form`, `item-offers`, `cogs-override`, os três `*-active-toggle`, `payment-panel`, `subgroup-options`, `*-form-values`
- [x] T037 [US6] Régua por pasta em `vitest.config.mts` (domínio 95/90/95; componentes 90/80)

## Fase 8: Fechamento

- [x] T038 Docs: `docs/sistema/03-padroes-do-front.md`, `04-desempenho.md`, arquitetura, TDD, README dos docs; notas de implementação neste arquivo
- [x] T039 Medição final (consultas e tempo até o 1º byte) em [research.md](research.md#r12-depois)
- [x] T040 `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration` e e2e com axe

## Notas da implementação

- **T009 a T018 (desempenho)**: medição final em [research.md](research.md#r12-depois). Consultas por
  tela caíram de 34–44 para 12–18 (−51% a −68%) e o primeiro byte com o banco a 5 ms, de ~110 ms
  para ~55 ms (−48% a −50%). A primeira medição do caixa ficou em −35%; a página passou a ler a
  lista de contas e a taxa em paralelo, e o cardápio do cliente, os pratos e os pedidos da mesa.
- **T024**: as cores que não são texto e ficavam abaixo de 3:1 (borda de campo nos dois modos e o
  açafrão do gráfico no claro) foram escurecidas; o teste de contraste ganhou a lista
  `NON_TEXT_PAIRS`.
- **T031**: as telas de detalhe e de cadastro (item, produto, fornecedor, adicional) ganharam
  "Voltar para…" no `PageHeader`. O e2e do item passou a clicar em "Itens" dentro do menu, porque o
  nome do link casava com os dois.
- **T035**: a limpeza foi além do previsto. `application/form-input.ts` reúne `formText`,
  `optionalText`, `optionalDecimal`, `isId`, `componentRef` e `formDataToObject`, que eram cópias em
  sete leitores (e `formDataToObject` morava no leitor de item). `movementToday` tira a conta do
  fuso repetida na página de lançamentos.
- **T036**: os três `*-active-toggle` eram cópias do `ActionForm` e foram apagados; as páginas usam o
  `ActionForm`. `CogsOverride` passou a receber a Server Action por prop, como os outros
  formulários. Ganharam teste também `cart-state`, `ordering/format`, `billing/view`,
  `billing/format`, `auto-refresh`, `print-button`, `no-access`, o histórico da conta, as mensagens
  com detalhes e a entrada do pedido do celular (`order-input`).
- **Achado no e2e**: o aviso "Lançamento registrado." do envio anterior ficava na tela enquanto o
  próximo salvava, o que deixava o e2e do Repor recarregar a página com a perda a caminho (falha
  intermitente com 2 workers). Agora `useFormAction` devolve `saved`, que só é verdadeiro com a
  confirmação do servidor e nenhum envio a caminho, e todos os avisos de salvo usam ele.
- **T037**: os leitores de formulário (`src/application/**/*-input.ts`) também entraram na régua,
  com 90/80.
