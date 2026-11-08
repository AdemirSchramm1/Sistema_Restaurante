# Pesquisa: 009 — Pedidos pelo QR code da mesa

Cada decisão no formato: decisão, motivo e alternativas.

## R1. Link do QR code e como achar o restaurante sem login

- **Decisão**: o QR code aponta para `{appUrl}/m/{token}`. O token tem 32 bytes aleatórios em
  base64url (o `cryptoTokens` da 001), guardado em `dining_tables.qr_token` (único). Diferente do
  convite, o token fica **em texto**: ele está impresso e colado na mesa, à vista de todos, e o dono
  precisa reimprimir um QR code estragado sem invalidar os outros. A proteção contra uso indevido é
  trocar o QR code. A rota chama `app_table_by_qr_token(token)`, função `SECURITY DEFINER`
  que devolve só `restaurant_id`, `table_id` e `active` (mesmo padrão de
  `app_invitation_by_token_hash`). Daí em diante tudo roda em `withTenantTx` com esse
  `restaurant_id`, e o RLS continua valendo. "Trocar QR code" grava um token novo; o antigo deixa de
  achar a mesa na hora.
- **Motivo**: o link não se adivinha nem se deduz de outra mesa (FR-002); dá para reimprimir; o
  restaurante nunca vem do cliente.
- **Alternativas**: `/m/{restaurantId}/{tableNumber}` (adivinhável, qualquer um pede para qualquer
  mesa); só o hash, como no convite (não daria para reimprimir sem trocar o QR code); hash mais token
  cifrado com chave do servidor (segredo novo para proteger algo que já está impresso na mesa);
  assinatura HMAC sem tabela (trocar o QR code exigiria lista de revogados).

## R2. Acesso ao cardápio de 20 minutos

- **Decisão**: cada leitura do QR code cria uma linha em `menu_accesses` com `opened_at` e
  `expires_at = opened_at + 20 min` (constante `MENU_ACCESS_MINUTES = 20` no domínio). O token do
  acesso (32 bytes, banco só com hash) vai num cookie `menu_access`: `httpOnly`, `secure`,
  `sameSite=lax`, `path=/cardapio`, `maxAge=1200`. A rota `/m/{token}` cria o acesso, grava o
  cookie e redireciona para `/cardapio` (o link do QR code não fica no histórico do navegador como
  página). Se o celular já tinha cookie de acesso, o anterior recebe `ended_at` (FR-005, US3-5).
  O envio é aceito se `agora ≤ expires_at + 15 s` (`SUBMIT_GRACE_SECONDS`), para quem tocou em
  "Confirmar" no último segundo (US3-7). O tempo que falta na tela vem do servidor.
- **Motivo**: prazo fixo desde a leitura, como o dono decidiu; o servidor decide sozinho se o
  acesso vale (cookie apagado ou relógio adiantado não estendem nada); o cookie limita o acesso ao
  celular que leu o QR code.
- **Alternativas**: token do acesso na URL (vaza ao compartilhar o link, fica no histórico); só
  `localStorage` (o servidor não teria como recusar); prazo renovado a cada ação (descartado pelo
  dono em 2026-11-08).

## R3. Sem pedido em dobro

- **Decisão**: o carrinho gera um `clientRequestId` (UUID) ao abrir o resumo de confirmação e o
  reusa em toda nova tentativa. `orders` tem índice único `(menu_access_id, client_request_id)`. Se
  o `INSERT` bater no índice, o caso de uso devolve o pedido já gravado.
- **Motivo**: toque duplo e reenvio após queda de rede (US2-9, FR-007) sem bloqueio no servidor.
- **Alternativas**: desabilitar o botão (não cobre queda de rede); janela de tempo por mesa (bloqueia
  dois celulares pedindo a mesma coisa de propósito).

## R4. Telas que se atualizam sozinhas

- **Decisão**: componente cliente `AutoRefresh` que chama `router.refresh()` a cada 5 s na cozinha
  e no garçom, e a cada 10 s em "Meus pedidos" enquanto o acesso estiver aberto. Para quando a aba
  fica escondida (`document.visibilityState`) e atualiza ao voltar. Pedido novo ganha destaque por
  chegar depois da última atualização vista.
- **Motivo**: cumpre "até 10 segundos" (FR-009, SC-003) com o que já existe (Server Components);
  funciona na Vercel sem conexão longa; ao voltar a internet traz tudo (caso-limite).
- **Alternativas**: Server-Sent Events (conexão longa limitada pela duração das funções na
  Vercel); serviço de tempo real (Pusher, Ably: custo e dependência externa); `LISTEN/NOTIFY` (não
  atravessa o pooler do Neon). Ficam para quando houver problema medido (princípio VII).

## R5. Gerar o QR code

- **Decisão**: pacote `qrcode` (MIT, sem dependências nativas) no servidor, `toString(url, { type:
  "svg", errorCorrectionLevel: "M", margin: 2 })`, dentro de `src/infra/qr.ts`. O SVG aparece na
  página da mesa, num botão "Baixar imagem" (arquivo `.svg`) e na folha de impressão
  `/pedidos/mesas/imprimir`, que usa CSS de impressão (classe `no-print` já existente); o navegador
  imprime ou salva em PDF.
- **Motivo**: SVG imprime nítido em qualquer tamanho; nada roda no celular do cliente; sem gerar PDF
  no servidor.
- **Alternativas**: escrever o algoritmo de QR (arriscado, sem ganho); gerar no navegador (mais
  JavaScript na tela da equipe); PDF no servidor (dependência pesada).

## R6. Número do pedido

- **Decisão**: `order_day_counters (restaurant_id, business_day)` com `last_number`. Na transação do
  envio: `INSERT … VALUES (…, 1) ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING
  last_number`. `business_day` é a data local no fuso do restaurante (`restaurants.timezone`),
  calculada no domínio a partir do relógio recebido.
- **Motivo**: número curto para a cozinha chamar ("pedido 27"), sem buraco nem repetição sob
  concorrência.
- **Alternativas**: `max(number) + 1` (corrida entre dois celulares); sequence global (não reinicia
  por dia nem por restaurante).

## R7. Produto esgotado

- **Decisão**: `recipes.sold_out_on date null`. "Esgotado hoje" grava a data local de hoje;
  "Disponível de novo" grava `null`. O domínio considera esgotado só se `sold_out_on = hoje`. Muda
  pela auditoria do produto (campo "Esgotado"). Não cria versão.
- **Motivo**: volta sozinho no dia seguinte, sem rotina agendada; não mexe no "ativo".
- **Alternativas**: booleano (alguém precisa lembrar de desmarcar); tabela de disponibilidade
  (desnecessária para um campo).

## R8. Papel Garçom e menu por permissão

- **Decisão**: `WAITER` entra no enum `role` (`ALTER TYPE role ADD VALUE 'WAITER'`) e em `ROLES`
  ("Garçom"). Ações novas: `table.manage`, `ordering.toggle`, `order.kitchen`, `order.cancel`,
  `order.deliver`, `order.read`, `product.sold_out`. Matriz: gerente tudo; chef `order.kitchen`,
  `order.cancel`, `order.deliver`, `order.read`, `product.sold_out`; garçom `order.deliver` e
  `order.read` (sem `catalog.read`). O menu do layout passa a mostrar só o que o papel pode ver; o
  garçom que abre `/estoque/...` vê "Sem acesso". O convite da 001 já aceita papéis do enum.
- **Motivo**: FR-010; o garçom não precisa ver custo nem estoque.
- **Alternativas**: tratar o garçom como "Administrativo" (veria estoque e custos).

## R9. Conferência de preço e disponibilidade no envio

- **Decisão**: o carrinho manda cada linha com `recipeId`, `quantity`, as escolhas da 010 e o `unitPrice` que o
  cliente viu. Na transação, o caso de uso relê os produtos (ativo, vendido, com preço, não esgotado
  hoje, versão mais nova). O domínio (`checkOrder`) devolve: `PRODUCT_UNAVAILABLE` com a lista,
  `PRICE_CHANGED` com os preços novos, ou as linhas prontas com preço e versão do momento. Nada é
  gravado se houver diferença; a tela mostra o aviso e pede nova confirmação (US2-10, US2-11).
- **Motivo**: o cliente nunca paga um preço que não viu; o pedido guarda a versão que a 005 vai
  baixar.
- **Alternativas**: gravar com o preço novo sem avisar; confiar no preço do cliente.

## R10. Abuso e limites

- **Decisão**: no domínio: quantidade inteira 1–20 (`INVALID_QUANTITY`), até 30 linhas, até 10 pedidos por acesso
  (`ACCESS_ORDER_LIMIT`). A rota `/m/{token}` não cria acesso para mesa inativa nem com a chave
  desligada; mostra a mensagem direto.
- **Motivo**: casos-limite da spec; impede brincadeira sem atrapalhar uma mesa normal.
- **Alternativas**: captcha (atrapalha o cliente); limite por IP (rede do restaurante é um IP só).

## R11. Layout do cardápio

- **Decisão**: grupo de rotas `app/(cardapio)/` com layout próprio (sem menu da equipe, sem
  `requireContext`), fonte grande, botões de 44 px, carrinho fixo no rodapé. Página Server Component
  com a lista; carrinho e contagem do tempo em componentes cliente pequenos. Busca por nome no
  navegador sobre a lista já carregada.
- **Motivo**: SC-001 e SC-005: uma requisição traz o cardápio todo (200 produtos são poucos KB).
- **Alternativas**: SPA separada (outra aplicação, contra o princípio VII).
