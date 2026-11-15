# Plano técnico: 015 — Garçom lança o pedido da mesa

**Branch**: `claude/project-thread-j5uiwg` | **Data**: 2026-11-15 | **Spec**: [spec.md](spec.md)

## Resumo

O garçom (e o gerente e o caixa) ganha a tela **Lançar pedido**: grade de mesas, o cardápio da 013
com os esgotados apagados, a tela do prato da 010 com a **observação para a cozinha**, um carrinho
por mesa guardado no aparelho e **Pedidos da mesa**. O pedido passa pela mesma conferência do QR
code (`checkOrder`), entra na mesma conta (011) e na mesma cozinha, e guarda **origem** e **quem
lançou**. Cozinha, Garçom, conta e consulta mostram de onde veio; a consulta filtra e resume por
origem. O garçom cancela só o que lançou e só antes do preparo.

Revisão para o salão (pedido do dono, 2026-11-15): **Pedir de novo** ("mais uma rodada" em 3
toques), **aviso de pedido parecido** quando outra pessoa ou o QR code lançou o mesmo produto na
mesa há até 5 minutos, **carrinho travado** quando o envio fica sem resposta (o reenvio nunca
duplica nem engole uma mudança), carrinho que sobrevive à sessão vencida, **Ver conta**, barra do
carrinho no pé da tela e cancelados por pessoa no resumo do gerente.

Nenhuma tabela nova: `orders` ganha `source` e `placed_by` (com `menu_access_id` opcional e um
check que amarra os três), `order_lines` ganha `kitchen_note`, e o motivo de cancelamento ganha
"Lançado errado". Um caso de uso novo (`placeStaffOrder`) divide com o `submitOrder` da 009 o
ajudante que grava pedido e conta. Nenhuma dependência nova.

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19 |
| Dependências novas | Nenhuma |
| Banco | PostgreSQL 17 (Neon); migração `0015_staff_orders` (a `0014` é da 014, caixa do dia, ainda não implementada; ver Riscos) |
| Testes | Vitest (unidade, componentes e integração com PostgreSQL em container), Playwright (ponta a ponta e matriz de telas da 013) |
| Plataforma | Vercel; garçom no próprio celular ou num tablet do restaurante; caixa no computador |
| Desempenho | Lançar 3 produtos em < 45 s (SC-001); 2 produtos simples em até 6 toques (SC-007); repetir um pedido em até 3 toques (SC-009); pedido na cozinha em ≤ 10 s (SC-004, mesmo `AutoRefresh`); grade e cardápio da mesa sem crescer em idas ao banco com o número de mesas ou produtos (regra da 012) |
| Restrições | Dinheiro em decimal exato; pedido, linhas e eventos só inserção; origem e quem lançou nunca mudam; uma conta aberta por mesa com qualquer mistura de origens; nada cruza restaurantes; cardápio do cliente não muda |
| Escala | 1 a 10 garçons por restaurante; até ~60 mesas; dezenas de pedidos por hora no pico |

Nenhum ponto em aberto: as premissas e a decisão do dono (tabela Decisões da spec) cobrem as
escolhas de negócio, e [research.md](research.md) resolve as técnicas.

## Constituição

| Princípio | Como a 015 cumpre |
|---|---|
| I. Testes primeiro | Commit `test(015): … (vermelho)` antes de cada `feat(015)`, em todas as camadas ([R19](research.md#r19-testes-primeiro-em-que-camada)). Testes nomeados por FR-001 a FR-018 e pelos casos-limite (QR × equipe na mesma mesa sem conta, caixa fecha a conta no meio, toque duplo, cancelar × começar preparo, outro garçom, aparelho compartilhado) |
| II. Domínio puro | `src/domain/menu/staff-menu.ts`, `src/domain/menu/search.ts`, `src/domain/ordering/kitchen-note.ts`, `cancelScope` em `order.ts`. Conferência do envio continua em `checkout.ts`. Relógio e ids por parâmetro |
| III. Livro imutável | Nenhuma movimentação nova. Pedido, linha e evento continuam só inserção; o gatilho `orders_status_only` passa a proteger `source`, `placed_by` e `menu_access_id`. O cancelamento do garçom é só em Recebido, quando o estoque ainda não baixou; nada para estornar |
| IV. Precisão | Preço e total em `numeric(12,2)` e `decimal.js`, pela mesma `checkOrder`; a observação não entra no preço nem no consumo (teste nomeado). Resumo por origem soma em `Decimal` e bate centavo por centavo (SC-005) |
| V. Rastreabilidade | Quem lançou em cada pedido (check no banco: equipe sempre tem, QR code nunca), no evento do envio e na abertura da conta; `audit_log` do envio, do cancelamento e das negativas. Cancelamento separado por papel: o garçom só o seu e só em Recebido; com estoque, só gerente e chef. RLS herdada; restaurante sempre da sessão |
| VI. Docs vivas | Neste PR: plano, pesquisa, modelo, contratos, quickstart e glossário. No PR da implementação: `docs/produto/pedidos/08-lancar-pedido.md` (novo), `00-visao-geral.md`, `03-cozinha-e-garcom.md` (origem, Só os meus, cancelar o próprio), `05-conta-da-mesa.md` (quem abriu), `02-cardapio-do-cliente.md` ("Chame um garçom" agora tem resposta), `docs/produto/estoque/09-controles-e-permissoes.md` (`order.place`, `order.cancel_own`), `docs/sistema/pedidos/01-modelo-de-dados.md`, `02-regras.md`, `04-plano-de-testes.md`, `docs/sistema/05-testes-de-tela.md` (coluna Garçom), `04-desempenho.md` (telas novas medidas) |
| VII. Simplicidade | Sem tabela nova, sem fila, sem cache, sem WebSocket: o mesmo `AutoRefresh` de 10 s. Carrinho no `localStorage`, não no banco. Um caso de uso novo que reaproveita a conferência e a gravação existentes |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1 Origem**: `orders.source` (`QR`, `STAFF`) + `placed_by` → `users`; `menu_access_id`
  opcional; check amarra os três; pedidos antigos viram `QR`.
- **R2 Sem duplicar**: único parcial `(restaurant_id, placed_by, client_request_id)` para a equipe.
- **R3 Caso de uso**: `placeStaffOrder` com a mesma `checkOrder`, sem acesso, sem limite de 10, sem
  a chave do QR code; `saveOrder` comum com o `submitOrder`.
- **R4 Observação**: `order_lines.kitchen_note` até 140, regra no domínio, só a equipe grava; entra
  na chave da linha do carrinho, não no preço nem no consumo.
- **R5 Permissões**: `order.place` e `order.cancel_own` para gerente, caixa e garçom.
- **R6 Cancelar o próprio**: `cancelScope` puro; corrida com Começar preparo resolvida pela trava
  otimista que já existe; motivo novo `ENTERED_BY_MISTAKE`.
- **R7 Cardápio da equipe**: `buildStaffMenu` com esgotados no fim da seção.
- **R8 a R9 Grade e Pedidos da mesa**: uma consulta agregada para a grade; pedidos da conta com os
  totais da 011.
- **R10 a R11 Carrinho**: `localStorage` por restaurante, usuário e mesa; apagado ao enviar,
  limpar e sair; `tabIdSeen` para o aviso de conta fechada.
- **R12 a R14 Mostrar a origem**: `OrderRecord` com origem e nome por junção, sem ida ao banco a
  mais; filtro e resumo por origem na consulta; `OPENED` com `user_id`.
- **R15 a R18 Telas**: menu e tela inicial do garçom, endereços, matriz de telas com a coluna
  Garçom, busca sem acento no aparelho.
- **R20 Pedir de novo**: escolhas gravadas viram linhas do carrinho com o preço de hoje; o que saiu
  fica de fora com o motivo; o envio passa pela conferência de sempre.
- **R21 Aviso de pedido parecido**: função pura sobre os Pedidos da mesa, janela de 5 min, não
  bloqueia.
- **R2 + R22 Envio sem resposta**: o servidor recusa o mesmo envio com outro conteúdo
  (`sameRequest`, `REQUEST_REUSED`); o aparelho trava o carrinho no estado `uncertain` até saber.
- **R23 a R25**: sessão vencida não apaga o carrinho; Ver conta usa a tela da 011; barras fixas e
  "− 2 +" na lista.

## Modelo de dados (migração `0015_staff_orders`)

Resumo; detalhe em [data-model.md](data-model.md).

```text
order_source          enum QR, STAFF                                         (novo)
orders                + source, placed_by → users; menu_access_id aceita nulo;
                      check orders_source_shape; único parcial orders_staff_client_request;
                      índice orders_placed_by; gatilho orders_status_only protege as três
order_lines           + kitchen_note (1 a 140, nulo)                         (só inserção)
order_cancel_reason   + ENTERED_BY_MISTAKE
order_status_events   (sem mudança) user_id preenchido no envio da equipe
tab_events            (sem mudança) OPENED com user_id no pedido da equipe
```

## Casos de uso

Contrato completo em [contracts/use-cases.md](contracts/use-cases.md).

- Novos: `listTablesForStaff`, `getStaffMenu`, `placeStaffOrder`, `listTableOrders` (com as
  escolhas para Pedir de novo); ações em `src/actions/staff-orders.ts`.
- Mudam: `submitOrder` (grava `QR` pelo `saveOrder`), `cancelOrder` (`order.cancel_own`),
  `listKitchenOrders`, `listReadyOrders` (Só os meus), `listOrders` (filtro e resumo), `getOrder`,
  `getTab`, `listTabs` (origem e observação).

## Estrutura

```text
src/domain/ordering/          order.ts (+ ORDER_SOURCES, ENTERED_BY_MISTAKE, cancelScope),
                              kitchen-note.ts, staff-request.ts, reorder.ts, similar-orders.ts
                              (novos), checkout.ts (kitchenNote na linha), *.test.ts
src/domain/menu/              staff-menu.ts (novo), search.ts (novo), *.test.ts
src/domain/access/            permissions.ts (+ order.place, order.cancel_own)
src/application/ordering/     staff-orders.ts (novo: listTablesForStaff, getStaffMenu,
                              placeStaffOrder, listTableOrders), staff-order-input.ts (novo),
                              save-order.ts (novo, comum), submit-order.ts, kitchen.ts,
                              orders.ts, ports.ts
src/application/billing/      tabs.ts (origem nos pedidos, quem abriu)
src/infra/db/                 schema/ordering.ts, migrations/0015_staff_orders.sql,
                              repositories/ordering-repository.ts (load com origem e nome,
                              findStaffByClientRequest, summaryBySource, staffTables)
src/actions/                  staff-orders.ts (novo), kitchen.ts (revalidar a mesa)
src/components/staff-ordering/ table-grid.tsx, table-menu.tsx (modos Fotos e Lista, busca),
                              product-row.tsx, kitchen-note-field.tsx, staff-cart.tsx,
                              confirm-order.tsx (aviso de pedido parecido), table-orders.tsx
                              (Pedir de novo, Ver conta), cart-bar.tsx, send-state.ts,
                              cart-storage.ts, *.test.tsx
src/components/ordering/      kitchen-board.tsx, ready-list.tsx (Só os meus), line-changes.tsx
                              (+ KitchenNote), cart-state.ts (kitchenNote na chave), dish-options.tsx
                              (campo da observação só quando pedido)
src/components/billing/       origem e observação na conta e na impressão
src/components/layout/        nav.tsx (+ Lançar pedido, homeFor), app-shell.tsx (Sair apaga os
                              carrinhos)
app/(app)/pedidos/lancar/     page.tsx (grade), [mesa]/page.tsx (cardápio, carrinho, Pedidos da mesa)
app/(app)/pedidos/            page.tsx (filtro e resumo), [id]/page.tsx, garcom/page.tsx
tests/integration/ordering/   staff-orders.test.ts (envio, origem, check do banco, sem chave e sem
                              limite, mesa inativa, toque duplo, conta compartilhada em paralelo,
                              conta fechada no meio, cancelar o próprio × começar preparo, outro
                              garçom, mesmo envio com outro conteúdo, auditoria, isolamento,
                              resumo por origem com cancelados)
tests/integration/performance/ indexes.test.ts (+ grade, Só os meus, filtro Lançado por)
tests/screens/                matrix.ts (coluna Garçom), fixtures.ts (asWaiter),
                              staff-ordering.spec.ts (novo)
tests/e2e/                    staff-ordering.spec.ts (roteiro do quickstart, rede cortada depois
                              do envio, contagem de toques), accessibility
                              (Lançar pedido, mesa)
```

## Ordem de entrega (vira `tasks.md`)

1. Domínio: permissões, `cancelScope` e o motivo novo, observação, cardápio da equipe, busca. Cada
   função nasce de um teste vermelho com os exemplos da spec.
2. Migração, schema e repositório (origem, observação, índices, gatilho), com testes de integração
   do check, da imutabilidade e do isolamento; `saveOrder` extraído com os testes da 009 a 011
   verdes.
3. US1 Lançar pedido (grade, cardápio, tela do prato, carrinho, envio) → US2 Quem lançou (cozinha,
   garçom, conta, consulta com filtro e resumo) → US3 Pedidos da mesa → US4 Cancelar o próprio →
   US5 Lista, busca, carrinho no aparelho, envio sem resposta e matriz de telas → US6 Pedir de
   novo e aviso de pedido parecido.
4. Docs (produto, sistema, permissões, testes de tela, desempenho) e e2e com axe.

## Riscos

- **Ordem das migrações 0014 e 0015**: a 014 (caixa) tem tarefas prontas e ainda não foi
  implementada. Quem for implementada primeiro fica com o número menor; a outra renomeia a migração
  e o snapshot do Drizzle no próprio PR. As duas não mexem nas mesmas tabelas (a 014 mexe em
  pagamentos e contas; a 015 em pedidos e linhas), então não há conflito de esquema.
- **`menu_access_id` deixa de ser obrigatório**: o código da 009 que lê o acesso do pedido passa a
  receber nulo. O tipo `NewOrder` vira união por origem e o `strict` do TypeScript aponta todo uso;
  `listForAccess` e `countForAccess` só veem pedidos do QR code por construção (filtram pelo acesso).
- **Garçom esquece de Sair em aparelho compartilhado**: o próximo garçom que entra tem os carrinhos
  do anterior apagados ao abrir a tela (chave por usuário), e nenhum envio sai em nome de outro,
  porque quem lança é sempre o usuário da sessão, nunca o do carrinho.
- **Cancelamento novo no garçom**: limitado a Recebido e ao que ele lançou, com auditoria e motivo;
  o gerente vê tudo na consulta filtrando por "Lançado por" e situação Cancelado.
- **Peso da tela no celular**: o modo Lista não carrega fotos; o modo Fotos usa as variantes da 013
  com carregamento tardio. `weight.spec.ts` ganha a página da mesa.

- **Aviso de pedido parecido com dados velhos**: a lista da mesa tem até 10 s; a tela atualiza
  antes de abrir o resumo. Se mesmo assim dois garçons confirmarem no mesmo segundo, os dois
  pedidos entram (o aviso não bloqueia) e o gerente vê na consulta; o cancelamento "Lançado
  errado" resolve enquanto a cozinha não começou.
- **Carrinho travado sem saída**: se o servidor ficar fora do ar, o garçom fica com o carrinho
  travado; **Ver Pedidos da mesa** e o reenvio são as saídas, e o gerente pode lançar pelo próprio
  aparelho. Não há "destravar à força", de propósito: é o que impede o pedido em dobro.

## Complexity Tracking

Nenhuma violação.
