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

## Código

| Camada | Arquivo |
|---|---|
| Rotas | `app/m/[token]/route.ts`, `app/(cardapio)/cardapio/qr/[token]/route.ts`, `app/(cardapio)/cardapio/page.tsx` |
| Resposta da leitura | `src/actions/_qr-scan.ts` (`qrScanResponse`, `MENU_ACCESS_COOKIE`) |
| Envio e "Meus pedidos" | `src/actions/menu.ts` (`submitOrderAction`, `listAccessOrdersAction`) |
| Casos de uso | `src/application/ordering/menu-access.ts`, `menu.ts`, `submit-order.ts` |
| Busca sem restaurante | `src/infra/db/public-ordering.ts` (porta `GlobalLookups`) |
| Desenho do QR code | `src/infra/qr.ts` (porta `QrRenderer`, biblioteca `qrcode`, SVG) |

O layout `app/(cardapio)` não tem menu nem nada da equipe. O restaurante nunca vem do cliente: só
do token do QR code ou do cookie.

## Atualização das telas

Sem conexão longa: `AutoRefresh` chama `router.refresh()` a cada 5 s na Cozinha e no Garçom e a
cada 10 s no cardápio (para "Meus pedidos" e produtos esgotados).
