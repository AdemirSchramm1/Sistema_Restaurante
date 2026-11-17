# Pesquisa: 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

Decisões técnicas do [plano](plan.md). Cada uma diz o que foi escolhido, por quê e o que ficou de
fora. As escolhas de negócio estão na tabela **Decisões** da [spec](spec.md).

## R1 O tablet é um acesso ao cardápio que não vence

**Decisão**: o tablet ligado é uma linha de `menu_accesses` (009) com `kind = 'TABLET'`. O acesso
do QR code passa a ter `kind = 'QR'`. Para o tablet, `expires_at` é nulo; o check dos 20 minutos
vira um check por tipo:

```sql
check (
  (kind = 'QR'     and expires_at = opened_at + interval '20 minutes') or
  (kind = 'TABLET' and expires_at is null)
)
```

O cookie do tablet guarda um token aleatório, e o banco só o hash em `token_hash`, como o QR code
faz hoje. Tudo o que já existe para o acesso vale de graça: busca pelo cookie, RLS, o único
`orders_client_request (menu_access_id, client_request_id)` contra toque duplo, o envio de
`submitOrder` com a mesma conferência (`checkOrder`), a conta da mesa da 011.

O que muda por tipo fica em funções puras de `src/domain/ordering/menu-access.ts`:
`isAccessOpen` e `canSubmitWith` (o tablet está aberto enquanto `ended_at` é nulo) e
`ordersLimit(kind)` (10 no QR code, sem limite no tablet, FR-005).

**Alternativas**: tabela `table_tablets` com token próprio e pedido sem `menu_access_id` (duplica
a busca pelo cookie, o "sem pedido em dobro" e a gravação, e o pedido teria mais um formato);
`expires_at = 'infinity'` no Postgres (o `Date` do JavaScript não lê `infinity` e o driver devolve
data inválida); acesso de 20 minutos renovado em silêncio pelo tablet (gravação a cada 20 minutos
por mesa e um tablet que dorme 30 minutos perde a mesa).

## R2 Link do tablet e o aparelho ligado

**Decisão**: `dining_tables` ganha `tablet_token` (texto, único, nulo até o gerente criar) e
`tablet_token_rotated_at`. O token é guardado em texto, como o `qr_token`, porque o gerente precisa
ver e copiar o link a qualquer hora; ele só aparece na tela **Tablet da mesa** e nunca vai para a
auditoria (FR-010). Endereço: `/t/{tablet_token}`, ao lado do `/m/{qr_token}` da 009.

"Ligado a um aparelho" é a existência de um acesso `TABLET` aberto da mesa. Um único parcial
garante que só um aparelho liga, mesmo com dois abrindo o link ao mesmo tempo (caso-limite):

```sql
create unique index menu_accesses_one_tablet on menu_accesses (table_id)
  where kind = 'TABLET' and ended_at is null;
```

`GET /t/{token}`:

1. Token desconhecido: "Link inválido. Chame um garçom." (404, sem nada do restaurante).
2. O aparelho já tem o cookie do tablet desta mesa e o acesso está aberto: vai para `/cardapio`.
3. A mesa não tem acesso `TABLET` aberto: insere um (`ip`, `user_agent` como no QR code), grava o
   cookie e vai para `/cardapio`. Perdeu a corrida no único: mensagem de link em uso.
4. A mesa já tem outro aparelho ligado: "Este link já está ligado em outro tablet. Peça ao gerente
   para liberar." (200, sem cardápio).

Mesa inativa e chave "Recebendo pedidos" desligada **não** impedem ligar: o tablet liga e mostra a
mensagem da mesa (US4-5); assim o gerente pode instalar os tablets antes de abrir a casa.

**Liberar**: encerra o acesso (`end_reason = 'RELEASED'`). **Trocar link**: novo `tablet_token`,
`tablet_token_rotated_at = now()` e encerra o acesso (`end_reason = 'LINK_ROTATED'`), na mesma
transação. O enum `menu_access_end_reason` ganha os dois valores.

**Alternativas**: token em hash (o gerente não conseguiria ver o link de novo; teria de trocar
sempre que perdesse o papel); ligar com o login do gerente no tablet (fora pelo pedido do dono, ver
Premissas da spec); identificar o aparelho por IP ou `user_agent` (muda com a rede e é igual em
tablets do mesmo modelo).

## R3 O cookie do tablet

**Decisão**: cookie próprio `menu_tablet` (não o `menu_access` do QR code), `HttpOnly`,
`SameSite=Lax`, `Path=/`, `Secure` só por HTTPS (lição da 013 com o WebKit), `Max-Age` de 400 dias
(o máximo que Chrome e Safari aceitam). O caminho é `/` porque o tablet usa `/cardapio` e
`/api/cardapio/tablet`.

Cookie próprio porque a leitura de um QR code no navegador do tablet encerra o acesso do cookie
anterior (`endPrevious`, motivo `RESCAN`): com um cookie só, alguém lendo um QR code no tablet
desligaria o tablet. Quando os dois existem, `/cardapio` usa o do tablet.

Safari limita a 7 dias só o cookie criado por JavaScript; o cookie `HttpOnly` vindo do servidor do
próprio endereço não entra nesse limite. Antes dos 400 dias, cada abertura do cardápio regrava o
cookie (mesmo token), então um tablet em uso nunca chega ao fim.

Limpeza de dados do navegador ou modo anônimo perdem o cookie: o tablet vira "link em uso" e o
gerente usa **Liberar** (caso-limite da spec). No iPad, o atalho "Adicionar à Tela de Início" tem
cookies separados do Safari; a ajuda da tela **Tablet da mesa** diz para abrir o link no próprio
navegador e usar Acesso Guiado.

## R4 O que o tablet mostra e quando ele se limpa

**Decisão**: uma máquina de estados pura em `src/domain/ordering/tablet-screen.ts`:

| Estado | Entra quando | Sai para |
|---|---|---|
| `WELCOME` | Abriu, recarregou, voltou do parado, a conta mudou | `MENU` ao tocar **Ver o cardápio** |
| `MENU` | Tocou em **Ver o cardápio**, tocou **Continuar**, fim do `SENT` | `STILL_THERE` com 180 s sem toque e carrinho com algo; `WELCOME` com 180 s sem toque e carrinho vazio |
| `STILL_THERE` | 180 s sem toque com carrinho | `MENU` em **Continuar** ou qualquer toque; `WELCOME` (carrinho limpo) com 30 s sem resposta |
| `SENT` | Pedido enviado | `MENU` com o carrinho vazio depois de 10 s ou ao tocar |

Funções: `tabletScreen(state, event)` com eventos `touch`, `tick(now)`, `sent(now)`, `open`,
`tabChanged`, e as constantes `IDLE_SECONDS = 180`, `STILL_THERE_SECONDS = 30`,
`SENT_SECONDS = 10` (FR-006). O relógio entra por parâmetro; os testes dizem os segundos da spec.

O componente cliente só liga a máquina aos eventos do navegador (`pointerdown`, `keydown`, um
`setInterval` de 1 s). O carrinho do tablet fica na memória da página, não no `localStorage`:
recarregar volta às boas-vindas vazio (US5-7) e nada do cliente anterior sobrevive.

**Alternativas**: tempos por restaurante (fora pela premissa da spec); guardar o carrinho no
aparelho (contradiz US5-7 e deixa o pedido do cliente anterior no tablet).

## R5 Conta fechada, mesa renomeada e o tablet "visto há"

**Decisão**: o tablet não usa o `AutoRefresh` da página inteira. Ele chama
`GET /api/cardapio/tablet` (sem cache), que responde em uma transação curta:

```json
{ "state": "OK", "tableName": "Mesa 12", "open": true, "tabId": "…", "stamp": "…" }
```

`state` diz `OK`, `TABLE_INACTIVE`, `ORDERING_PAUSED`, `RELEASED` ou `LINK_ROTATED`. O `stamp` junta
`restaurants.version` (logo, capa, nome, chave), `dining_tables.version` (nome, ativa), a conta
aberta e o último `status_changed_at` dos pedidos dela. Quando o `stamp` muda, o cliente chama
`router.refresh()`; quando `tabId` muda (a conta fechou ou abriu outra), a máquina recebe
`tabChanged` e volta às boas-vindas sem pedidos (FR-006, FR-007, SC-005).

Frequência: a cada 10 s fora das boas-vindas e a cada 60 s nas boas-vindas, onde não há nada do
cliente para limpar. A página inteira ainda se atualiza a cada 5 minutos no `MENU` sem carrinho,
para pegar esgotados e preços; o envio confere tudo de novo de qualquer forma (009).

A mesma chamada é o **sinal de vida**: grava `last_seen_at` no acesso só quando o valor gravado tem
mais de 60 s (`update … where last_seen_at < now() - interval '60 seconds'`), então 60 tablets
geram no máximo 1 gravação por segundo. A tela Mesas mostra "visto há 2 min" e, acima de
10 minutos, "Sem sinal há 25 min" (US4-8), com a função pura `tabletSignal(lastSeenAt, now)`.

**Alternativas**: `AutoRefresh` de 10 s na página toda (60 tablets × 6 consultas a cada 10 s, só
para saber se algo mudou); WebSocket ou SSE (a Vercel não mantém conexão longa em função comum; fora
pela simplicidade da constituição); gravar `last_seen_at` em toda chamada.

## R6 Fechar a conta não desliga o tablet

**Decisão**: `endOpenForTable` (011), chamado quando o caixa fecha a conta, passa a encerrar só os
acessos `QR` (`and kind = 'QR'`). O tablet continua ligado; a conta fechada sai da tela pelo R5.
"Pedidos enviados" do tablet lê os pedidos da **conta aberta** da mesa (`orders.tab_id`), de
qualquer origem (FR-007), em vez dos pedidos do acesso: o cliente da mesa vê o que o garçom e o QR
code mandaram, e nunca o que era da conta anterior.

Pedido do tablet enviado no instante em que o caixa fecha a conta: o `submitOrder` já trava a mesa
e abre conta nova se a anterior fechou (`openForOrder`, 011). Para o tablet, o `TABLE_TAB_CLOSED`
da 011 não se aplica (o acesso não foi encerrado), e o pedido cai na conta nova (caso-limite da
spec). Teste de integração com as duas transações em corrida.

## R7 Origem do pedido: tablet

**Decisão**: o enum `order_source` da 015 (`QR`, `STAFF`) ganha `TABLET`. O check
`orders_source_shape` da 015 passa a aceitar `TABLET` com `menu_access_id` preenchido e
`placed_by` nulo. `submitOrder` grava `source` a partir do `kind` do acesso. Cozinha, Garçom, conta
e consulta mostram "Mesa 12 · tablet" com `ORDER_SOURCE_LABELS.TABLET = "tablet"` (FR-008). O
filtro "Origem" da consulta (015) ganha "Tablet".

Se a 016 for implementada antes da 015, a `0016` cria o enum com `QR` e `TABLET` e a coluna
`source`, e a 015 só acrescenta `STAFF`, `placed_by` e o check. A ordem é conferida no PR da
implementação (ver Riscos do plano).

**Alternativas**: ler a origem pelo `kind` do acesso em cada consulta (uma junção a mais em toda
tela da cozinha e da consulta, e a 015 já pôs a origem no pedido).

## R8 Logo e capa: onde e em que formato

**Decisão**: `restaurants` ganha `logo_base`, `logo_widths`, `cover_base`, `cover_widths`, no mesmo
formato da foto do produto (013): a base do endereço e as larguras gravadas, com um check que
amarra os pares. Os arquivos vão para a mesma loja (`deps.photos.storage`, Vercel Blob em
produção), com identificador aleatório.

O processador da 013 recorta 4:3. Ele passa a receber o **formato**, uma regra pura em
`src/domain/menu/photo.ts`:

| Formato | Recorte | Mínimo | Larguras gravadas |
|---|---|---|---|
| `PRODUCT` (013) | 4:3 no centro | 600 px no lado menor | 300, 600, 900, 1200 |
| `LOGO` | 1:1 no centro | 200 px no lado menor | 96, 192, 384 |
| `COVER` | 3:1 no centro | 1200 px de largura | 600, 1200, 1920 |

A capa é 3:1 porque o topo tem 390 × 120 no celular (3,25:1) e 1280 × 160 no computador (8:1): com
`object-fit: cover` a mesma imagem serve aos dois sem ficar estreita demais. Nas boas-vindas do
tablet, em tela cheia deitada (4:3), a capa ocupa a metade de cima e o logo fica embaixo dela, para
não ampliar a imagem além da largura gravada.

O navegador reduz a foto antes de enviar (013, `reduce-photo.ts`), com o mesmo limite de 4 MB. O
recorte mostrado antes de salvar (US1-2) é a própria pré-visualização com `object-fit: cover` na
proporção do formato.

**Alternativas**: tabela `restaurant_appearance` (uma linha por restaurante, sem ganho sobre as
colunas); logo em SVG (o processador não trata vetor e SVG enviado por usuário é risco de script).

## R9 Camada escura da capa e contraste

**Decisão**: o topo põe sobre a capa um degradê preto de 45% em cima a 70% embaixo, e o nome e
"Mesa 12" em branco na parte de baixo. A pior imagem possível é branca: branco sobre preto 70% em
fundo branco dá cor #4D4D4D e contraste 8,4:1; o ponto de 45% fica atrás só do espaço vazio de
cima. O teste usa `src/lib/contrast.ts` (013) com o fundo branco e a opacidade da linha do texto, e
falha abaixo de 4,5:1 (US1-3). A mesma camada nos modos claro e escuro: a foto é igual nos dois.

Sem capa, o topo usa a cor principal da 012 (`--primary`) com o texto da cor de contraste já
conferida.

## R10 Layout por largura

**Decisão**: CSS com media queries na largura da janela (as mesmas que o `iframe` da
pré-visualização respeita), em `src/components/ordering/menu-layout.css` ou nas classes do
Tailwind 4 com pontos próprios declarados no `@theme`:

| Faixa | Nome no código | Cartões | Carrinho |
|---|---|---|---|
| até 599 px | `list` | Linha: foto 112 px 4:3 à esquerda | Barra no pé |
| 600 a 1023 px | `grid3` | 3 colunas, foto em cima | Barra no pé |
| 1024 a 1279 px | `grid3side` | 3 colunas | Coluna de 320 px à direita |
| 1280 px ou mais | `grid4side` | 4 colunas | Coluna de 320 px à direita |

A função pura `menuLayout(width)` devolve o nome; os testes de componente e a matriz de telas usam
ela, e o CSS usa os mesmos números (um teste lê os pontos do `@theme` e compara com a função).

A coluna do carrinho é `position: sticky` com a altura da janela menos a barra de seções; a lista de
linhas rola dentro dela e o pé (total e **Enviar pedido**) fica fixo (SC-002). A barra do pé no
celular é `position: fixed` e a página tem `padding-bottom` da altura da barra mais
`env(safe-area-inset-bottom)` (US3-2).

Abas de seção: a partir de 600 px, `flex-wrap`. Um `ResizeObserver` mede a altura; passando de 2
linhas, a barra vira uma linha só que rola (US2-5), sem cortar nome. No celular, uma linha que rola
(como hoje).

**Alternativas**: `@container` queries (melhor para componentes soltos, mas a pré-visualização e a
matriz de telas da 013 já trabalham com a largura da janela); grade de colunas automáticas por
largura mínima (o número de colunas ficaria variando entre aparelhos parecidos e a spec dá números
fixos).

## R11 "+" direto no cartão

**Decisão**: `quickAdd(product)` puro: produto sem adicionais e sem retiradas vai para o carrinho
com quantidade 1 (`addToCart` da 009); com algum dos dois, abre a tela do prato (US2-6). O aviso
"X-Burger no carrinho. Total R$ 43,00" vai para uma região `aria-live="polite"` única da página
(US3-3), e a linha que mudou recebe uma classe de destaque por 600 ms (sem animação com
`prefers-reduced-motion`).

## R12 Tela sempre acesa, tela cheia e sem internet

**Decisão**:

- **Tela acesa**: `navigator.wakeLock.request("screen")` ao entrar no cardápio do tablet e de novo
  em `visibilitychange` (o navegador solta a trava quando a aba some). Chrome no Android e Safari
  16.4 ou mais novo têm a API; sem ela, nada acontece e a ajuda diz para pôr "Bloqueio automático:
  Nunca" no aparelho (US5-5).
- **Tela cheia**: botão **Tela cheia** com `document.documentElement.requestFullscreen()`, só
  quando `document.fullscreenEnabled` (iPad a partir do iPadOS 16.4; iPhone não tem).
- **Sem internet**: `navigator.onLine`, os eventos `online` e `offline`, e a falha da chamada do R5.
  Duas falhas seguidas mostram "Sem conexão com o restaurante. Chame um garçom." por cima do
  cardápio, sem limpar o carrinho; o primeiro sucesso tira o aviso (US5-6). O envio sem conexão não
  fica guardado: o botão mostra o erro do envio da 009 e o carrinho continua.

**Alternativas**: service worker com fila de envio (contradiz a spec, que não guarda pedido para
depois, e complica o "sem pedido em dobro"); app de quiosque ou PWA (fora pela premissa "só o
link").

## R13 Permissões

**Decisão** (FR-009):

- **Tablet da mesa** (criar link, liberar, trocar link, ver a situação): `table.manage`, que já é só
  do gerente (009). Sem permissão nova: mexer no tablet é mexer na mesa.
- **Logo e capa**: permissão nova `menu.appearance`, só do gerente. A tela Cardápio é do gerente e
  do chef (`menu.write`, 013), mas a aparência do restaurante é decisão do gerente (US1).

## R14 Auditoria

**Decisão** (FR-010): `audit_log` com

| Ação | `entity` | `changes` |
|---|---|---|
| Criar link | `dining_table` | `{ tablet: "link_created" }` |
| Tablet ligou | `dining_table` | `{ tablet: "bound" }`, `user_id` nulo, `origin` com IP e navegador |
| Liberar | `dining_table` | `{ tablet: "released" }` |
| Trocar link | `dining_table` | `{ tablet: "link_rotated" }` |
| Logo / capa | `restaurant` | `{ logo: [base anterior, base nova] }`, `{ cover: […] }` |

O token nunca entra em `changes` (teste nomeado varre o `audit_log` depois do roteiro).

## R15 Testes de tela

**Decisão** (FR-012): `tests/screens/matrix.ts` troca `columns: 1 | 2 | 3` por
`layout: "list" | "grid3" | "grid3side" | "grid4side"`, calculado por `menuLayout(width)`. Nos 9
tamanhos: `celular-*` → `list`; `celular-deitado` (844), `tablet-em-pe` (768),
`tablet-grande-em-pe` (820) → `grid3`; `tablet-deitado` (1024) → `grid3side`; `computador` (1280)
→ `grid4side`.

Telas novas na matriz: cardápio com topo de capa e logo, carrinho ao lado com 3 linhas, barra do
carrinho, boas-vindas do tablet, "Ainda está aí?", tela **Tablet da mesa** (equipe) e quadro
**Aparência** (equipe). Regras da 013 em todas (sem rolagem para o lado, nada cortado, toque de
44 px, letra 200%, girar sem perder o carrinho). Fotos de teste fixas em `tests/screens/photos/`
(um logo e uma capa gerados uma vez, sem dado aleatório; lição do PR #22).

As imagens de referência do cardápio do cliente da 013 são refeitas a partir do build de produção;
o PR da implementação lista quais mudaram e por quê.

SC-001 vira teste de tela: no `celular-iphone` com 12 pratos, conta os cartões inteiramente dentro
da janela abaixo da barra de seções e acima da barra do carrinho (≥ 4).

## R16 Testes primeiro em que camada

**Decisão**: como na 013 e na 015. Domínio (`tablet-screen`, `menu-access` por tipo, `photo` por
formato, `menuLayout`, `quickAdd`, `tabletSignal`, contraste da camada), integração com Postgres
(um tablet por mesa na corrida, liberar, trocar link, fechar conta sem desligar o tablet, pedido do
tablet × fechamento da conta, origem `TABLET`, token fora da auditoria, RLS), componentes (cartão em
linha, carrinho ao lado, barra, boas-vindas, "Ainda está aí?", sem conexão) com o relógio falso do
Vitest, e ponta a ponta com o `page.clock` do Playwright para os 3 minutos e os 12 horas do SC-004.
Cada `feat(016)` vem depois de um `test(016): … (vermelho)`.
