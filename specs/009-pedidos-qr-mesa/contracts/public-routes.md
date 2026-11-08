# Contratos: rotas e ações públicas (feature 009)

Única parte do sistema sem usuário logado. Regras comuns:

- O restaurante e a mesa vêm **só** do token (link do QR code ou cookie do acesso), resolvidos por
  funções `SECURITY DEFINER` que devolvem o mínimo. Nenhum id vem do cliente.
- Depois disso, tudo roda em `withTenantTx(restaurantId)`; o RLS vale como nas telas da equipe.
- Erros nunca dizem se um token existe em outro restaurante: token desconhecido e de outro
  restaurante dão a mesma resposta.
- O relógio é o do servidor. As respostas trazem `serverNow` e `expiresAt` para a contagem na tela.
- Origem (IP, navegador) vai em `menu_accesses` e no evento de envio.

## `GET /m/{token}` — ler o QR code (route handler)

`/m/{token}` responde `307 → /cardapio/qr/{token}`: o cookie do acesso só vale em `/cardapio`, e
é nessa segunda rota que o navegador manda o cookie anterior (passo 5). Os passos abaixo rodam em
`/cardapio/qr/{token}`.

1. `app_table_by_qr_token(token)`.
2. Não achou → página "QR code inválido. Chame um garçom." (status 404).
3. Mesa inativa → "Esta mesa não está recebendo pedidos. Chame um garçom." (sem criar acesso).
4. `accepting_qr_orders` falso → "O restaurante não está recebendo pedidos agora. Chame um garçom."
5. Se veio cookie `menu_access` válido, encerra esse acesso (`ended_at = agora`).
6. Cria `menu_accesses` (`expires_at = agora + 20 min`), grava cookie `menu_access`
   (`httpOnly; Secure; SameSite=Lax; Path=/cardapio; Max-Age=1200`) e responde
   `303 → /cardapio`.

Resposta com `Cache-Control: no-store` e `Referrer-Policy: no-referrer`.

## `GET /cardapio` — cardápio (página)

Lê o cookie, resolve com `app_menu_access_by_token_hash`. Sem cookie ou acesso fechado: "Seu tempo
acabou. Escaneie o QR code da mesa de novo para continuar." (sem lista de produtos). Aberto:

```ts
type MenuView = {
  restaurantName: string;
  tableName: string;
  serverNow: string;   // ISO
  expiresAt: string;   // ISO
  products: { id: string; name: string; price: string }[]; // ordem alfabética
  ordersLeft: number;  // 10 − pedidos já enviados neste acesso
};
```

Mesa inativada ou chave desligada depois da leitura: mostra a mensagem correspondente.

## Ação `submitOrderAction` — enviar pedido

Entrada (Zod):

```ts
{
  clientRequestId: string; // uuid
  lines: { recipeId: string; quantity: number; unitPrice: string; addons: …; removals: … }[]; // 1 a 30, escolhas na 010
}
```

O acesso vem do cookie, não da entrada. Ordem das conferências, todas na mesma transação:

| # | Conferência | Erro |
|---|---|---|
| 1 | Cookie resolve um acesso deste restaurante | `ACCESS_EXPIRED` |
| 2 | `ended_at is null` e `agora ≤ expires_at + 15 s` | `ACCESS_EXPIRED` |
| 3 | Já existe pedido com este `clientRequestId` no acesso | devolve esse pedido (sucesso) |
| 4 | Mesa ativa | `TABLE_INACTIVE` |
| 5 | Chave de pedidos ligada | `ORDERING_PAUSED` |
| 6 | Menos de 10 pedidos no acesso | `ACCESS_ORDER_LIMIT` |
| 7 | Linhas: 1 a 30; quantidade inteira 1–20; adicionais e retiradas válidos (010) | `EMPTY_ORDER`, `INVALID_QUANTITY` e os erros da 010 |
| 8 | Todo produto é vendido, ativo, com preço e não esgotado hoje | `PRODUCT_UNAVAILABLE` + `details.recipeIds` |
| 9 | Preço de cada linha igual ao atual | `PRICE_CHANGED` + `details.prices: { recipeId, price }[]` |

Sucesso: grava `orders` (`RECEIVED`), `order_lines`, `order_status_events` (de nulo para
`RECEIVED`) e o número do dia. Saída:

```ts
{ orderId: string; number: number; total: string; status: "RECEIVED" }
```

Mensagens ao cliente (em `error-messages.ts`):

| Código | Texto |
|---|---|
| `ACCESS_EXPIRED` | Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar. |
| `TABLE_INACTIVE` | Esta mesa não está recebendo pedidos. Chame um garçom. |
| `ORDERING_PAUSED` | O restaurante não está recebendo pedidos agora. Chame um garçom. |
| `ACCESS_ORDER_LIMIT` | Chame um garçom para continuar pedindo. |
| `PRODUCT_UNAVAILABLE` | {produto} não está mais disponível. |
| `PRICE_CHANGED` | O preço de {produto} mudou para R$ {preço}. |

## Ação `listAccessOrdersAction` — "Meus pedidos"

Sem entrada; acesso pelo cookie. Acesso fechado: `ACCESS_EXPIRED`. Saída: pedidos deste acesso,
mais novo primeiro: `{ number, submittedAt, status, total, lines: { quantity, productName, changes }[] }` (`changes` vem da 010).
Nunca mostra pedidos de outro celular da mesma mesa.
