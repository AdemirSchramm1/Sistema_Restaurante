# Contratos: casos de uso e Server Actions (feature 014)

Mesmo formato da [011](../../011-fechamento-conta-mesa/contracts/use-cases.md): a ação lê a sessão,
monta o contexto, chama o caso de uso (que faz `assertCan` e grava auditoria `DENIED` quando nega),
abre `withTenantTx` e devolve `Result`. Dinheiro chega e sai como string decimal (`"150.00"`).

## Turno do caixa

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `getCurrentCashSession` | `tab.read` | – | `null` ou `{ id, openedAt, openedByName, openingFloat, receivedByMethod, ageHours, canOperate, version }` + `expected` (só com `cash.expected`, ver R6) + `previousKept` para o formulário de abertura | – |
| `openCashSession` | `cash.operate` | `openingFloat`, `note?`, `clientRequestId` | `{ id }` | `INVALID_AMOUNT`, `OPENING_NOTE_REQUIRED`, `NOTE_TOO_LONG`, `CASH_SESSION_ALREADY_OPEN` (`{ openedByName, openedAt }`) |
| `addCashEntry` | `cash.operate` | `kind` (`WITHDRAWAL`/`SUPPLY`), `amount`, `reason?` (só sangria), `note?`, `clientRequestId`, `version` | `{ entryId }` | `INVALID_AMOUNT`, `REASON_REQUIRED`, `NOTE_REQUIRED` (motivo Outro), `NOTE_TOO_LONG`, `WITHDRAWAL_EXCEEDS_EXPECTED` (`{ expected }`), `CASH_SESSION_REQUIRED` |
| `removeCashEntry` | `cash.operate` | `entryId` | – | `ALREADY_REMOVED`, `EXPECTED_WOULD_BE_NEGATIVE`, `CASH_SESSION_CLOSED`, `NOT_FOUND` |
| `countCash` | `cash.operate`; turno de outra pessoa também `cash.close_any` | `counted`, `denominations?` | `{ countId, expected, difference, result }` (`BALANCED`/`OVER`/`SHORT`) | `INVALID_AMOUNT`, `DENOMINATIONS_MISMATCH`, `CASH_SESSION_REQUIRED`, `FORBIDDEN` |
| `closeCashSession` | igual a `countCash` | `kept`, `note?` | `{ sessionId }` | `COUNT_REQUIRED`, `COUNT_OUTDATED` ("Entrou dinheiro no turno depois da contagem. Conte de novo."), `NOTE_REQUIRED`, `KEPT_ABOVE_COUNTED`, `CASH_SESSION_ALREADY_CLOSED` (`{ closedByName, closedAt }`) |
| `getCashSessionReport` | `cash.history`; turno aberto também `cash.expected` para ver esperado | `id` | relatório da US5: abertura, `receivedByMethod`, `removedFromOtherSessions`, `serviceCharge`, entradas (com tiradas), contagens, `steps` (passo a passo), `expected`, `counted`, `difference`, `result`, `kept`, `takenToSafe`, fechamento | `NOT_FOUND` |
| `listCashSessions` | `cash.history` | `from`, `to` (dias, até 31) | `{ id, businessDay, openedAt, openedByName, closedAt, closedByName, received, difference, result }[]` | `INVALID_PERIOD` |

Notas:

- `countCash` e `closeCashSession` não recebem `version`: travam o turno e comparam a última
  contagem com o `version` atual (R4).
- `closeCashSession` devolve no aviso quantas contas de mesa ainda estão abertas
  (`openTabs`), só para a tela; não bloqueia.
- O caixa que não tem `cash.expected` só recebe `expected` depois de gravar uma contagem.

## Vendas

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `salesReport` | `sales.report` | `from`, `to` (dias, até 31) | `{ byMethod: { method, amount }[], removedFromOtherSessions, serviceCharge, received, products: { recipeId, name, quantity, amount, share }[], productsTotal, addons: { addonId, name, times, amount }[], sessions: (linha de listCashSessions)[], differenceTotal, pendingOrders }` | `INVALID_PERIOD` |
| Rota `GET /vendas/planilha?de=&ate=` | `sales.report` | período | `text/csv` (`;`, vírgula decimal, BOM), duas seções: formas de pagamento e produtos | 403 sem permissão, 400 período inválido |

## Mudanças em casos de uso da 011

| Caso de uso | Mudança |
|---|---|
| `addPayment` | Depois de travar a conta, trava o turno aberto; grava `cash_session_id`; +1 no `version` do turno. Erro novo: `CASH_SESSION_REQUIRED` ("Abra o caixa antes de receber.") |
| `removePayment` | Igual: trava o turno, grava `cash_session_id` na remoção, +1 no `version`. Erro novo: `CASH_SESSION_REQUIRED` ("Abra o caixa antes de tirar um pagamento.") |
| `closeTab` | Grava `cash_session_id` do turno aberto, se houver (sem travar; leitura simples). Conta de R$ 0,00 fecha sem turno |
| `reopenTab` | Não mexe em `cash_session_id`; o próximo `closeTab` grava o turno de então (o turno fechado guarda a própria taxa) |
| `getTab` / `listOpenTabs` | Trazem `cashSessionOpen: boolean` para a tela desligar "Lançar pagamento" com o motivo |

## Permissões novas (`src/domain/access/permissions.ts`)

| Ação | Gerente | Caixa | Garçom | Chef |
|---|---|---|---|---|
| `cash.operate` | ✓ | ✓ | | |
| `cash.close_any` | ✓ | | | |
| `cash.expected` | ✓ | | | |
| `cash.history` | ✓ | ✓ | | |
| `sales.report` | ✓ | | | |

## Telas

| Endereço | Permissão | O que é |
|---|---|---|
| `/caixa` (011) | `tab.read` | Ganha a barra do turno: "Caixa fechado" + **Abrir caixa**, ou "Caixa aberto desde 11:02 · Ana" + **Sangria**, **Reforço**, **Fechar caixa** (com `cash.operate`) |
| `/caixa/fechar` | `cash.operate` | Contagem (com a calculadora de cédulas), resultado, fica na gaveta, observação, fechar |
| `/caixa/turnos` | `cash.history` | Lista de turnos por período |
| `/caixa/turnos/[id]` e `…/imprimir` | `cash.history` | Relatório do turno (US5) |
| `/caixa/lancamentos/[id]/imprimir` | `cash.operate` | Comprovante de sangria ou reforço |
| `/vendas` | `sales.report` | Relatório de vendas (US6) |

## Auditoria

| Operação | Onde |
|---|---|
| Abrir, sangria, reforço, tirar lançamento, contar, fechar | Linhas próprias (só inserção) + `audit_log` com `entity = cash_session` |
| Pagamento e remoção ligados ao turno | `tab_events` e `audit_log` da 011, agora com `cashSessionId` nos detalhes |
