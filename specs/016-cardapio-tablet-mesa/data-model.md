# Modelo de dados: 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

Migração `0016_table_tablets`. Vem depois da `0014` (caixa do dia) e da `0015` (pedido do garçom);
se a ordem de implementação mudar, os números trocam no PR da implementação (o diário do Drizzle
não aceita buraco) e o [R7](research.md#r7-origem-do-pedido-tablet) diz quem cria o enum da
origem. Nenhuma tabela nova.

## `restaurants` (001) — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `logo_base` | `text` nulo | Endereço do logo até o identificador, sem a largura (como `photo_base` da 013) |
| `logo_widths` | `smallint[]` nulo | Larguras gravadas: 96, 192, 384 (as que couberem) |
| `cover_base` | `text` nulo | Endereço da capa |
| `cover_widths` | `smallint[]` nulo | 600, 1200, 1920 (as que couberem) |

Checks `restaurants_logo_pair` e `restaurants_cover_pair`: base e larguras nulas juntas, e pelo
menos uma largura quando há imagem (mesma forma de `recipes_photo_pair`). Trocar ou tirar soma 1 no
`version` (o `stamp` do tablet vê a mudança, [R5](research.md#r5-conta-fechada-mesa-renomeada-e-o-tablet-visto-há)).

## `dining_tables` (009) — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `tablet_token` | `text` nulo, único | Código do link `/t/{token}`; 32 bytes aleatórios em base64url (`deps.tokens.create()`, o mesmo do QR code). Nulo até o gerente criar o link |
| `tablet_token_rotated_at` | `timestamptz` nulo | Quando o link foi criado ou trocado |

Check `dining_tables_tablet_token_pair`: os dois nulos juntos. Trocar soma 1 no `version`.

## `menu_accesses` (009) — colunas novas e checks

| Coluna | Tipo | Regra |
|---|---|---|
| `kind` | enum `menu_access_kind` (`QR`, `TABLET`) | Obrigatória. Os acessos que já existem viram `QR` (default só durante a migração) |
| `expires_at` | `timestamptz` (passa a aceitar nulo) | Nulo só no `TABLET` |
| `last_seen_at` | `timestamptz` nulo | Sinal de vida do tablet; gravado no máximo uma vez por minuto ([R5](research.md#r5-conta-fechada-mesa-renomeada-e-o-tablet-visto-há)). Sempre nulo no `QR` |

Checks:

- `menu_accesses_twenty_minutes` sai e entra `menu_accesses_expiry_by_kind`:
  `(kind = 'QR' and expires_at = opened_at + interval '20 minutes') or (kind = 'TABLET' and
  expires_at is null)`.
- `menu_accesses_last_seen`: `kind = 'TABLET' or last_seen_at is null`.

Enum `menu_access_end_reason` (011): ganha `RELEASED` e `LINK_ROTATED` (`ALTER TYPE … ADD VALUE` em
instruções próprias; nada na mesma migração usa os valores).

Índices:

- `menu_accesses_one_tablet` único `(table_id) where kind = 'TABLET' and ended_at is null` (um
  aparelho por mesa, [R2](research.md#r2-link-do-tablet-e-o-aparelho-ligado)).
- `menu_accesses_open` e `menu_accesses_table` (009) usam `expires_at`; com nulo no tablet, eles
  continuam servindo ao QR code. A busca do tablet aberto da mesa usa o único acima.

Gatilho novo `menu_accesses_frozen` (a 009 não tem gatilho nesta tabela): `UPDATE` só pode mudar
`ended_at`, `end_reason` e `last_seen_at`; `DELETE` é recusado (`APPEND_ONLY`), como
`app_order_status_only` faz em `orders`. Assim o tipo, a mesa e o hash do cookie de um tablet nunca
mudam depois de ligar.

## `orders` (009, 015) — origem

| Mudança | Regra |
|---|---|
| Enum `order_source` | Ganha `TABLET` |
| Check `orders_source_shape` (015) | Ganha o ramo `(source = 'TABLET' and menu_access_id is not null and placed_by is null)` |

O pedido do tablet usa o mesmo único `orders_client_request (menu_access_id, client_request_id)`
do QR code. Nenhuma coluna nova.

## Funções do banco para a rota pública

As buscas sem restaurante (antes da RLS) são funções `SECURITY DEFINER` do banco, chamadas por
`src/infra/db/public-ordering.ts`, como `app_table_by_qr_token` e `app_menu_access_by_token_hash`
(009):

| Função | Devolve |
|---|---|
| `app_table_by_tablet_token(p_token)` (nova) | `restaurant_id`, `table_id`, `active` |
| `app_menu_access_by_token_hash(p_hash)` | Ganha a coluna `kind` (`DROP` e `CREATE` de novo, porque o tipo de retorno muda) |

## RLS, permissões do banco e auditoria

- Colunas novas herdam a RLS das tabelas (`0001_security`, `0009_ordering`). `app_user` já tem
  `SELECT, INSERT, UPDATE` em `dining_tables` e `menu_accesses`, e `UPDATE` em `restaurants`.
- `audit_log`: ver [R14](research.md#r14-auditoria). O token nunca vai para `changes`.

## Tipos no código

| Onde | O que muda |
|---|---|
| `src/domain/ordering/menu-access.ts` | `MenuAccessKind = "QR" \| "TABLET"`; `MenuAccessTimes` ganha `kind` e `expiresAt: Date \| null`; `isAccessOpen`, `canSubmitWith`, `secondsLeft`, `shouldWarn` por tipo; `ordersLimit(kind)`; `MenuAccessEndReason` + `RELEASED`, `LINK_ROTATED` |
| `src/domain/ordering/tablet-screen.ts` (novo) | `TabletScreen`, `tabletScreen(state, event)`, `IDLE_SECONDS`, `STILL_THERE_SECONDS`, `SENT_SECONDS` ([R4](research.md#r4-o-que-o-tablet-mostra-e-quando-ele-se-limpa)) |
| `src/domain/ordering/tablet-signal.ts` (novo) | `SIGNAL_LOST_MINUTES = 10`, `tabletSignal(lastSeenAt, now)` → `{ kind: "NEVER" \| "SEEN" \| "LOST", minutes }`, `HEARTBEAT_SECONDS = 60` |
| `src/domain/ordering/order.ts` | `ORDER_SOURCES` + `TABLET`; `ORDER_SOURCE_LABELS.TABLET = "tablet"` |
| `src/domain/menu/photo.ts` | `PhotoShape = "PRODUCT" \| "LOGO" \| "COVER"`; `PHOTO_SHAPES` com recorte, mínimo e larguras ([R8](research.md#r8-logo-e-capa-onde-e-em-que-formato)); `checkPhotoFile(file, shape)`, `croppedSize(w, h, shape)`, `variantWidths(width, shape)` |
| `src/domain/menu/menu-layout.ts` (novo) | `MenuLayout = "list" \| "grid3" \| "grid3side" \| "grid4side"`, `menuLayout(width)`, `LAYOUT_BREAKPOINTS`, `CART_COLUMN_PX = 320` |
| `src/domain/menu/cover-overlay.ts` (novo) | `COVER_OVERLAY` (opacidades), `coverTextContrast()` ([R9](research.md#r9-camada-escura-da-capa-e-contraste)) |
| `src/domain/ordering/quick-add.ts` (novo) | `quickAdd(product)` → `{ kind: "ADD", line } \| { kind: "OPEN" }` |
| `src/application/menu/ports.ts` | `PhotoProcessor.process(bytes, shape)`; `RestaurantAppearance = { logo: Photo \| null; cover: Photo \| null }`; repo `appearance.get()`, `appearance.set(kind, photo \| null, audit)` |
| `src/application/ordering/ports.ts` | `MenuAccessRecord` + `kind`, `lastSeenAt`; `MenuAccessRepo` + `insertTablet`, `openTablet(tableId)`, `touch(id, now)`, `end(id, at, reason)` com os motivos novos, `endOpenForTable` só `QR`; `TableRecord` + `tabletToken`, `tabletTokenRotatedAt`; `TableRepo` + `setTabletToken(id, token, at, audit)`; `OrderRepo` + `listForTab(tabId)`, `tabStamp(tableId)` |

## Estados do tablet da mesa

| Situação | Como se sabe | O que a tela Mesas mostra |
|---|---|---|
| Sem link | `tablet_token` nulo | **Criar link do tablet** |
| Link, nenhum tablet | Token e nenhum acesso `TABLET` aberto da mesa | "Nenhum tablet ligado" |
| Ligado | Acesso `TABLET` aberto | "Tablet ligado desde 16/11 20:05 · visto há 2 min" |
| Sem sinal | Ligado e `last_seen_at` com mais de 10 min | "Sem sinal há 25 min" em destaque |

Transições: **Criar link** (sem link → link), aparelho abre o link (link → ligado), **Liberar**
(ligado → link; o acesso termina com `RELEASED`), **Trocar link** (qualquer → link novo; o acesso
aberto, se houver, termina com `LINK_ROTATED`). Fechar a conta da mesa não muda nada aqui
([R6](research.md#r6-fechar-a-conta-não-desliga-o-tablet)).
