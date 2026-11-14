# Pesquisa: 014 — Abrir e fechar o caixa do dia

Cada decisão no formato: decisão, motivo e alternativas. As premissas de negócio estão na tabela
"Decisões" da [spec](spec.md); aqui ficam as escolhas técnicas. Nenhum ponto ficou em aberto.

## R1. Turno do caixa: um aberto por restaurante

- **Decisão**: tabela `cash_sessions` com `status` (`OPEN`, `CLOSED`) e índice único parcial
  `(restaurant_id) where status = 'OPEN'`. `openCashSession` faz `INSERT`; a violação do índice
  vira `CASH_SESSION_ALREADY_OPEN` com quem abriu e quando. O turno tem `version` (trava otimista),
  somado a cada pagamento, remoção, sangria, reforço e contagem.
- **Motivo**: o banco garante "um caixa aberto por vez" (FR-001) mesmo com duas telas tocando
  "Abrir caixa" ao mesmo tempo, como a conta da mesa na 011 (R1 de lá).
- **Alternativas**: um turno por usuário (o dono tem uma gaveta só; vários turnos abertos
  embaralham a conferência); turno implícito por dia, sem abertura (não guarda o troco inicial,
  que é o pedido).

## R2. Pagamento sempre dentro de um turno aberto

- **Decisão**: `tab_payments` ganha `cash_session_id` e `tab_payment_removals` também. `addPayment`
  e `removePayment` (011), na mesma transação, travam a conta (como hoje) e depois o turno aberto
  com `SELECT … FROM cash_sessions WHERE status = 'OPEN' FOR UPDATE`; sem turno, devolvem
  `CASH_SESSION_REQUIRED`. Gravam o id do turno e somam 1 no `version` do turno. A coluna nova tem
  `CHECK (cash_session_id IS NOT NULL) NOT VALID`: vale para toda linha nova e deixa os pagamentos
  de antes da 014 com nulo.
- **Ordem das travas**: sempre conta → turno. Sangria, reforço, contagem e fechamento só travam o
  turno, nunca uma conta; não há ciclo, então não há impasse.
- **Corrida com o fechamento**: o fechamento trava o turno. Um pagamento que chega junto espera; ao
  seguir, o `WHERE status = 'OPEN'` é reavaliado na linha nova (READ COMMITTED) e não acha o turno
  → `CASH_SESSION_REQUIRED`. Se o pagamento entrou antes, o `version` do turno mudou e o fechamento
  recusa (R4). Nenhum pagamento fica fora de turno ou entra em turno fechado (SC-003).
- **Alternativas**: ligar o pagamento ao turno por horário (`created_at` entre abertura e
  fechamento) sem coluna (quebra na corrida e não explica pagamento tirado de outro turno);
  permitir receber sem caixa aberto e encaixar depois (a conferência deixa de fechar).

## R3. Sangria e reforço: lançamentos só inserção

- **Decisão**: tabela `cash_entries` (`kind`: `WITHDRAWAL` sangria, `SUPPLY` reforço), com valor,
  motivo da sangria (enum `cash_withdrawal_reason`: `SAFE`, `SUPPLIER_PAYMENT`, `DAILY_EXPENSE`,
  `OTHER`), observação e `client_request_id` único por turno (toque duplo). "Tirar" insere em
  `cash_entry_removals` (`entry_id` único). Gatilho `app_reject_change` nas duas; `app_user` só
  `SELECT, INSERT`.
- **Motivo**: mesma linha dos pagamentos da 011 e do livro de estoque (princípio III): nada some, o
  relatório explica cada centavo.
- **Alternativas**: coluna `removed_at` com `UPDATE` (quebra o só inserção); sangria como
  "pagamento negativo" em `tab_payments` (mistura dinheiro de mesa com dinheiro de gaveta e quebra
  o resumo por forma de pagamento).

## R4. Contagem gravada antes de ver o esperado

- **Decisão**: tabela `cash_counts` (só inserção): turno, contado, contagem por cédula opcional
  (`jsonb` `{ "200": 1, "100": 0, …, "0.05": 3 }`, conferida pelo domínio: chaves da lista de
  cédulas e moedas do real, quantidades inteiras ≥ 0, soma = contado), e `session_version`, o
  `version` do turno no momento da contagem. `countCash` trava o turno, grava a contagem e devolve
  esperado e diferença. `closeCashSession` trava o turno, pega a última contagem e recusa com
  `COUNT_OUTDATED` se `session_version` ≠ `version` do turno (entrou dinheiro depois de contar).
- **Motivo**: o caixa não consegue "ajustar" o contado depois de ver o esperado sem deixar rastro
  (todas as contagens aparecem no relatório), e o fechamento usa um contado que corresponde ao
  estado do turno. A contagem não soma 1 no `version`: contar não muda o dinheiro, e somar
  quebraria a comparação. A trava basta para ordenar contagem e fechamento.
- **Alternativas**: mandar o contado só no fechamento (a observação obrigatória depende da
  diferença, que o caixa ainda não viu); mostrar o esperado sempre (o dono pediu conferência).

## R5. Contas do dinheiro no domínio puro

- **Decisão**: `src/domain/cash/` com funções puras e testadas por nome de regra:
  - `expectedCash({ openingFloat, cashReceived, cashRemovedFromOtherSessions, supplies, withdrawals })`;
  - `checkWithdrawal(amount, expected)`, `checkSupplyRemoval(amount, expected)`;
  - `checkCount({ counted, denominations })` e `DENOMINATIONS` (200 a 0,05);
  - `closingResult({ expected, counted, kept, note })` → diferença, `BALANCED | OVER | SHORT`,
    `NOTE_REQUIRED`, `KEPT_ABOVE_COUNTED`;
  - `checkOpening({ openingFloat, previousKept, note })` → `OPENING_NOTE_REQUIRED`;
  - `sessionSummary(...)` → recebido por forma, tirados de outro turno, passo a passo da US5;
  - `salesShares(rows)` → parte de cada produto no total, com soma exata (o resto do
    arredondamento da porcentagem fica só na apresentação).
  Tudo em `Decimal`; nenhuma divisão no esperado, nenhum arredondamento (constituição IV).
- **Motivo**: princípio II; é onde está o risco de errar dinheiro.
- **Alternativas**: calcular o esperado em SQL (difícil de testar em milissegundos e de nomear as
  regras).

## R6. Quem vê o esperado

- **Decisão**: `getCashSession` devolve `expected` e `difference` só se quem pede tem
  `cash.expected` (gerente) **ou** o turno já tem contagem. Sem isso, os campos vêm nulos (a tela
  nunca recebe o valor, nem escondido). O relatório de turno fechado mostra tudo.
- **Motivo**: o esperado não pode estar no HTML nem no payload antes da contagem; esconder só na
  tela não vale.
- **Alternativas**: esconder com CSS (o valor iria para o navegador).

## R7. Relatório de vendas: consultas agregadas por índice

- **Decisão**: três consultas na mesma transação, em paralelo onde a página permite
  (`docs/sistema/04-desempenho.md`, regras 3 e 4):
  1. **Turnos do período** (`cash_sessions.business_day` entre de e até, índice
     `(restaurant_id, business_day)`) com o recebido por forma de cada um: `sum` de
     `tab_payments` por `cash_session_id, method`, menos remoções no mesmo turno, e as remoções de
     outro turno por `cash_session_id, method` (índices `(cash_session_id)` nas duas tabelas).
  2. **Produtos**: `order_lines` ⨝ `orders` com `orders.business_day` no período (índice
     `orders_day` já existe) e `status <> 'CANCELLED'`, agrupado por `recipe_id`:
     `sum(quantity)` e `sum(quantity × unit_price)`; nome atual do produto.
  3. **Adicionais**: `order_line_addons` ⨝ linhas ⨝ pedidos do mesmo filtro, agrupado por
     `addon_id`: `sum(times × line.quantity)` e o valor.
  A taxa de serviço do período vem de `table_tabs` fechadas no período (`closed_day`, já
  indexado). A do turno vem da coluna nova `table_tabs.cash_session_id`, gravada pelo `closeTab`
  com o turno aberto (nula quando a conta de R$ 0,00 fecha sem caixa aberto), e é congelada em
  `cash_sessions.service_charge` no fechamento do turno: reabrir e fechar a conta depois não muda
  o turno antigo.
- **SC-006**: a soma de `quantity × unit_price` das linhas é o total do pedido (a 009 grava
  `orders.total` assim); o teste de integração confere centavo por centavo contra `orders.total`.
- **SC-005**: 500 pedidos com 3 linhas cada são ~1.500 linhas agregadas no banco; o teste
  `tests/integration/performance/indexes.test.ts` ganha as consultas novas, e um teste de
  integração conta as idas ao banco da página (no máximo 5).
- **Alternativas**: tabela de resumo diário atualizada a cada pedido (cache antes de um problema
  medido; constituição VII); calcular no navegador (manda todas as linhas para a tela).

## R8. Planilha (CSV)

- **Decisão**: rota `app/(app)/vendas/planilha/route.ts` (GET, mesma permissão `sales.report`) que
  chama o mesmo caso de uso e devolve `text/csv; charset=utf-8` com BOM, separador `;` e decimal
  com vírgula (o Excel em português abre direto). Uma função pura `toCsv(rows)` escapa aspas,
  `;` e quebras de linha (RFC 4180), testada com nomes de produto difíceis
  (`Suco "da casa"; 500 ml`). Fórmulas: célula que começa com `=`, `+`, `-` ou `@` ganha `'` na
  frente (injeção de fórmula).
- **Alternativas**: XLSX (dependência nova para pouco ganho); CSV com vírgula (o Excel brasileiro
  abre tudo numa coluna).

## R9. Dia do turno e turno esquecido aberto

- **Decisão**: `cash_sessions.business_day` = `businessDay(opened_at, timezone)` na abertura (a
  função da 009). A tela Caixa mostra o aviso de turno antigo quando `now − opened_at > 24 h`.
  Nada fecha sozinho.
- **Alternativas**: dia do fechamento (um turno da noite que fecha 00:30 cairia no dia seguinte,
  o que o dono não espera); fechar automático (sem contagem não há conferência).

## R10. Permissões e menu

- **Decisão**: ações novas em `src/domain/access/permissions.ts`:

  | Ação | Gerente | Caixa |
  |---|---|---|
  | `cash.operate` (abrir, sangria, reforço, tirar lançamento, contar e fechar o próprio turno) | ✓ | ✓ |
  | `cash.close_any` (fechar turno aberto por outra pessoa) | ✓ | |
  | `cash.expected` (ver o esperado do turno aberto antes da contagem) | ✓ | |
  | `cash.history` (relatório de turno fechado, lista de turnos) | ✓ | ✓ |
  | `sales.report` (tela Vendas e planilha) | ✓ | |

  "Próprio turno" = `opened_by` igual ao usuário. Menu: **Vendas** (`/vendas`, `sales.report`,
  área Operação, ícone `ChartColumn`) e **Turnos** (`/caixa/turnos`, `cash.history`). O papel
  Caixa continua entrando direto no Caixa.
- **Alternativas**: reaproveitar `tab.pay` para o turno (mistura receber da mesa com mexer na
  gaveta; o garçom nunca terá nenhum dos dois, mas um papel futuro de "atendente que recebe" talvez
  sim).

## R11. Impressão

- **Decisão**: relatório do turno e comprovante de sangria/reforço usam a regra `.tab-print` da
  011 (80 mm ou A4), em páginas `…/imprimir`. O comprovante tem a linha de assinatura.
- **Alternativas**: PDF no servidor (dependência nova; a impressão do navegador já resolve na 011).

## R12. Testes primeiro, em que camada

- **Decisão**: o dono reforçou na 013 que nenhuma linha de produção nasce sem teste vermelho. A
  014 segue a mesma regra (commit `test(014): … (vermelho)` antes do `feat(014)`, ou os dois no
  mesmo commit citando o teste) em todas as camadas:
  - **Domínio** (`src/domain/cash/*.test.ts`): um teste por regra nomeada (FR-001 a FR-005), com
    os números da spec; cobertura de 100% das linhas de `src/domain/cash/`.
  - **Integração** (PostgreSQL real): um aberto por vez com duas aberturas em paralelo; pagamento
    × fechamento em paralelo (nunca fora de turno); contagem desatualizada; pagamento tirado de
    outro turno; turno fechado imutável (gatilho); RLS entre restaurantes; esperado gravado =
    `expectedCash` refeito a partir das linhas (SC-004); vendas por produto = Σ `orders.total`
    (SC-006); consultas com índice.
  - **Componentes** (Vitest + Testing Library): barra do turno, formulários, calculadora de
    cédulas, esperado ausente antes da contagem.
  - **Ponta a ponta** (Playwright): o roteiro do [quickstart](quickstart.md), no computador e no
    tablet, com axe nas telas novas.
- **Alternativas**: só e2e para o fluxo (lento e não aponta qual regra quebrou).
