# Plano técnico: 019 — Modo operação pequena e relatório de auditoria

**Spec**: [spec.md](spec.md) · **Branch**: `claude/project-thread-oukdi6` · **Data**: 2026-11-28

## Resumo

Três peças pequenas sobre o que já existe:

1. **Auditoria** (US1): leitura paginada de `audit_log` com filtros, numa tela do gerente e numa
   planilha. Nada novo é gravado; só índices.
2. **Operação pequena** (US2): uma coluna no restaurante e uma exceção na aprovação do acerto, que
   hoje recusa `SELF_APPROVAL` no domínio e por um `check` no banco.
3. **Revisão semanal** (US3): uma tabela só de inserção com as semanas revisadas e um aviso
   calculado numa consulta só.

## Contexto técnico

Mesmo stack e camadas das features anteriores (`docs/sistema/`): Next.js 16 (App Router, server
actions), TypeScript estrito, Drizzle + PostgreSQL com RLS por restaurante, decimal.js, Vitest
(unidade e integração com banco real), Stryker, Playwright (e2e e telas).

## Pesquisa e decisões (R1–R8)

- **R1 Tipo de operação = grupo de entidades.** `src/domain/audit/operation-types.ts` mapeia cada
  `entity` gravada hoje (`item`, `item_group`, `item_subgroup`, `recipe`, `addon`, `supplier`,
  `stock_movement`, `adjustment_request`, `dining_table`, `order`, `table_tab`, `cash_session`,
  `menu`, `menu_section`, `membership`, `invitation`, `restaurant`) para um dos 11 tipos da FR-003. Um
  teste lê o código (`entity: "…"` e `ENTITY = "…"` em `src/application`) e falha se aparecer
  entidade sem tipo.
- **R2 Consulta.** `audit.search(filter)` no `AuditRepo`: `where` por período em UTC (de/até locais
  convertidos no domínio, como `orders.ts`), `user_id`, `entity in (…)`, `action = 'DENIED'`;
  `order by occurred_at desc, id desc`, `limit 50 offset`, e `count(*)` na mesma transação. Junta
  `users.name`. Nome do registro: não há coluna; a tela mostra o tipo e o link para o registro
  (link montado por entidade no componente), e o nome quando está nas mudanças (`name`,
  `description`).
- **R3 Índices.** `audit_log_period (restaurant_id, occurred_at, id)` e
  `audit_log_user_period (restaurant_id, user_id, occurred_at, id)`, lidos de trás para frente (o
  `id` no fim atende o desempate `id desc` sem ordenar). Teste em
  `tests/integration/performance/indexes.test.ts` com `explain` (como as outras telas) e medição
  com 100 mil linhas em `docs/sistema/04-desempenho.md`.
- **R4 Tradutor único.** A tela usa `describeChange` e os rótulos de ação de `history-list.tsx`,
  movidos para `src/components/audit/entry-labels.ts` e usados pelos dois.
- **R5 Planilha.** `/equipe/auditoria/planilha` igual a `/vendas/planilha`: mesmo leitor de filtro,
  mesmo `authorize`, CSV com `;`, BOM e datas no fuso do restaurante.
- **R6 Operação pequena no banco.** Migração `0017_small_operation.sql`:
  `restaurants.small_operation boolean not null default false`;
  `adjustment_requests.self_decided boolean not null default false` (o nome diz "decidido por quem
  pediu", porque recusar também marca; exceção = `self_decided` e `APPROVED`); o `check`
  `adjustment_requests_other_decider` vira
  `decided_by is null or decided_by <> created_by or status = 'CANCELLED' or self_decided`; e
  `adjustment_requests_self_decided` só deixa a marca com `decided_by = created_by` e status
  `APPROVED` ou `REJECTED`. Na trilha, só a aprovação leva `selfApproved: [false, true]`. A versão do restaurante já existe (taxa de serviço usa trava otimista).
- **R7 Aprovação.** `decideAdjustment` lê `small_operation` com `for share` do restaurante na mesma
  transação e passa `selfAllowed` ao domínio (`decideAdjustment` em `movement.ts`); o domínio
  devolve `selfApproved` no plano. Permissão nova `restaurant.small_operation` (gerente) para ligar
  e desligar.
- **R8 Revisão semanal.** Tabela `exception_reviews (id, restaurant_id, week_start date, reviewed_by,
  reviewed_at, note)`, `unique (restaurant_id, week_start)`, trigger só inserção. Semana local
  (segunda) calculada no domínio (`src/domain/audit/week.ts`) com o fuso do restaurante. Aviso:
  uma consulta `distinct date_trunc('week', decided_at at time zone tz)` em `adjustment_requests`
  com a exceção menos as semanas revisadas, menos a semana atual; índice parcial
  `adjustment_requests_exceptions (restaurant_id, decided_at) where self_decided and status =
  'APPROVED'`. O aviso vem no casco de todas as telas do gerente (`getShellInfo`, mesma transação
  do cabeçalho), que é o que o projeto chama de "telas da equipe".

## Estrutura

```text
src/domain/audit/            operation-types.ts, week.ts, audit-filter.ts (+ testes)
src/application/audit/       search-audit.ts, small-operation.ts, exception-review.ts
src/infra/db/repositories/   audit-repository.ts (search), restaurant, exception-review
src/infra/db/migrations/     0017_small_operation.sql
src/components/audit/        entry-labels.ts, audit-filters.tsx, audit-table.tsx,
                             small-operation-form.tsx, week-review.tsx, review-banner.tsx
app/(app)/equipe/auditoria/  page.tsx, planilha/route.ts, revisao/page.tsx
app/(app)/equipe/operacao-pequena/page.tsx
tests/integration/audit/     search.test.ts, small-operation.test.ts, exception-review.test.ts
tests/screens/audit.spec.ts  e tests/e2e/audit.spec.ts
```

## Portão

`pnpm test:audit` (vitest `--mode audit`) com 100% em `src/domain/audit/**`,
`src/application/audit/**`, `src/components/audit/**`, os repositórios novos e as partes mudadas de
`movement.ts`/`movements.ts`; `test:mutation` já cobre todo `src/domain/**`. Entra como parte nova do
job `integracao` (`auditoria`); `tests/screens/audit.spec.ts` cai sozinho na parte `resto` do job
`telas`.

## Constituição

TDD (teste vermelho em commit antes de cada correção ou código novo), decimal exato, trilha só de
inserção, docs no mesmo PR, um PR para a feature inteira: sem violação.
