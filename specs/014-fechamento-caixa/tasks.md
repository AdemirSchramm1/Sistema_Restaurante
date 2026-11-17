# Tarefas — 014 Abrir e fechar o caixa do dia

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[quickstart.md](quickstart.md).

## Regras (constituição I e [research R12](research.md#r12-testes-primeiro-em-que-camada))

- Toda tarefa de código vem **depois** da tarefa `[teste]` que a exige. O teste é escrito, rodado e
  visto falhar **na asserção** (não no `import`: crie um esqueleto vazio antes, se preciso). Só
  então entra o mínimo de código para passar.
- Commits: `test(014): … (vermelho)` antes de `feat(014): …` do mesmo assunto, citando o número da
  tarefa. Refatoração só com tudo verde.
- Nenhum `.skip`, `.only` ou teste apagado. Nenhum teste da 011 muda de sentido: os que lançam
  pagamento passam a abrir o caixa antes (T029), e é só isso.
- Dinheiro sempre em `Decimal` (`src/domain/shared/decimal.ts`); nada de `number` para valor.
- Uma tarefa de código só é marcada como feita com `pnpm test:cash` em 100% para os arquivos dela.
- `[P]` = pode andar em paralelo (arquivos diferentes, sem depender de tarefa aberta). `[USn]` =
  história da spec.
- Números dos testes: os da spec e do [quickstart](quickstart.md) (troco R$ 150,00; dinheiro
  R$ 77,00 com recebido R$ 100,00; Pix R$ 40,00; sangria R$ 150,00; reforço R$ 50,00; esperado
  R$ 127,00; contado R$ 125,00 → "Falta R$ 2,00").

## Fase 1: Ferramentas de teste

- [x] T001 Modo `cash` em `vitest.config.mts` (como o `menu` da 013) e script `test:cash` em `package.json`: projetos `unit` e `integration` juntos, cobertura só de `src/domain/cash/**`, `src/application/cash/**`, `src/components/cash/**`, `src/components/sales/**` e `src/infra/db/repositories/cash-repository.ts`, limite de 100% de linhas, desvios e funções, relatório em `coverage/cash`
- [x] T002 `stryker.config.json`: `mutate` passa a incluir `src/domain/cash/**/*.ts` e excluir `src/domain/cash/**/*.test.ts`; `thresholds.break` continua 100
- [x] T003 `.github/workflows/ci.yml`: `pnpm test:cash` no job `integracao`, junto do `pnpm test:menu`

## Fase 2: Base (bloqueia todas as histórias)

- [x] T004 [P] [teste] `src/domain/access/permissions.test.ts`: `cash.operate` e `cash.history` são de `MANAGER` e `CASHIER`; `cash.close_any`, `cash.expected` e `sales.report` só de `MANAGER`; `WAITER` e `CHEF` não têm nenhuma `cash.*` nem `sales.report`
- [x] T005 [P] Ações `cash.operate`, `cash.close_any`, `cash.expected`, `cash.history` e `sales.report` em `src/domain/access/permissions.ts` (verde o T004)
- [x] T006 [P] [teste] `src/domain/cash/summary.test.ts` (`describe` cita FR-004): `expectedCash` com o exemplo da US5 dá R$ 127,00 (`150 + 77 − 0 + 50 − 150`); sem nenhum lançamento = troco inicial; pagamento em dinheiro tirado de outro turno subtrai; resultado pode ser negativo (caso-limite); nenhum arredondamento (`0.01` somado 3 vezes = `0.03`). `receivedByMethod`: pagamentos do turno por forma, menos os tirados no próprio turno; um tirado num turno seguinte continua no de origem; formas sem pagamento vêm com R$ 0,00 na ordem de `PAYMENT_METHODS`. `steps` devolve as 6 linhas do passo a passo da US5 na ordem da spec
- [x] T007 [P] `src/domain/cash/summary.ts` (verde o T006)
- [x] T008 [P] Códigos `CASH_SESSION_REQUIRED`, `CASH_SESSION_ALREADY_OPEN`, `CASH_SESSION_ALREADY_CLOSED`, `CASH_SESSION_CLOSED`, `OPENING_NOTE_REQUIRED`, `WITHDRAWAL_EXCEEDS_EXPECTED`, `EXPECTED_WOULD_BE_NEGATIVE`, `DENOMINATIONS_MISMATCH`, `COUNT_REQUIRED`, `COUNT_OUTDATED`, `KEPT_ABOVE_COUNTED` e `NOTE_REQUIRED` em `src/domain/shared/result.ts`
- [x] T009 [P] [teste] `src/components/forms/error-messages.test.ts`: cada código do T008 tem o texto da spec ("Abra o caixa antes de receber.", "O caixa já foi aberto por {nome} às {hora}.", "A gaveta deve ter {esperado}. A sangria não pode passar disso.", "Sem esse reforço a gaveta ficaria negativa. Tire uma sangria antes.", "Entrou dinheiro no turno depois da contagem. Conte de novo.", "O caixa já foi fechado por {nome} às {hora}." …)
- [x] T010 [P] Textos em `src/components/forms/error-messages.ts` (verde o T009)
- [x] T011 [teste] `tests/integration/cash/schema.test.ts`, conferindo cada regra de [data-model.md](data-model.md):
  - `cash_sessions`: "Único aberto: `(restaurant_id) where status = 'OPEN'`" (segundo `OPEN` recusado; `OPEN` em outro restaurante aceito); `opening_float` "≥ 0"; `opening_note` "1 a 140; obrigatória se `previous_kept` não é nulo e ≠ `opening_float`"; `closed_at`, `closed_by` "Preenchidos só em `CLOSED`"; "todos preenchidos em `CLOSED`; `difference = counted − expected`; `0 ≤ kept ≤ counted`; `counted ≥ 0`"; `close_note` "obrigatória se `difference ≠ 0`"; gatilho `cash_session_closed_is_final` recusa `UPDATE` em linha `CLOSED`
  - `cash_entries`: `amount` "> 0"; `reason` "Obrigatório em `WITHDRAWAL`, nulo em `SUPPLY`"; `note` "Até 140; obrigatória quando `reason = 'OTHER'`"; `client_request_id` "Único com `cash_session_id`"; `UPDATE` e `DELETE` recusados (`app_reject_change`)
  - `cash_entry_removals`: `entry_id` único; `UPDATE` e `DELETE` recusados
  - `cash_counts`: `counted` "≥ 0"; `UPDATE` e `DELETE` recusados
  - `tab_payments` e `tab_payment_removals`: linha nova sem `cash_session_id` é recusada; as linhas de antes da migração continuam válidas (`NOT VALID`)
  - RLS: um restaurante não lê nem grava turno, lançamento, remoção ou contagem de outro; `app_user` só tem `SELECT, INSERT` nas tabelas só inserção
- [x] T012 `src/infra/db/schema/cash.ts` (`cash_sessions`, `cash_entries`, `cash_entry_removals`, `cash_counts`, enums `cash_session_status`, `cash_entry_kind`, `cash_withdrawal_reason`), colunas `cash_session_id` em `tab_payments`, `tab_payment_removals` e `table_tabs` (`src/infra/db/schema/billing.ts`), `src/infra/db/schema/index.ts` e a migração `src/infra/db/migrations/0014_cash_sessions.sql` com gatilhos, checks, RLS, `GRANT` e os índices `(restaurant_id, business_day)`, `cash_entries (cash_session_id)`, `cash_counts (cash_session_id, created_at)`, `tab_payments (cash_session_id, method)`, `tab_payment_removals (cash_session_id)`, `table_tabs (cash_session_id)` (verde o T011)
- [x] T013 [P] `tests/builders/cash-data.ts` e `tests/integration/cash/fixtures.ts`: restaurante com gerente, dois caixas (Ana e Bruno), garçom e chef; mesas 4 e 12; X-Burger a R$ 30,00 com o adicional "Fatia de queijo" a R$ 2,00; Suco a R$ 9,00; taxa de serviço desligada; ajudante `openSession(valor)`
- [x] T014 [teste] `tests/integration/cash/repository.test.ts`: `cash-repository` abre turno e devolve o aberto; `lockOpen()` trava e devolve nulo sem turno; grava e lista lançamentos com remoção; grava contagens e devolve a última; soma por turno o recebido por forma, os tirados no próprio turno e os tirados de outro turno, numa ida ao banco cada; `close` grava o retrato e soma 1 no `version`; `bumpVersion` soma 1
- [x] T015 `src/infra/db/repositories/cash-repository.ts`, portas `CashSessionRepo` em `src/application/cash/ports.ts` e ligação em `src/application/ports.ts` e `src/infra/deps.ts` (verde o T014)

**Ponto de controle**: `pnpm test:cash` verde; esquema e domínio prontos.

## Fase 3: US1 — Abrir o caixa com o troco (P1) 🎯 MVP

**Objetivo**: o caixa abre o turno com o troco; um aberto por restaurante.
**Teste independente**: Ana abre com R$ 150,00 e vê "Caixa aberto desde 11:02 · Ana"; Bruno tenta
abrir em seguida e vê quem abriu.

- [x] T016 [P] [teste] [US1] `src/domain/cash/session.test.ts` (FR-001): `checkOpening` aceita R$ 0,00 e R$ 150,00; recusa negativo e 3 casas (`INVALID_AMOUNT`); com `previousKept` R$ 150,00 e troco R$ 150,00 não pede observação; com troco R$ 120,00 sem observação → `OPENING_NOTE_REQUIRED`; observação de 141 → `NOTE_TOO_LONG`; sem turno anterior (`previousKept` nulo) nunca pede
- [x] T017 [P] [US1] `checkOpening` em `src/domain/cash/session.ts`
- [x] T018 [teste] [US1] `tests/integration/cash/open.test.ts`: `openCashSession` grava troco, quem, quando, `business_day` no fuso do restaurante (turno aberto 23:30 fica no dia da abertura) e `previous_kept` do último turno fechado; duas aberturas em paralelo → uma abre e a outra recebe `CASH_SESSION_ALREADY_OPEN` com `openedByName` e `openedAt`; mesmo `clientRequestId` devolve o mesmo turno; garçom e chef → `FORBIDDEN` com auditoria `DENIED`; `getCurrentCashSession` devolve nulo sem turno e o turno com `ageHours`; abertura vai para `audit_log` com `entity = cash_session`
- [x] T019 [US1] `openCashSession` e `getCurrentCashSession` em `src/application/cash/sessions.ts` (verde o T018)
- [x] T020 [P] [teste] [US1] `src/components/cash/session-bar.test.tsx`: sem turno mostra "Caixa fechado" e **Abrir caixa** só para quem tem `cash.operate`; com turno mostra "Caixa aberto desde 11:02 · Ana" e **Sangria**, **Reforço**, **Fechar caixa**; com `ageHours > 24` mostra "O caixa está aberto desde ontem 11:02. Feche o caixa para conferir o turno."; garçom vê a situação sem botões
- [x] T021 [P] [US1] `src/components/cash/session-bar.tsx` (verde o T020)
- [x] T022 [P] [teste] [US1] `src/components/cash/open-form.test.tsx`: o campo vem com o `previousKept`; mudar o valor mostra o campo de observação com "Ficaram R$ 150,00 na gaveta no fechamento de ontem. Por que o troco é outro?"; toque duplo envia um pedido só; erro do servidor aparece no `Alert`
- [x] T023 [P] [US1] `src/components/cash/open-form.tsx` (verde o T022)
- [x] T024 [US1] Ações `openCashSessionAction` em `src/actions/cash.ts`; barra e formulário no topo de `app/(app)/caixa/page.tsx`, lendo `getCurrentCashSession` junto com `listOpenTabs` num `Promise.all`
- [x] T025 [US1] [teste] `tests/integration/performance/indexes.test.ts`: a consulta do turno aberto e a do último turno fechado usam índice

**Ponto de controle**: abrir o caixa funciona sozinho; nada da 011 mudou ainda.

## Fase 4: US2 — Todo pagamento entra no turno (P1)

**Objetivo**: pagamento e remoção só com caixa aberto, ligados ao turno.
**Teste independente**: com o turno de R$ 150,00, R$ 77,00 em dinheiro (recebido R$ 100,00) e
R$ 40,00 em Pix; o turno mostra Dinheiro R$ 77,00, Pix R$ 40,00 e (para o gerente) esperado
R$ 227,00.

- [x] T026 [teste] [US2] `tests/integration/cash/payments.test.ts`: `addPayment` sem turno → `CASH_SESSION_REQUIRED` e nada gravado; com turno grava `cash_session_id` e soma 1 no `version` do turno; `removePayment` sem turno → `CASH_SESSION_REQUIRED`; com turno grava `cash_session_id` na remoção; pagamento do turno A tirado no turno B (conta reaberta) aparece em "tirados de outro turno" de B e não muda o recebido de A; pagamento de antes da 014 (sem turno) tirado num turno também; `closeTab` grava `cash_session_id` do turno aberto; conta de R$ 0,00 fecha sem turno com `cash_session_id` nulo; `reopenTab` não mexe no `cash_session_id`
- [x] T027 [teste] [US2] `tests/integration/cash/race.test.ts`: 20 rodadas de `addPayment` × `closeCashSession` em paralelo no mesmo turno: em todas, ou o pagamento entra antes e o fechamento recebe `COUNT_OUTDATED`, ou o fechamento vale e o pagamento recebe `CASH_SESSION_REQUIRED`; nenhum pagamento com `cash_session_id` de turno `CLOSED` gravado depois do fechamento; nenhum impasse (ordem de trava conta → turno)
- [x] T028 [US2] `src/application/billing/payments.ts` (`addPayment`, `removePayment`: depois de travar a conta, `cashSessions.lockOpen()`, gravar o id e `bumpVersion`; detalhes do evento e da auditoria com `cashSessionId`) e `src/application/billing/tabs.ts` (`closeTab` grava o turno aberto sem travar; `getTab` e `listOpenTabs` devolvem `cashSessionOpen`) e `billing-repository.ts` (colunas novas) (verde o T026 e o T027)
- [x] T029 [US2] Ajustar os testes de integração e ponta a ponta da 011 que lançam pagamento (`tests/integration/billing/*.test.ts`, `tests/e2e/billing.spec.ts`) para abrir o caixa antes, pelo ajudante do T013, sem mudar o que eles conferem; rodar a pasta inteira verde
- [x] T030 [P] [teste] [US2] `src/components/billing/payment-panel.test.tsx`: com `cashSessionOpen = false`, **Lançar pagamento** e **Tirar** ficam desligados com "Abra o caixa antes de receber."; com `true`, como hoje
- [x] T031 [P] [US2] `src/components/billing/payment-panel.tsx` e `src/components/billing/tab-detail.tsx` recebem `cashSessionOpen` (verde o T030)
- [x] T032 [US2] [teste] `tests/integration/performance/indexes.test.ts`: as somas por turno e forma (`tab_payments (cash_session_id, method)`, `tab_payment_removals (cash_session_id)`) usam índice

## Fase 5: US3 — Registrar sangria e reforço (P1)

**Objetivo**: dinheiro que sai e entra na gaveta fica registrado e conta no esperado.
**Teste independente**: com R$ 227,00 esperados, sangria de R$ 150,00 (Cofre) e reforço de
R$ 50,00 → esperado R$ 127,00.

- [x] T033 [P] [teste] [US3] `src/domain/cash/entries.test.ts` (FR-003): `WITHDRAWAL_REASONS` é `SAFE`, `SUPPLIER_PAYMENT`, `DAILY_EXPENSE`, `OTHER` com os textos "Cofre", "Pagamento a fornecedor", "Despesa do dia", "Outro"; `checkWithdrawal` com esperado R$ 227,00 aceita R$ 227,00 e recusa R$ 227,01 (`WITHDRAWAL_EXCEEDS_EXPECTED` com o esperado); valor 0 ou 3 casas → `INVALID_AMOUNT`; sem motivo → `REASON_REQUIRED`; motivo Outro sem observação → `NOTE_REQUIRED`; observação de 141 → `NOTE_TOO_LONG`. `checkSupply`: valor > 0, 2 casas, observação opcional até 140. `checkSupplyRemoval`: esperado R$ 127,00 e reforço R$ 50,00 passa; esperado R$ 30,00 e reforço R$ 50,00 → `EXPECTED_WOULD_BE_NEGATIVE`
- [x] T034 [P] [US3] `src/domain/cash/entries.ts` (verde o T033)
- [x] T035 [teste] [US3] `tests/integration/cash/entries.test.ts`: `addCashEntry` grava sangria e reforço com quem e quando e soma 1 no `version`; sem turno → `CASH_SESSION_REQUIRED`; sangria acima do esperado recusada com o esperado do momento; duas sangrias em paralelo que juntas passariam do esperado → a segunda é recusada; mesmo `clientRequestId` devolve o mesmo lançamento; `removeCashEntry` grava a remoção, o lançamento continua na lista, riscado; tirar duas vezes → `ALREADY_REMOVED`; tirar de turno fechado → `CASH_SESSION_CLOSED`; tirar reforço que deixaria o esperado negativo → `EXPECTED_WOULD_BE_NEGATIVE`; caixa sem `cash.operate` (garçom) → `FORBIDDEN`; tudo no `audit_log`
- [x] T036 [US3] `addCashEntry` e `removeCashEntry` em `src/application/cash/entries.ts` (verde o T035)
- [x] T037 [P] [teste] [US3] `src/components/cash/entry-form.test.tsx`: sangria mostra os 4 motivos e pede observação só em Outro; reforço não tem motivo; mostra o erro da sangria acima do esperado; toque duplo envia um só; depois de gravar oferece **Imprimir comprovante**
- [x] T038 [P] [US3] `src/components/cash/entry-form.tsx` (verde o T037)
- [x] T039 [P] [teste] [US3] `src/components/cash/entry-receipt.test.tsx`: comprovante com "Sangria" ou "Reforço", valor, motivo, observação, data e hora no fuso do restaurante, quem lançou, linha "Assinatura" e "Não é documento fiscal"; usa `.tab-print`
- [x] T040 [P] [US3] `src/components/cash/entry-receipt.tsx` e `app/(app)/caixa/lancamentos/[id]/imprimir/page.tsx` (verde o T039)
- [x] T041 [US3] Ações `addCashEntryAction` e `removeCashEntryAction` em `src/actions/cash.ts`; **Sangria** e **Reforço** da barra abrem o formulário; lista dos lançamentos do turno com **Tirar** (confirmação) em `app/(app)/caixa/page.tsx`

## Fase 6: US4 — Fechar o caixa conferindo o dinheiro (P1)

**Objetivo**: contar antes de ver o esperado, gravar toda contagem e fechar com o retrato.
**Teste independente**: esperado R$ 127,00, contado R$ 125,00, observação "Troco errado na mesa 4"
→ "Falta R$ 2,00"; o caixa fica fechado e lançar pagamento volta a pedir a abertura.

- [x] T042 [P] [teste] [US4] `src/domain/cash/count.test.ts`: `DENOMINATIONS` é 200, 100, 50, 20, 10, 5, 2, 1, 0,50, 0,25, 0,10, 0,05; `checkCount` aceita R$ 0,00 e R$ 125,00; recusa negativo e 3 casas; com cédulas `{ "100": 1, "20": 1, "5": 1 }` e contado R$ 125,00 passa; soma diferente → `DENOMINATIONS_MISMATCH`; chave fora da lista, quantidade negativa ou fracionária → `DENOMINATIONS_MISMATCH`; `sumDenominations` soma sem erro de ponto flutuante (`{ "0.10": 3 }` = R$ 0,30)
- [x] T043 [P] [US4] `src/domain/cash/count.ts` (verde o T042)
- [x] T044 [P] [teste] [US4] `src/domain/cash/session.test.ts` (FR-005), `closingResult`: contado = esperado → `BALANCED`, sem observação; contado R$ 125,00 e esperado R$ 127,00 → diferença −R$ 2,00, `SHORT`, sem observação → `NOTE_REQUIRED`; contado R$ 130,00 → `OVER` R$ 3,00; `kept` acima do contado → `KEPT_ABOVE_COUNTED`; `kept` nulo vira o contado; retirada do fechamento = contado − `kept`; esperado negativo funciona igual
- [x] T045 [P] [US4] `closingResult` em `src/domain/cash/session.ts` (verde o T044)
- [x] T046 [teste] [US4] `tests/integration/cash/close.test.ts`: `countCash` grava a contagem com `session_version` e devolve esperado, diferença e resultado, e **não** soma 1 no `version`; `closeCashSession` sem contagem → `COUNT_REQUIRED`; reforço depois da contagem → `COUNT_OUTDATED`; nova contagem e fechamento valem e usam a última (`closing_count_id`); grava `expected`, `counted`, `difference`, `kept`, `service_charge` (taxa das contas com `cash_session_id` do turno), `closed_at`, `closed_by`, `close_note`; depois de fechado, `UPDATE` direto é recusado e `addPayment` → `CASH_SESSION_REQUIRED`; dois fechamentos em paralelo → um vale, o outro `CASH_SESSION_ALREADY_CLOSED` com quem e quando; Bruno não fecha o turno de Ana (`FORBIDDEN`) e o gerente fecha; a resposta traz `openTabs` com as contas de mesa abertas; esperado gravado = `expectedCash` refeito a partir das linhas (SC-004)
- [x] T047 [US4] `countCash` e `closeCashSession` em `src/application/cash/closing.ts` (verde o T046)
- [x] T048 [P] [teste] [US4] `src/components/cash/count-form.test.tsx`: a calculadora tem as 12 cédulas e moedas e soma no campo (1 × 100 + 1 × 20 + 1 × 5 = R$ 125,00); o caixa pode digitar o total direto; **Confirmar contagem** envia o contado e as cédulas; antes de confirmar, nenhum valor esperado está na página (nem no HTML)
- [x] T049 [P] [US4] `src/components/cash/count-form.tsx` (verde o T048)
- [x] T050 [P] [teste] [US4] `src/components/cash/close-result.test.tsx`: mostra "Bateu", "Sobra R$ 3,00" ou "Falta R$ 2,00" com o esperado; com diferença a observação é obrigatória; **Fica na gaveta** vem com o contado e mostra a retirada; **Contar de novo** volta à contagem; aviso "3 mesas ainda têm conta aberta. Os pagamentos delas vão entrar no próximo turno."; recusa `COUNT_OUTDATED` mostra o texto e volta à contagem
- [x] T051 [P] [US4] `src/components/cash/close-result.tsx` (verde o T050)
- [x] T052 [US4] Ações `countCashAction` e `closeCashSessionAction` em `src/actions/cash.ts` e `app/(app)/caixa/fechar/page.tsx` (contagem → resultado → fechar → relatório do turno)
- [x] T053 [US4] [teste] `tests/integration/performance/indexes.test.ts`: a última contagem do turno e a taxa das contas do turno usam índice

## Fase 7: US5 — Relatório do turno (P1)

**Objetivo**: ver quanto entrou, quanto saiu e se bateu, e imprimir.
**Teste independente**: o turno da US4 mostra troco R$ 150,00, Dinheiro R$ 77,00, Pix R$ 40,00,
sangria R$ 150,00, reforço R$ 50,00, esperado R$ 127,00, contado R$ 125,00, "Falta R$ 2,00".

- [x] T054 [teste] [US5] `tests/integration/cash/report.test.ts`: `getCashSessionReport` do turno fechado devolve abertura, `receivedByMethod`, `removedFromOtherSessions`, `serviceCharge` congelada (reabrir e fechar a conta depois não muda o turno), lançamentos com os tirados, todas as contagens em ordem, `steps`, resultado e retirada; turno aberto: gerente vê esperado, caixa sem contagem recebe `expected` nulo (FR-006, R6); `listCashSessions` por período (até 31 dias; 32 → `INVALID_PERIOD`) com o mais recente primeiro; garçom → `FORBIDDEN`
- [x] T055 [US5] `getCashSessionReport` e `listCashSessions` em `src/application/cash/reports.ts`; `sessionSummary` em `src/domain/cash/summary.ts` se o T054 pedir (com teste no `summary.test.ts` antes) (verde o T054)
- [x] T056 [P] [teste] [US5] `src/components/cash/session-report.test.tsx`: as seções da US5 na ordem, o passo a passo com os 6 valores, a linha "Pagamento tirado de outro turno" só quando existe, "1ª contagem R$ 120,00 · 2ª contagem R$ 125,00", esperado negativo em destaque, versão parcial sem contado e diferença, versão para impressão com "Não é documento fiscal"
- [x] T057 [P] [US5] `src/components/cash/session-report.tsx` (verde o T056)
- [x] T058 [P] [teste] [US5] `src/components/cash/sessions-list.test.tsx`: tabela com dia, abertura, fechamento, quem, recebido e selo "Bateu" (`success`), "Sobra" (`info`) ou "Falta" (`danger`), link para o relatório; lista vazia com `EmptyState` que explica
- [x] T059 [P] [US5] `src/components/cash/sessions-list.tsx` (verde o T058)
- [x] T060 [US5] `app/(app)/caixa/turnos/page.tsx`, `app/(app)/caixa/turnos/[id]/page.tsx` e `app/(app)/caixa/turnos/[id]/imprimir/page.tsx`; entrada **Turnos** (`/caixa/turnos`, `cash.history`, área Operação) em `src/components/layout/nav.tsx` com o teste de `nav` primeiro (`src/components/layout/nav.test.tsx`: o caixa vê Caixa, Contas, Turnos e Pedidos; o garçom não vê Turnos; "Turnos" fica ativo em `/caixa/turnos/…`)
- [ ] T061 [US5] [teste] `tests/integration/performance/indexes.test.ts`: lista de turnos por `business_day` usa `cash_sessions (restaurant_id, business_day)`

**Ponto de controle (MVP do pedido)**: US1 a US5 completas: o caixa abre, recebe, faz sangria e
reforço, conta e fecha, e o gerente vê o turno.

## Fase 8: US6 — Relatório de vendas por forma de pagamento e por produto (P2)

**Objetivo**: tela Vendas do gerente, com planilha.
**Teste independente**: 3 X-Burger (um com + 2 Fatia de queijo), 2 Sucos e um X-Burger cancelado →
"X-Burger 3 un R$ 94,00", "Suco 2 un R$ 18,00", adicionais, formas de pagamento e turnos do dia.

- [ ] T062 [P] [teste] [US6] `src/domain/cash/sales.test.ts`: `salesShares` ordena do maior valor para o menor (empate pelo nome), calcula a parte de cada um sobre o total sem arredondar o valor; a soma das partes apresentadas com 1 casa fecha em 100,0% (o resto vai para o maior); total zero → partes zero, sem divisão por zero
- [ ] T063 [P] [US6] `src/domain/cash/sales.ts` (verde o T062)
- [ ] T064 [P] [teste] [US6] `src/domain/cash/csv.test.ts`: `toCsv` usa `;`, BOM e quebra `\r\n`; decimal com vírgula ("94,00"); escapa aspas, `;` e quebra de linha (`Suco "da casa"; 500 ml` → `"Suco ""da casa""; 500 ml"`); célula que começa com `=`, `+`, `-` ou `@` ganha `'` na frente; valores negativos continuam números ("-2,00" como valor, não como texto de fórmula, porque vêm de `Decimal`)
- [ ] T065 [P] [US6] `src/domain/cash/csv.ts` (verde o T064)
- [ ] T066 [teste] [US6] `tests/integration/cash/sales.test.ts`: `salesReport` do dia do teste independente dá X-Burger 3 un R$ 94,00, Suco 2 un R$ 18,00, Fatia de queijo 2 vezes R$ 4,00, sem o cancelado; Σ produtos = Σ `orders.total` não cancelados do período, centavo por centavo (SC-006); `byMethod` = soma dos turnos do período; `serviceCharge` das contas com `closed_day` no período; turnos com diferença e `differenceTotal`; `pendingOrders` conta Recebido, Em preparo e Pronto; período de 32 dias → `INVALID_PERIOD`; caixa → `FORBIDDEN`; nada de outro restaurante
- [ ] T067 [US6] Consultas de vendas em `src/infra/db/repositories/report-repository.ts` e `salesReport` em `src/application/cash/sales.ts` (verde o T066)
- [ ] T068 [US6] [teste] `tests/integration/performance/sales-report.test.ts`: com 500 pedidos de 3 linhas num dia, `salesReport` faz no máximo 5 idas ao banco e responde em menos de 2 s no banco local (SC-005); `indexes.test.ts` ganha as consultas de produtos, adicionais e taxa do período
- [ ] T069 [P] [teste] [US6] `src/components/sales/sales-report.test.tsx`: filtro de período com "hoje" por padrão; tabelas de formas, produtos (com a parte em %) e adicionais; aviso de pedidos pendentes; o texto que explica por que vendas e recebido podem ser diferentes; turnos com link; **Baixar planilha** aponta para `/vendas/planilha?de=…&ate=…`; tabelas com `Td numeric`; lista vazia com `EmptyState`
- [ ] T070 [P] [US6] `src/components/sales/sales-report.tsx` (verde o T069)
- [ ] T071 [teste] [US6] `tests/integration/cash/sales-csv.test.ts`: a rota `GET /vendas/planilha` devolve `text/csv; charset=utf-8` com BOM e as duas seções; sem `sales.report` → 403; período inválido → 400
- [ ] T072 [US6] `app/(app)/vendas/page.tsx` e `app/(app)/vendas/planilha/route.ts`; entrada **Vendas** (`/vendas`, `sales.report`, área Operação, ícone `ChartColumn`) em `src/components/layout/nav.tsx` com o teste de `nav` antes (só o gerente vê) (verde o T071)

## Fase 9: Telas, ponta a ponta e documentação

- [ ] T073 [teste] `tests/screens/cash.spec.ts`: as telas Caixa (com e sem turno), Fechar caixa (contagem e resultado) e relatório do turno, nas larguras `tablet-em-pe`, `tablet-deitado` e `computador` da matriz, e a tela Vendas também em `celular-android`, passam `expectNoSideScroll`, `expectNoClippedText` e `expectTapTargets` (`tests/screens/layout.ts`), nos modos claro e escuro; corrigir só o que o teste apontar
- [ ] T074 [teste] `tests/e2e/cash.spec.ts`: o roteiro do [quickstart](quickstart.md) (passos 1 a 18) com caixa, segundo caixa e gerente em contextos separados; axe (WCAG 2.1 AA) em Caixa, Fechar caixa, Turnos, relatório do turno e Vendas em `tests/e2e/accessibility.spec.ts`
- [ ] T075 [P] `docs/produto/pedidos/07-caixa-do-dia.md` (novo; a 06 é a edição do cardápio): abrir, receber, sangria e reforço, contar e fechar, relatório do turno, Vendas, quem pode; `docs/produto/pedidos/05-conta-da-mesa.md` (pagamento exige caixa aberto; tirar "abertura e fechamento de caixa" do "Fora desta versão"); `docs/produto/pedidos/00-visao-geral.md`
- [ ] T076 [P] `docs/produto/estoque/09-controles-e-permissoes.md`: tabela "Caixa do dia (feature 014)" com `cash.operate`, `cash.close_any`, `cash.expected`, `cash.history`, `sales.report`; controles do manual que a 014 atende (sangria registrada com motivo, contagem antes de ver o esperado, todas as contagens guardadas, turno fechado imutável)
- [ ] T077 [P] `docs/sistema/pedidos/01-modelo-de-dados.md` e `02-regras.md` (turno, lançamentos, contagem, ordem de trava conta → turno, esperado); `docs/sistema/04-desempenho.md` (consultas de Vendas e o limite de 5 idas); `docs/produto/estoque/13-decisoes-adotadas.md` (as premissas da spec)
- [ ] T078 Roadmap em `docs/produto/estoque/00-visao-geral.md`: 014 "Feito"
- [ ] T079 `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:cash`, `pnpm test:mutation`, `pnpm test:integration` e `pnpm test:e2e --trace off` verdes; rodar o [quickstart](quickstart.md) à mão e marcar as tarefas

## Dependências

```text
Fase 1 ──► Fase 2 ──► US1 ──► US2 ──► US3 ──► US4 ──► US5 ──► US6 ──► Fase 9
                                        (US3 e US4 dependem do turno aberto da US1 e do
                                         version somado pela US2; US5 lê tudo de US1–US4;
                                         US6 lê os turnos da US5)
```

- US1 não depende da 011 mudar; US2 é a única que toca o código da 011 (T028, T029).
- Dentro de cada história: teste de domínio → domínio → teste de integração → caso de uso →
  teste de componente → componente → ação e página.

## Paralelo

- Fase 2: T004–T005, T006–T007, T008–T010 e T013 andam juntas; T011–T012 e T014–T015 em série.
- US1: T016–T017, T020–T021 e T022–T023 em paralelo, enquanto T018–T019 seguem.
- US3: T033–T034, T037–T038 e T039–T040 juntas.
- US4: T042–T043, T044–T045, T048–T049 e T050–T051 juntas.
- US6: T062–T063, T064–T065 e T069–T070 juntas.
- Docs (T075–T077) em paralelo com a Fase 9.

## Estratégia

1. **MVP**: Fases 1 e 2 + US1 a US5 (é o pedido do dono: abrir, sangria e reforço, conferir o
   dinheiro, relatório do turno). Já pode entrar em produção, avisando que o primeiro pagamento
   depois do deploy pede para abrir o caixa.
2. **Depois**: US6 (Vendas por forma e por produto, planilha).
3. Cada fase fecha com `pnpm test:cash` verde e um commit por par vermelho → verde.
