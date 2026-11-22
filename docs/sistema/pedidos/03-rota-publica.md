# Pedidos — Rota pública e acesso ao cardápio

Decisão em [ADR 0005](../adr/0005-cardapio-publico.md); contratos em
[specs/009 public-routes](../../../specs/009-pedidos-qr-mesa/contracts/public-routes.md).

## Fluxo

```text
câmera ──► GET /m/{token} ──307──► GET /cardapio/qr/{token}
                                     │ acha mesa pelo token (SECURITY DEFINER)
                                     │ encerra o acesso do cookie anterior
                                     │ cria menu_accesses (20 min)
                                     └─303──► /cardapio  (Set-Cookie: menu_access)
```

- `/m/{token}` existe só para o link do QR code ser curto. Redireciona para `/cardapio/qr/{token}`
  porque o cookie tem `Path=/cardapio` e só chega lá.
- Cookie `menu_access`: `HttpOnly; Secure; SameSite=Lax; Path=/cardapio; Max-Age=1200`. O banco
  guarda só o SHA-256.
- Respostas com `Cache-Control: no-store` e `Referrer-Policy: no-referrer`.
- Token desconhecido: página mínima "QR code inválido. Chame um garçom." (404). Mesa inativa e chave
  desligada: página com a mensagem, sem criar acesso.

## Tablet da mesa (016)

```text
tablet ──► GET /t/{token}      acha a mesa pelo link (app_table_by_tablet_token)
             │ cookie menu_tablet deste aparelho aberto nesta mesa? mantém
             │ senão insere menu_accesses kind=TABLET (único por mesa aberta)
             └─303──► /cardapio  (Set-Cookie: menu_tablet)
tablet ──► GET /api/cardapio/tablet  a cada 10 s (60 s nas boas-vindas)
             { state, tableName, tabId, stamp } e grava last_seen_at (1×/min)
```

- Cookie `menu_tablet`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000` (400 dias), `Secure` em
  HTTPS. `Path=/` para a rota `/t/` reconhecer o mesmo aparelho.
- Com os dois cookies, vale o do tablet (`pickMenuCookie`): ler um QR code no tablet não o tira da
  mesa. `menuCookies()` fica em `src/actions/_menu-cookies.ts`, fora do arquivo `"use server"`, para
  não virar ação que devolve cookie `HttpOnly`.
- Respostas `/t/`: link desconhecido 404 "Link inválido. Chame um garçom."; outro aparelho ligado
  200 "Este link já está ligado em outro tablet. Peça ao gerente para liberar."; `no-store` e
  `no-referrer`.
- `/api/cardapio/tablet`: sem cookie de tablet, 401 `{ state: "UNKNOWN" }`. `state` é `OK`,
  `TABLE_INACTIVE`, `ORDERING_PAUSED`, `RELEASED` ou `LINK_ROTATED`. O `stamp` junta a versão do
  restaurante (logo, capa, chave), a da mesa, a conta aberta, o último `status_changed_at` e a soma
  das versões dos pedidos dela: mudou, o tablet chama `router.refresh()`; `tabId` que estava aberto
  e mudou volta às boas-vindas sem o carrinho.

## Código

| Camada | Arquivo |
|---|---|
| Rotas | `app/m/[token]/route.ts`, `app/(cardapio)/cardapio/qr/[token]/route.ts`, `app/(cardapio)/cardapio/page.tsx` |
| Resposta da leitura | `src/actions/_qr-scan.ts` (`qrScanResponse`, `MENU_ACCESS_COOKIE`) |
| Tablet (016) | `app/t/[token]/route.ts`, `app/api/cardapio/tablet/route.ts`, `src/actions/_tablet.ts` (`tabletBindResponse`, `tabletStatusResponse`, `MENU_TABLET_COOKIE`), `src/application/ordering/tablets.ts`, `src/components/ordering/tablet-shell.tsx` |
| Envio e "Meus pedidos" | `src/actions/menu.ts` (`submitOrderAction`, `listAccessOrdersAction`) |
| Casos de uso | `src/application/ordering/menu-access.ts`, `menu.ts`, `submit-order.ts` |
| Busca sem restaurante | `src/infra/db/public-ordering.ts` (porta `GlobalLookups`) |
| Desenho do QR code | `src/infra/qr.ts` (porta `QrRenderer`, biblioteca `qrcode`, SVG) |

O layout `app/(cardapio)` não tem menu nem nada da equipe. O restaurante nunca vem do cliente: só
do token do QR code ou do cookie.

## Atualização das telas

Sem conexão longa: `AutoRefresh` chama `router.refresh()` a cada 5 s na Cozinha e no Garçom e a
cada 10 s no cardápio do celular (para "Meus pedidos" e produtos esgotados). O tablet (016) não usa
o `AutoRefresh`: a checagem leve acima só atualiza a página quando o `stamp` muda, e a página
inteira a cada 5 min quando ninguém está pedindo (esgotados e preços).
