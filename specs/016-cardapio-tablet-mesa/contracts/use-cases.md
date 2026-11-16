# Contratos: 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

Casos de uso, rotas e telas. Erros com os códigos de `src/domain/shared/result.ts`; os textos para
a pessoa ficam em `src/components/forms/error-messages.ts`. Toda conferência de permissão grava
`DENIED` na auditoria quando nega, como hoje.

## Aparência do restaurante (`src/application/menu/appearance.ts`, novo)

| Caso de uso | Entrada | Conferências, na ordem | Saída |
|---|---|---|---|
| `getAppearance(deps, ctx)` | – | `menu.write` ou `menu.appearance` | `{ logo, cover }` (`Photo \| null`) |
| `setAppearanceImage(deps, ctx, { kind, bytes })` | `kind`: `LOGO` ou `COVER` | `menu.appearance`; processador com o formato do `kind` (`PHOTO_TYPE`, `PHOTO_TOO_BIG`, `PHOTO_TOO_SMALL`); loja (`PHOTO_STORAGE_FAILED`) | `{ photo }`. Arquivos novos antes do banco; os antigos saem depois do commit (mesma ordem de `setProductPhoto`, 013) |
| `removeAppearanceImage(deps, ctx, { kind })` | | `menu.appearance`; sem imagem: `NO_CHANGE` | – |

As três somam 1 em `restaurants.version` e gravam `audit_log` ([R14](../research.md#r14-auditoria)).

## Tablet da mesa — equipe (`src/application/ordering/tablets.ts`, novo)

| Caso de uso | Conferências | Efeito |
|---|---|---|
| `listTabletStatus(deps, ctx)` | `table.manage` | Por mesa ativa: `{ tableId, name, link: string \| null, boundAt, lastSeenAt, signal }` e o total de ligados (US4-8). Uma consulta com junção do acesso `TABLET` aberto; não cresce em idas ao banco com o número de mesas |
| `createTabletLink(deps, ctx, { tableId, version })` | `table.manage`; mesa do restaurante (`NOT_FOUND`); já tem link: `NO_CHANGE`; `version` (`STALE_RECORD`) | Grava `tablet_token` e `tablet_token_rotated_at`; auditoria `link_created` |
| `releaseTablet(deps, ctx, { tableId })` | `table.manage`; nenhum tablet ligado: `NO_CHANGE` | Encerra o acesso `TABLET` aberto com `RELEASED`; auditoria `released` |
| `rotateTabletLink(deps, ctx, { tableId, version })` | `table.manage`; sem link: `NOT_FOUND`; `version` | Token novo, encerra o acesso aberto com `LINK_ROTATED`, na mesma transação; auditoria `link_rotated` |

O link montado é `${deps.appUrl}/t/${tablet_token}`, como o do QR code (`/m/`). O QR code do link é
gerado na tela com o mesmo `src/infra/qr.ts` da 009.

## Tablet da mesa — aparelho (rota pública)

### `GET /t/{token}` (`app/t/[token]/route.ts`, novo)

`bindTablet(deps, { tabletToken, cookie, origin })` em `src/application/ordering/menu-access.ts`:

| Situação | Resposta |
|---|---|
| Token vazio ou desconhecido | 404, página mínima "Link inválido. Chame um garçom." |
| Cookie `menu_tablet` deste aparelho com acesso `TABLET` aberto desta mesa | 303 para `/cardapio`, cookie regravado (mesmo token, `Max-Age` renovado) |
| Mesa sem tablet ligado | Insere o acesso `TABLET`, auditoria `bound`; 303 para `/cardapio` com `Set-Cookie: menu_tablet=…; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax[; Secure]` |
| Perdeu a corrida no único `menu_accesses_one_tablet` | 200, "Este link já está ligado em outro tablet. Peça ao gerente para liberar." |
| Outro aparelho ligado | 200, a mesma mensagem |

Cabeçalhos `Cache-Control: no-store` e `Referrer-Policy: no-referrer`, como `/m/{token}`. Mesa
inativa e chave desligada não impedem ligar ([R2](../research.md#r2-link-do-tablet-e-o-aparelho-ligado)).

### `GET /api/cardapio/tablet` (`app/api/cardapio/tablet/route.ts`, novo)

`tabletStatus(deps, cookie)`. Sem cookie ou acesso desconhecido: 401 `{ state: "UNKNOWN" }`.

```json
{
  "state": "OK" | "TABLE_INACTIVE" | "ORDERING_PAUSED" | "RELEASED" | "LINK_ROTATED",
  "tableName": "Mesa 12",
  "tabId": "uuid" | null,
  "stamp": "texto opaco"
}
```

Grava `last_seen_at` quando o gravado tem mais de 60 s. `Cache-Control: no-store`.

## Mudanças em casos de uso existentes

| Caso de uso | Mudança |
|---|---|
| `openMenuAccess` (009) | Grava `kind = 'QR'`; `endPrevious` só encerra acesso `QR` (um cookie `menu_access` nunca aponta para tablet, mas a regra fica explícita) |
| `accessFromCookie` (009) | Recebe os dois cookies; usa o do tablet quando existe e está aberto; devolve `kind` |
| `getMenu` (009, 013) | `MenuView` ganha `mode: "QR" \| "TABLET"`, `appearance: { logo, cover }`; no tablet, `expiresAt` e `ordersLeft` são nulos; `TABLE_TAB_CLOSED` só no `QR` |
| `listAccessOrders` (009) | No tablet, os pedidos da conta aberta da mesa (`listForTab`), de qualquer origem (FR-007); sem conta aberta, lista vazia |
| `submitOrder` (009, 010) | `canSubmitWith` e o limite por tipo; grava `source` do `kind`; no tablet, conta fechada no meio abre conta nova (R6) |
| `closeTab` (011) | `endOpenForTable` só encerra acessos `QR` |
| `getMenuPreview` (013) | Recebe `mode` (`QR` ou `TABLET`) e devolve a aparência; a pré-visualização ganha a escolha "Como o tablet da mesa" |
| `setProductPhoto` (013) | Passa `shape: "PRODUCT"` ao processador |
| Cozinha, Garçom, conta, consulta (009, 011, 015) | Mostram "Mesa 12 · tablet" pela origem; filtro "Origem" da consulta ganha "Tablet" |

## Permissões (`src/domain/access/permissions.ts`)

| Ação | Quem | Nova? |
|---|---|---|
| `menu.appearance` | Gerente | Sim |
| `table.manage` | Gerente | Não (passa a cobrir o tablet da mesa) |

## Server Actions

| Arquivo | Ações |
|---|---|
| `src/actions/appearance.ts` (novo) | `setAppearanceImageAction(kind, formData)`, `removeAppearanceImageAction(kind)` (upload pelo mesmo caminho da 013: `app/api/cardapio/foto/route.ts` ganha o parâmetro `kind`) |
| `src/actions/tables.ts` | `createTabletLinkAction`, `releaseTabletAction`, `rotateTabletLinkAction` |

## Telas

| Endereço | Quem | O que muda |
|---|---|---|
| `/cardapio` (cliente) | QR code e tablet | Topo com capa e logo (US1), layout por largura (US2), carrinho ao lado ou barra (US3); no tablet: boas-vindas, "Ainda está aí?", "Pedido enviado", sem conexão, **Tela cheia**, sem "Faltam N min" (US5) |
| `/pedidos/cardapio` (equipe) | Gerente | Quadro **Aparência** com logo e capa, **Trocar** e **Tirar** (US1) |
| `/pedidos/cardapio/ver` (equipe) | Gerente e chef | Escolha "Celular pelo QR code" / "Tablet da mesa" |
| `/pedidos/mesas` (equipe) | Gerente | No cartão de cada mesa, **Tablet da mesa**: link, **Copiar**, QR code do link, situação, **Liberar**, **Trocar link**, ajuda "Como travar o tablet". No topo, "4 mesas com tablet ligado" |

Componentes novos em `src/components/ordering/`: `menu-header.tsx` (capa, logo, nome, mesa),
`product-row.tsx` (cartão em linha do celular), `cart-panel.tsx` (coluna ao lado), `cart-bar.tsx`
(barra do pé), `tablet-shell.tsx` (máquina de estados, tela acesa, tela cheia, sem conexão),
`tablet-welcome.tsx`, `still-there.tsx`, `table-tablet-card.tsx` (equipe). Em
`src/components/menu/`: `appearance-form.tsx`.

## Mensagens novas

| Código ou situação | Texto |
|---|---|
| Link desconhecido ou trocado | "Link inválido. Chame um garçom." |
| Link ligado em outro aparelho | "Este link já está ligado em outro tablet. Peça ao gerente para liberar." |
| `RELEASED` no tablet | "Este tablet foi desligado. Peça ao gerente." |
| Sem conexão | "Sem conexão com o restaurante. Chame um garçom." |
| Parado com carrinho | "Ainda está aí? Seu pedido não foi enviado." |
| Depois de enviar | "Pedido enviado para a cozinha" |
| Carrinho vazio ao lado | "Escolha os pratos e eles aparecem aqui." |
| `PHOTO_TOO_SMALL` com `LOGO` | "O logo precisa ter pelo menos 200 px no lado menor." |
| `PHOTO_TOO_SMALL` com `COVER` | "A foto de capa precisa ter pelo menos 1200 px de largura." |
