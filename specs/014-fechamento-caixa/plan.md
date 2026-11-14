# Plano técnico: 014 — Abrir e fechar o caixa do dia

**Branch**: `claude/project-thread-vfeeqt` | **Data**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Resumo

O caixa ganha **turno**: abre com o troco, todo pagamento da conta da mesa (011) entra no turno
aberto, sangrias e reforços entram e saem da gaveta, e o fechamento grava a contagem antes de
mostrar o esperado. O gerente vê o relatório de cada turno e a tela **Vendas** com o recebido por
forma de pagamento, as vendas por produto e por adicional, e a planilha.

Uma tabela de turno com um aberto por restaurante (índice único parcial), lançamentos de gaveta e
contagens só inserção, uma coluna `cash_session_id` nos pagamentos e remoções da 011 e as contas
do dinheiro no domínio puro `src/domain/cash/`. O relatório de vendas são consultas agregadas sobre
o que já existe; nenhuma tabela de resumo. Nenhuma dependência nova.

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19 |
| Dependências novas | Nenhuma |
| Banco | PostgreSQL 17 (Neon); migração `0014_cash_sessions` (a `0013` é da edição do cardápio) |
| Testes | Vitest (unidade, componentes e integração com PostgreSQL em container), Playwright |
| Plataforma | Vercel; Caixa em computador ou tablet; Vendas também no celular do gerente |
| Desempenho | Abrir < 15 s e fechar < 1 min de operação (SC-001, SC-002); Vendas de um dia com 500 pedidos < 2 s (SC-005), no máximo 5 idas ao banco |
| Restrições | Dinheiro em decimal exato sem arredondamento no esperado; lançamentos, contagens e pagamentos só inserção; turno fechado imutável; nada cruza restaurantes |
| Escala | Um turno aberto por restaurante; 1 a 3 turnos por dia; dezenas de sangrias por mês |

Nenhum ponto em aberto: as premissas da spec (tabela Decisões) cobrem as escolhas de negócio, e
[research.md](research.md) resolve as técnicas.

## Constituição

| Princípio | Como a 014 cumpre |
|---|---|
| I. Testes primeiro | Commit `test(014): … (vermelho)` antes de cada `feat(014)` em todas as camadas ([R12](research.md#r12-testes-primeiro-em-que-camada)). Testes nomeados pelas regras FR-001 a FR-007 e pelos casos-limite (duas aberturas, pagamento × fechamento, contagem desatualizada, pagamento tirado de outro turno) |
| II. Domínio puro | `src/domain/cash/` (`session.ts`, `entries.ts`, `count.ts`, `summary.ts`, `sales.ts`, `csv.ts`). Relógio, ids e fuso por parâmetro |
| III. Livro imutável | Sangria, reforço, contagem e remoções são inserções (`app_reject_change`). Turno fechado não aceita `UPDATE` (gatilho). Pagamentos continuam só inserção; a coluna nova é preenchida no `INSERT` |
| IV. Precisão | `numeric(12,2)` e `decimal.js`; o esperado é só soma e subtração. A porcentagem de cada produto em Vendas arredonda só na apresentação |
| V. Rastreabilidade | Quem e quando em cada linha; `audit_log` com `entity = cash_session`; contagens todas gravadas; o esperado não chega ao caixa antes da contagem ([R6](research.md#r6-quem-vê-o-esperado)); fechar turno de outra pessoa só gerente. RLS em todas as tabelas novas |
| VI. Docs vivas | Neste PR: spec, plano, glossário e roadmap. No PR da implementação: `docs/produto/pedidos/06-caixa-do-dia.md` (novo), `05-conta-da-mesa.md` (pagamento exige caixa aberto; tirar do "Fora desta versão"), `09-controles-e-permissoes.md` (ações `cash.*` e `sales.report`), `docs/sistema/pedidos/01-modelo-de-dados.md` e `02-regras.md`, `04-desempenho.md` (consultas de Vendas) |
| VII. Simplicidade | Um caixa por restaurante; relatório por consulta, sem tabela de resumo nem cache; CSV sem biblioteca; impressão do navegador |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1 Turno**: `cash_sessions` com um aberto por restaurante garantido pelo banco; `version` para
  trava otimista.
- **R2 Pagamento no turno**: `addPayment` e `removePayment` travam conta → turno, gravam
  `cash_session_id` e somam 1 no `version`; sem turno, `CASH_SESSION_REQUIRED`. Check
  `NOT VALID` deixa os pagamentos antigos sem turno.
- **R3 Sangria e reforço**: `cash_entries` e `cash_entry_removals`, só inserção, toque duplo
  por `client_request_id`.
- **R4 Contagem**: `cash_counts` só inserção, com o `version` do turno; o fechamento usa a última
  e recusa se o turno mudou depois dela.
- **R5 Domínio**: esperado, diferença, regras de sangria, abertura e cédulas em funções puras.
- **R6 Esperado escondido**: o caso de uso não devolve o esperado ao caixa antes da contagem.
- **R7 Vendas**: três consultas agregadas com índice; invariante Σ produtos = Σ pedidos.
- **R8 Planilha**: CSV com `;`, vírgula decimal, BOM e proteção contra fórmula.
- **R9 Dia do turno**: o da abertura; aviso de turno aberto há mais de 24 h.
- **R10 Permissões**: `cash.operate`, `cash.close_any`, `cash.expected`, `cash.history`,
  `sales.report`; menu ganha Turnos e Vendas.

## Modelo de dados (migração `0014_cash_sessions`)

Resumo; detalhe em [data-model.md](data-model.md).

```text
cash_sessions         status, business_day, opened_at/by, opening_float, previous_kept,
                      opening_note, closed_at/by, expected, counted, difference, kept,
                      service_charge,
                      closing_count_id, close_note, version        (um aberto por restaurante;
                                                                    fechado não muda)
cash_entries          cash_session_id, kind (WITHDRAWAL, SUPPLY), amount, reason, note,
                      client_request_id                            (só inserção)
cash_entry_removals   entry_id (único)                             (só inserção)
cash_counts           cash_session_id, counted, denominations, session_version   (só inserção)
tab_payments          + cash_session_id  (CHECK NOT NULL NOT VALID)
tab_payment_removals  + cash_session_id  (CHECK NOT NULL NOT VALID)
table_tabs            + cash_session_id  (turno em que a conta fechou)
```

## Casos de uso

Contrato completo em [contracts/use-cases.md](contracts/use-cases.md).

- Novos: `getCurrentCashSession`, `openCashSession`, `addCashEntry`, `removeCashEntry`,
  `countCash`, `closeCashSession`, `getCashSessionReport`, `listCashSessions`, `salesReport`; rota
  da planilha.
- Mudam (011): `addPayment`, `removePayment` (turno obrigatório), `closeTab`
  (`cash_session_id`), `getTab` e `listOpenTabs` (`cashSessionOpen`).

## Estrutura

```text
src/domain/cash/               session.ts (checkOpening, closingResult), entries.ts
                               (checkWithdrawal, checkSupplyRemoval, WITHDRAWAL_REASONS),
                               count.ts (DENOMINATIONS, checkCount), summary.ts (expectedCash,
                               sessionSummary, steps), sales.ts (salesShares), csv.ts (toCsv),
                               *.test.ts
src/domain/access/             permissions.ts (+ cash.*, sales.report)
src/application/cash/          sessions.ts, entries.ts, closing.ts, reports.ts, sales.ts, ports.ts
src/application/billing/       payments.ts, tabs.ts (mudanças da 011)
src/infra/db/                  schema/cash.ts, migrations/0014_cash_sessions.sql,
                               repositories/cash-repository.ts, report-repository.ts (+ vendas),
                               billing-repository.ts (+ cash_session_id)
src/actions/                   cash.ts, sales.ts
src/components/cash/           session-bar.tsx, open-form.tsx, entry-form.tsx, count-form.tsx
                               (calculadora de cédulas), close-result.tsx, session-report.tsx,
                               entry-receipt.tsx, sessions-list.tsx, *.test.tsx
src/components/sales/          sales-report.tsx, *.test.tsx
src/components/layout/         nav.tsx (+ Turnos, Vendas)
app/(app)/caixa/               page.tsx (barra do turno), fechar/page.tsx, turnos/page.tsx,
                               turnos/[id]/page.tsx, turnos/[id]/imprimir/page.tsx,
                               lancamentos/[id]/imprimir/page.tsx
app/(app)/vendas/              page.tsx, planilha/route.ts
tests/integration/cash/        abertura, um aberto por vez, pagamento no turno, corrida pagamento ×
                               fechamento, sangria e reforço, contagem e fechamento, turno fechado
                               imutável, outro turno, isolamento, vendas (SC-006)
tests/integration/performance/ indexes.test.ts (+ consultas de Vendas e turno), sales-report.test.ts
tests/e2e/                     cash.spec.ts (roteiro do quickstart), accessibility (Caixa, Fechar
                               caixa, Turnos, Vendas)
```

## Ordem de entrega (vira `tasks.md`)

1. Domínio: esperado e passo a passo, sangria e reforço, contagem e cédulas, fechamento e
   abertura, vendas e CSV; permissões novas. Cada função nasce de um teste vermelho com os números
   da spec.
2. Migração, schema, repositórios, gatilhos e RLS, com testes de integração (um aberto por vez,
   imutabilidade, isolamento).
3. US1 Abrir caixa → US2 Pagamento no turno (mudanças da 011 e corrida com o fechamento) → US3
   Sangria e reforço → US4 Contar e fechar → US5 Relatório do turno e impressão → US6 Vendas e
   planilha.
4. Docs (produto, sistema, permissões, decisões, desempenho) e e2e com axe.

## Riscos

- **Restaurante em produção sem turno aberto ao subir a versão**: o primeiro "Lançar pagamento"
  depois do deploy pede para abrir o caixa. Aceito e avisado no PR da implementação; a tela
  explica o que fazer.
- **Pagamento tirado de outro turno deixa o esperado negativo**: raro (precisa reabrir conta ou
  conta aberta de um turno para outro); mostrado em destaque, a conferência segue.
- **Mais uma trava no `addPayment`**: o turno serializa os pagamentos do restaurante. Com uma
  gaveta e poucos pagamentos por minuto, a espera é de milissegundos; o teste de corrida mede.
- **Vendas em período longo**: 31 dias de um restaurante movimentado são dezenas de milhares de
  linhas agregadas no banco; o teste de índices garante o plano. Medir com `scripts/perf` se a
  tela passar de 2 s.

## Complexity Tracking

Nenhuma violação.
