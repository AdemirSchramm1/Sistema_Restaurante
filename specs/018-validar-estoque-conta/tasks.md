# Tarefas: 018 — Validar o estoque, a conta e o pedido

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[contracts/gates.md](contracts/gates.md)

Nesta feature o "vermelho" de cada história é ligar o portão: ele falha com a medida de hoje. As
tarefas seguintes escrevem os testes até o portão ficar verde. Cada mutante vivo é olhado primeiro
como possível erro do sistema (R6): se for, `test(018): … (vermelho)` e depois `fix(018)`.

Formato: `[ID] [P?] [História] Descrição`. `[P]` = pode rodar em paralelo (arquivos diferentes).

## Fase 1: Preparação

- [x] T001 Medir o ponto de partida (mutação por arquivo, cobertura por arquivo) e gravar em `specs/018-validar-estoque-conta/mutants.md` com uma linha por arquivo de `src/domain/` que tem sobrevivente, coluna Decisão vazia
- [x] T002 [P] Criar `specs/018-validar-estoque-conta/rules.md` com cada regra de `docs/produto/estoque/` e `docs/produto/pedidos/01` a `05` (coluna Teste vazia)

## Fase 2: Base (bloqueia as histórias)

- [x] T003 Ampliar `stryker.config.json` para `src/domain/**/*.ts` e `vitest.stryker.config.mts` para `src/domain/**/*.test.ts`; rodar `pnpm test:mutation` e ver falhar (vermelho)
- [x] T004 Adicionar `billingCoverage`, `stockCoverage` e `ordersCoverage` em `vitest.config.mts` e os scripts `test:billing`, `test:stock`, `test:orders` em `package.json`, com o escopo de `contracts/gates.md`; rodar e ver falhar (vermelho)
- [x] T005 Quebrar a CI em `.github/workflows/ci.yml`: job `mutacao` em 2 partes (R1), `integracao` em 5 partes (R3), parte `operacoes` em `telas` (R5)

## Fase 3: US1 — Conta da mesa (P1)

**Meta**: `test:billing` 100% e mutação 100% em `src/domain/billing/`.
**Teste independente**: `pnpm test:billing` verde; apagar a recusa de valor negativo em `split.ts` faz um teste falhar.

- [x] T006 [P] [US1] Mutantes de `src/domain/billing/split.ts` (recusa de valor negativo e com 3 casas, códigos e campos) em `split.test.ts`
- [x] T007 [P] [US1] Mutantes de `src/domain/billing/payment.ts` e `service-charge.ts` em seus testes
- [x] T008 [US1] Desvios de `src/application/billing/{payments,tabs,settings}.ts` em `tests/integration/billing/`
- [x] T009 [US1] Desvios de `src/infra/db/repositories/billing-repository.ts` em `tests/integration/billing/`
- [x] T010 [P] [US1] Desvios de `src/components/billing/*` (tabs-report, tab-detail, tab-print, open-tabs, payment-form, split-helper) em seus `*.test.tsx`
- [x] T011 [US1] Decisões de billing em `mutants.md`; regras de `pedidos/05` em `rules.md`

## Fase 4: US2 — Estoque (P1)

**Meta**: `test:stock` 100% e mutação 100% em `src/domain/inventory/`.
**Teste independente**: `pnpm test:stock` verde e mutação de `inventory` 100%.

- [x] T012 [P] [US2] Mutantes de `average-cost.ts` (item com saldo e sem média, compra que zera) e `units.ts` (conversões, códigos)
- [x] T013 [P] [US2] Mutantes de `movement.ts` e `movement-reasons.ts` (motivos e textos por tabela, R4)
- [x] T014 [P] [US2] Mutantes de `recipe.ts` e `recipe-graph.ts` (ciclo, preparo dentro de preparo, rendimento)
- [x] T015 [P] [US2] Mutantes de `item.ts`, `item-code.ts`, `description.ts`, `default-tree.ts` (árvore padrão conferida contra `docs/produto/estoque/01`)
- [x] T016 [P] [US2] Mutantes de `product-cost.ts`, `reorder.ts`, `stock-report.ts`
- [x] T017 [US2] Desvios de `src/application/inventory/*` (groups, movements, recipes, reorder, sales, update-item e os demais) em `tests/integration/`
- [x] T018 [US2] Desvios dos repositórios `item`, `group`, `movement`, `recipe`, `report`
- [x] T019 [P] [US2] Desvios dos componentes `items`, `groups`, `movements`, `recipes`, `costs`, `reorder`, `reports`, `audit`
- [x] T020 [US2] Decisões de inventory em `mutants.md`; regras de `estoque/` em `rules.md`

## Fase 5: US5 — Mutante como possível erro do sistema (P1)

Corre junto das fases 3, 4 e 6: toda tarefa de mutante aplica R6.

- [x] T021 [US5] Revisar `mutants.md`: nenhuma linha sem decisão; cada `erro` tem commit vermelho antes do `fix` e nota de antes e depois
- [ ] T022 [US5] Erros que mudam regra visível: perguntar ao dono antes; atualizar `docs/produto/` no mesmo PR

## Fase 6: US3 — Pedido, fornecedores e código comum (P2)

**Meta**: `test:orders` 100% e mutação 100% no resto do domínio.

- [x] T023 [P] [US3] Mutantes de `ordering/{addon,customization,checkout,order,order-lines,consumption,menu,table-name}.ts`
- [x] T024 [P] [US3] Mutantes de `suppliers/{supplier,cnpj}.ts`
- [x] T025 [P] [US3] Mutantes de `shared/{decimal,audit}.ts` e de `access/` que restarem
- [x] T026 [US3] Desvios de `src/application/ordering/*` fora das réguas e de `src/application/suppliers/*`
- [x] T027 [US3] Desvios dos repositórios `ordering`, `addon`, `supplier`
- [x] T028 [P] [US3] Desvios dos componentes `ordering` fora das réguas (product-customization, cart, addon-form, kitchen-board), `suppliers`, `layout`
- [x] T029 [US3] Decisões em `mutants.md`; regras de `pedidos/01` a `04` em `rules.md`

## Fase 7: US4 — Telas (P2)

- [x] T030 [US4] `tests/screens/operations.spec.ts`: Cozinha, Garçom, Conta da mesa (com pagamento, divisão e taxa) e Lançamentos nos tamanhos da R5, claro e escuro; rodar e corrigir no app o que quebrar (vermelho → verde)
- [x] T031 [US4] Rodar a parte nova nos dois navegadores na imagem oficial (`scripts/screens.sh`)

## Fase 8: Acabamento

- [x] T032 [P] `docs/sistema/01-tdd.md`, `05-testes-de-tela.md`, `06-ci-cd.md`: réguas e comandos novos
- [x] T033 [P] `rules.md`: nenhuma regra sem teste (FR-007); testes que faltavam escritos
- [ ] T034 Checagens locais de `06-ci-cd.md` (formato, lint, tipos, unidade, os 6 portões, e2e, telas) e conferir que nenhum teste antigo sumiu (SC-005)
- [ ] T035 Abrir o PR da feature inteira com os números e o tempo de cada job

## Dependências

Fase 1 → Fase 2 → (US1, US2, US3 em qualquer ordem; US5 junto delas) → US4 → Acabamento.
US1 e US2 são o MVP: o dinheiro provado.

## Paralelo

Dentro de cada história, as tarefas `[P]` mexem em arquivos de teste diferentes, por exemplo
T006, T007 e T010 juntas; T012 a T016 juntas.
