# Pesquisa: 015 — Garçom lança o pedido da mesa

Decisões técnicas do [plano](plan.md). Cada uma diz o que foi escolhido, por quê e o que ficou de
fora. As escolhas de negócio estão na tabela **Decisões** da [spec](spec.md).

## R1 Origem e quem lançou no próprio pedido

**Decisão**: `orders` ganha `source` (enum `order_source`: `QR`, `STAFF`) e `placed_by` (uuid do
usuário, nulo no QR code). `menu_access_id` passa a aceitar nulo. Um check amarra os três:

```sql
check (
  (source = 'QR'    and menu_access_id is not null and placed_by is null) or
  (source = 'STAFF' and menu_access_id is null     and placed_by is not null)
)
```

A migração cria a coluna com `default 'QR'` (todo pedido antigo é do QR code, premissa da spec) e
tira o default em seguida, para o código ter de dizer a origem sempre. `placed_by` referencia
`users(id)`, não a filiação: quem sai da equipe perde a filiação, mas o usuário continua existindo
e o nome aparece nos pedidos antigos (US2-7). O nome é lido por junção na consulta, nunca copiado.

O gatilho `orders_status_only` já recusa `UPDATE` fora da situação; as colunas novas entram na
lista do que não muda (FR-006).

**Alternativas**: tabela à parte `order_placements` (mais uma junção em toda tela, sem ganho); um
"acesso ao cardápio" falso para a equipe (mantém o `NOT NULL`, mas mente sobre os 20 minutos, o
limite de 10 e a chave do QR code, e quebra o check `menu_accesses_twenty_minutes`); guardar só o
`created_by` da base (já existe, mas é nulo no QR code e não diz a origem; vira o mesmo valor de
`placed_by` no pedido da equipe, preenchido junto).

## R2 Envio sem duplicar para a equipe

**Decisão**: o único `orders_client_request (menu_access_id, client_request_id)` continua para o QR
code. O pedido da equipe ganha o único parcial
`orders_staff_client_request (restaurant_id, placed_by, client_request_id) where source = 'STAFF'`.
O carrinho gera o `clientRequestId` ao abrir a confirmação e só troca depois de um envio com
sucesso ou de **Limpar**; toque duplo e reenvio depois de queda de rede caem no único e devolvem o
mesmo pedido (FR-011), exatamente como `submitOrder` faz hoje (`findByClientRequest` antes,
`isUniqueViolation` depois).

**Alternativas**: único global em `client_request_id` (funcionaria com uuid aleatório, mas muda o
índice do QR code e o teste da 009); trava por mesa (serializa garçons diferentes sem motivo).

## R3 Um caso de uso novo, a conferência de sempre

**Decisão**: `placeStaffOrder(deps, ctx, input)` em `src/application/ordering/staff-orders.ts`.
Ele reaproveita `checkOrder` (domínio, 009/010) com `ordersSoFar = 0`, `repos.menu.catalog`,
`repos.tabs.openForOrder` e `repos.orders.insert`. O que muda em relação a `submitOrder`:

| Conferência | QR code (`submitOrder`) | Equipe (`placeStaffOrder`) |
|---|---|---|
| Quem | cookie do acesso | sessão (`RequestContext`), `authorize("order.place")` |
| Acesso de 20 min, conta fechada pelo caixa no acesso | sim | não |
| Limite de 10 pedidos | sim (`ordersSoFar`) | não (`0`) |
| Chave "Recebendo pedidos pelo QR code" | sim | não |
| Mesa ativa | sim | sim (`TABLE_INACTIVE` com o nome da mesa) |
| Linhas, quantidades, disponível, escolhas, preço | `checkOrder` | `checkOrder` (o mesmo) |
| Observação para a cozinha | recusada pelo `strictObject` | aceita, conferida no domínio (R4) |

A parte comum (número do dia, abrir ou achar a conta, inserir) fica num ajudante
`saveOrder(repos, deps, …)` usado pelos dois casos de uso, para a regra "uma conta aberta por mesa"
ter um lugar só. `submitOrder` passa a chamá-lo sem mudar de comportamento (os testes da 009, 010 e
011 continuam como estão e garantem isso).

**Alternativas**: um `submitOrder` com bandeira "é da equipe" (mistura cookie e sessão no mesmo
caminho, e um erro de bandeira desliga o freio do cliente); chamar `submitOrder` com um acesso
falso (ver R1).

## R4 Observação para a cozinha

**Decisão**: `order_lines.kitchen_note text null`, check `char_length(kitchen_note) between 1 and
140`. A regra mora no domínio, `checkKitchenNote(text)` em `src/domain/ordering/kitchen-note.ts`:
tira espaços das pontas, junta espaços repetidos, troca quebra de linha por espaço, vazio vira
`null`, mais de 140 é `NOTE_TOO_LONG` com a linha. Só `placeStaffOrder` aceita o campo: a entrada
do cliente (`parseOrderInput`) continua `strictObject` e o teste da 010 "observação livre é
recusada" continua verde (FR-016).

Na chave de linha do carrinho (`choiceKey`), a observação entra: o mesmo X-Burger "mal passado" e
"ao ponto" são duas linhas. Não muda preço (`priceLine` não a lê) nem consumo (`consumption.ts` não
a lê) — teste nomeado para cada uma.

O banco não tem como checar "só em pedido da equipe" sem gatilho entre tabelas; a garantia é o
caminho único de escrita (só `placeStaffOrder` preenche) mais um teste de integração que tenta
gravar observação num pedido do QR code pelo repositório e espera recusa do caso de uso. Um gatilho
para isso ficaria fora da regra VII sem um problema medido.

**Alternativas**: tabela `order_line_notes` (mais uma junção em cozinha, conta e consulta); nota
por pedido em vez de por linha (a decisão do dono é por linha).

## R5 Permissões

**Decisão**: duas ações novas em `src/domain/access/permissions.ts`:

| Ação | Gerente | Caixa | Garçom | Chef | Estoque |
|---|---|---|---|---|---|
| `order.place` (lançar pedido para a mesa) | ✓ | ✓ | ✓ | | |
| `order.cancel_own` (cancelar o próprio pedido ainda Recebido) | ✓ | ✓ | ✓ | | |

O garçom também ganha `order.read` (já tem), e a tela **Pedidos da mesa** usa `order.place`, não
`tab.read`, para quem lança ver o que a mesa já pediu. `order.cancel` (cancelar qualquer pedido,
com estoque) continua só com gerente e chef.

O caixa ganha `order.cancel_own` porque também lança (premissa "balcão"); é o mesmo risco do
garçom e a mesma regra (só o seu, só Recebido).

**Alternativas**: dar `order.cancel` ao garçom com uma checagem extra (a matriz deixaria de dizer a
verdade: `can(WAITER, "order.cancel")` seria `true` sem ser).

## R6 Cancelamento pelo próprio garçom

**Decisão**: `cancelOrder` decide a regra assim, numa função pura
`cancelScope(roles, userId, order)` em `src/domain/ordering/order.ts`:

1. Com `order.cancel`: como hoje (009 e 011).
2. Senão, com `order.cancel_own`: só se `order.source = STAFF`, `order.placedBy = userId` e
   `order.status = RECEIVED`. Pedido de outra pessoa ou do QR code → `FORBIDDEN` com auditoria
   `DENIED` (caso-limite da spec). Pedido já em preparo → `KITCHEN_STARTED` ("A cozinha já começou.
   Peça ao chef ou ao gerente para cancelar.").
3. Sem nenhuma das duas: `FORBIDDEN` com auditoria, como hoje.

A corrida com **Começar preparo** (US4-4) já está resolvida pela trava otimista: os dois caminhos
fazem `changeStatus(…, version)` e só um `UPDATE … where version = $v` acerta. Quem perde recebe
`STALE_RECORD`; para o garçom, o caso de uso relê o pedido e, se ele já está em preparo, devolve
`KITCHEN_STARTED` em vez de "alguém mudou". Como o cancelamento em Recebido nunca estorna estoque
(nada baixou), o estoque nunca baixa de pedido cancelado. Teste de integração com as duas chamadas
em paralelo, repetido 20 vezes.

O motivo novo `ENTERED_BY_MISTAKE` ("Lançado errado") entra no enum `order_cancel_reason` e em
`CANCEL_REASONS`. Na tela da cozinha e do gerente ele aparece na lista como os outros.

**Alternativas**: trava pessimista no pedido (`for update`) só para isso (a otimista já cobre).

## R7 Cardápio da equipe

**Decisão**: função pura `buildStaffMenu(sections, products, today)` em
`src/domain/menu/staff-menu.ts`, irmã de `buildCustomerMenu`:

- mesmas seções, ordem e "Outros" da 013;
- produto **Esgotado hoje** fica, com `soldOut: true`, **no fim da sua seção** (ordem da posição
  entre os esgotados);
- inativo, sem preço e não vendido (`kind ≠ DISH`) não aparecem.

O caso de uso `getStaffMenu(deps, ctx, tableId)` monta o cardápio com `repos.menu.catalog` (os
adicionais e retiradas disponíveis, como `customerMenu`) e devolve também a mesa, a conta aberta
(id, total até agora) e se o QR code está desligado. A pré-visualização e o cardápio do cliente não
mudam.

Fotos: as mesmas variantes da 013, com o `sizes` do cartão; no modo **Lista** nenhuma foto é
pedida (o componente não renderiza `<img>`), o que deixa a lista leve no 4G do salão.

**Alternativas**: reaproveitar `buildCustomerMenu` com um parâmetro "incluir esgotados" (a função
do cliente ganharia um caminho que o cliente nunca pode ver; separada, cada uma tem os seus testes).

## R8 Grade de mesas

**Decisão**: `listTablesForStaff(deps, ctx)` devolve, numa consulta, as mesas ativas na ordem do
nome com a conta aberta (id, `openedAt`, total dos pedidos não cancelados com a taxa) e quantos
pedidos estão **Prontos**; mais a chave do QR code. Uma consulta com `left join` em `table_tabs`
aberta e agregação em `orders` (índices `orders_tab` e `orders_open` já existem). O SQL só soma os
pedidos não cancelados (subtotal); a taxa sai da função de domínio da 011 (`serviceCharge`), com a
taxa e o "sem taxa" da conta, para o número da grade ser o mesmo do Caixa.

"Carrinho: 3 itens" vem do aparelho (R10), não do servidor.

Atualiza a cada 10 segundos com o `AutoRefresh` da 009 (`router.refresh()`), como a cozinha.

**Alternativas**: reaproveitar `listOpenTabs` da 011 (não traz as mesas livres e pede `tab.read`).

## R9 Pedidos da mesa

**Decisão**: `listTableOrders(deps, ctx, tableId)` com `order.place`: os pedidos da conta aberta
(`repos.orders.listForTab`, mais novo primeiro), cada um com origem, quem lançou, situação, linhas
com mudanças e observação, total; mais os totais da conta (`currentTotals` da 011, com a taxa).
Sem conta aberta: lista vazia e `tab: null`. O botão **Entregue** chama o `markDelivered` que já
existe (`order.deliver`); **Cancelar** aparece só quando `cancelScope` deixaria (a tela recebe
`canCancel` por pedido, calculado no servidor).

## R10 Carrinho no aparelho

**Decisão**: `localStorage`, uma chave por restaurante, usuário e mesa:
`garcom:v1:<restaurantId>:<userId>:<tableId>` → `{ lines, clientRequestId, tabIdSeen, savedAt }`.

- Trocar de mesa e voltar não perde nada; a grade lê as chaves do usuário para mostrar
  "Carrinho: N itens".
- Ao abrir **Lançar pedido**, apaga as chaves `garcom:v1:*` de **outro** usuário ou de outro
  restaurante (aparelho compartilhado em que alguém saiu sem tocar **Sair**).
- **Sair** apaga todas as chaves `garcom:v1:*` antes de chamar a ação de sair (FR-012).
- Carrinho com mais de 12 horas é descartado na leitura (sobra do turno anterior).
- `try/catch` em toda leitura e escrita: navegador sem armazenamento (aba anônima do Safari) segue
  com o carrinho só na memória, sem erro na tela.

As regras do carrinho (`addToCart`, `setQuantity`, `applyPriceChanges`, `removeUnavailable`) são as
de `src/components/ordering/cart-state.ts`, com a observação na linha (R4). O armazenamento fica em
`src/components/staff-ordering/cart-storage.ts`, testado com um `Storage` falso.

**Alternativas**: carrinho no banco (a spec diz que não vai para o banco; seria mais uma tabela
editável e mais escrita a cada toque); `sessionStorage` (perde o carrinho ao fechar a aba, que é
justamente o que acontece quando o garçom guarda o celular no bolso).

## R11 "A conta anterior desta mesa foi fechada"

**Decisão**: o carrinho guarda o `tabId` da conta aberta quando o garçom abriu a mesa
(`tabIdSeen`, ou `null` se a mesa estava livre). O envio manda esse valor; se `tabIdSeen` não é
nulo e o pedido entrou em outra conta, a resposta traz `previousTabClosed: true` e a tela mostra o
aviso da spec. O pedido é aceito de qualquer jeito (caso-limite da spec).

## R12 Mostrar a origem nas telas

**Decisão**: `OrderRecord` (porta `OrderRepo`) ganha `source`, `placedById`, `placedByName` e, em
cada linha, `kitchenNote`. A carga (`load` em `ordering-repository.ts`) faz `left join users` na
mesma consulta dos pedidos: nenhuma ida ao banco a mais nas telas da cozinha, garçom e conta (regra
da 012, `04-desempenho.md`). Componentes:

| Tela | Mudança |
|---|---|
| Cozinha (`kitchen-board.tsx`) | "João" ou "QR code" embaixo da mesa, menor; observação em destaque na linha |
| Garçom (`ready-list.tsx`) | quem lançou; filtro **Só os meus** (estado na URL `?meus=1`) |
| Conta da mesa e Contas fechadas (`billing/*`) | origem por pedido; observação |
| Consulta Pedidos (`/pedidos`) | filtro **Lançado por**, coluna, resumo por origem |
| Detalhe do pedido | "Lançado por João às 20:14" no primeiro registro do histórico |

A observação usa um componente único `KitchenNote` (fundo de destaque, ícone, texto inteiro sem
corte), testado nas três telas.

## R13 Consulta: filtro e resumo por origem

**Decisão**: `OrderFilter` ganha `placedBy?: "QR" | <userId>`, aplicado no SQL. O resumo vem de uma
consulta agregada nova `repos.orders.summaryBySource(filter)`:
`group by source, placed_by` com `count(*)` e `sum(total)` dos não cancelados no período, mais o
nome. As opções do filtro "Lançado por" são `QR code` + quem já lançou no período (mesma consulta).

Invariante testada com os números da spec (SC-005): Σ total por origem = Σ total dos pedidos não
cancelados do período, em `Decimal`, centavo por centavo.

**Alternativas**: somar na aplicação a partir da lista (a lista pode ser filtrada por situação e
mesa; o resumo é do período inteiro).

## R14 Abertura da conta com quem abriu

**Decisão**: o evento `OPENED` de `tab_events` já aceita `user_id` (check `tab_events_user` só o
exige nos outros tipos). `saveOrder` grava `userId = ctx.userId` quando o pedido é da equipe e
`details.orderId` como hoje. O histórico da conta escreve "Conta aberta por João (pedido 5)" ou
"Conta aberta pelo QR code (pedido 5)".

## R15 Entrada na tela certa

**Decisão**: a entrada **Lançar pedido** (`/pedidos/lancar`, ícone `NotebookPen`) fica no menu
**Operação** entre Cozinha e Garçom. `homeFor(roles)` hoje é "a primeira entrada do menu"; ganha
uma exceção: quem tem `tab.pay` (caixa, gerente) não cai em **Lançar pedido**, vai para a próxima.
Resultado: garçom → Lançar pedido; caixa → Caixa (como hoje); chef → Cozinha (como hoje); gerente →
Itens (como hoje). Teste por papel em `nav.test.tsx`.

## R16 Endereços

| Endereço | Tela |
|---|---|
| `/pedidos/lancar` | Grade de mesas |
| `/pedidos/lancar/[mesa]` | Cardápio da mesa, carrinho e **Pedidos da mesa** (abas na mesma página; `?aba=pedidos`) |

O `[mesa]` é o id da mesa. A página carrega o cardápio e os pedidos da mesa no servidor (duas
consultas agregadas mais o cardápio da 013, medido com o roteiro de `04-desempenho.md`); a aba
**Pedidos da mesa** atualiza a cada 10 s com `AutoRefresh`. O carrinho é estado do cliente,
preservado pelo `router.refresh()`.

## R17 Telas em todos os tamanhos

**Decisão**: a tela do garçom entra na matriz de `tests/screens/matrix.ts` com a coluna **Equipe**
virando três: `Cliente`, `Equipe (Cardápio)` e `Garçom`. O garçom usa todos os 9 tamanhos (celular
de qualquer tamanho e tablet), como o cliente. Spec nova `tests/screens/staff-ordering.spec.ts`:
grade, cardápio nos modos Fotos e Lista, tela do prato com a observação, carrinho e Pedidos da mesa,
com as asserções existentes (`expectNoSideScroll`, `expectNoClippedText`, `expectTapTargets`,
`expectReadableAt200`, `expectSurvivesRotation`). A fixture `asWaiter` (garçom João logado) entra
em `tests/screens/fixtures.ts`, ao lado de `asStaff` e `asCustomer`.

## R18 Busca sem acento

**Decisão**: a busca roda no aparelho sobre o cardápio já carregado, com `normalizeDescription`
(`src/domain/inventory/description.ts`, já sem acento e minúsculo) sobre o nome. Sem ida ao banco a
cada letra. Teste: "pure" acha "Purê", "XBURG" acha "X-Burger" quando o hífen é ignorado (a
normalização da busca tira também pontuação: `normalizeSearch` em `src/domain/menu/search.ts`).

## R19 Testes primeiro, em que camada

| Regra | Camada do teste vermelho |
|---|---|
| Esgotado no fim da seção, inativo some (FR-003) | unidade, `staff-menu.test.ts` |
| Observação: limite, espaços, não muda preço nem consumo (FR-018) | unidade, `kitchen-note.test.ts`, `customization.test.ts`, `consumption.test.ts` |
| Quem pode cancelar o quê (FR-010) | unidade, `order.test.ts` (`cancelScope`) |
| Permissões (FR-001) | unidade, `permissions.test.ts` |
| Origem sempre gravada, check do banco, imutável (FR-006, SC-002) | integração, `tests/integration/ordering/staff-orders.test.ts` |
| Sem chave, sem limite, sem acesso; mesa inativa (FR-004) | integração |
| Uma conta só com QR code e equipe ao mesmo tempo (FR-005, SC-003) | integração, envios em paralelo |
| Toque duplo (FR-011) | integração |
| Cancelar × Começar preparo (US4-4) | integração, paralelo |
| Resumo por origem soma o total (SC-005) | integração |
| Isolamento (FR-015) | integração, restaurante B não vê mesas, pedidos nem filtro de A |
| Auditoria do envio e da negativa (FR-014) | integração |
| Carrinho por mesa, apagar ao sair, outro usuário (FR-012) | componente, `cart-storage.test.ts` |
| Telas (FR-013, SC-006) | tela, `staff-ordering.spec.ts` |
| Roteiro do quickstart (US1 a US5) | ponta a ponta, `tests/e2e/staff-ordering.spec.ts` |

Commit `test(015): … (vermelho)` antes de cada `feat(015)`, como na 013 e na 014.
