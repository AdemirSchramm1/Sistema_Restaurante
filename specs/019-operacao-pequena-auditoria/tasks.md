# Tarefas: 019 — Modo operação pequena e relatório de auditoria

Ordem: cada tarefa de código começa por um teste vermelho em commit próprio (`test(019): … (vermelho)`).

## Fase 1 — Base

- [x] T001 Portão `test:audit` em `vitest.config.mts` e `package.json`; parte `auditoria` no job `integracao`
- [x] T002 Permissões `audit.read` e `restaurant.small_operation` (gerente) em `src/domain/access/permissions.ts`, com teste

## Fase 2 — US1 Relatório de auditoria (P1)

- [x] T003 [US1] `src/domain/audit/operation-types.ts`: tipos de operação, entidades e teste que acha entidade sem tipo
- [x] T004 [US1] `src/domain/audit/audit-filter.ts`: leitura do filtro (período até 31 dias, pessoa, tipo, só negadas, página)
- [x] T005 [US1] `AuditRepo.search` com filtros, página e total; índices na migração `0017`
- [x] T006 [US1] `searchAudit` com `authorize("audit.read")`, isolamento e tentativa negada registrada
- [x] T007 [US1] `entry-labels.ts` (rótulos compartilhados com o histórico), `audit-filters.tsx`, `audit-table.tsx`
- [x] T008 [US1] Página `/equipe/auditoria`, item no menu e planilha `/equipe/auditoria/planilha`
- [x] T009 [US1] Índices e desempenho (`indexes.test.ts`, medição em `04-desempenho.md`)

## Fase 3 — US2 Operação pequena (P1)

- [x] T010 [US2] Migração: `restaurants.small_operation`, `adjustment_requests.self_approved`, `check` novo
- [x] T011 [US2] Domínio: `decideAdjustment` aceita quem pediu quando o modo está ligado e marca a exceção
- [x] T012 [US2] `setSmallOperation` com trava otimista e trilha; leitura do modo na transação da aprovação
- [x] T013 [US2] Tela `/equipe/operacao-pequena` e botões Aprovar e Recusar no próprio pedido com o modo ligado
- [x] T014 [US2] Exceção aparece no histórico do acerto e na Auditoria

## Fase 4 — US3 Revisão semanal (P2)

- [x] T015 [US3] `src/domain/audit/week.ts`: semana local (segunda a domingo), semana encerrada
- [x] T016 [US3] Tabela `exception_reviews` só de inserção; repositório e `pendingReviews`, `weekExceptions`, `markWeekReviewed`
- [x] T017 [US3] Aviso no topo das telas da equipe e página `/equipe/auditoria/revisao`

## Fase 5 — Acabamento

- [x] T018 Testes de tela `tests/screens/audit.spec.ts` (Auditoria, Operação pequena, Revisão) e e2e do fluxo do gerente único
- [x] T019 `docs/produto/estoque/09` e `13-decisoes-adotadas`; `docs/sistema/01-tdd.md` e `06-ci-cd.md` com o portão novo
- [ ] T020 Checagens locais de `06-ci-cd.md` e PR da feature inteira com números e tempos
