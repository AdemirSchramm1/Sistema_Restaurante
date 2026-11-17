# Tarefas — 016 Cardápio com a cara do restaurante e tablet fixo na mesa

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[quickstart.md](quickstart.md).

## Regras (constituição I, FR-013 e [research R16](research.md#r16-testes-primeiro-em-que-camada))

- Toda tarefa de código vem **depois** da tarefa `[teste]` que a exige. O teste é escrito, rodado e
  visto falhar **na asserção** (não no `import`: crie um esqueleto vazio antes, se preciso). Só
  então entra o mínimo de código para passar. Valem as regras TDD-001 a TDD-010 da 013.
- Commits: `test(016): … (vermelho)` antes de `feat(016): …` do mesmo assunto, citando o número da
  tarefa. Refatoração só com tudo verde.
- Nenhum `.skip`, `.only` ou teste apagado. Testes da 009, 010, 011 e 013 só mudam onde esta
  feature muda a regra de propósito (T024, T038, T062), e o commit diz qual regra mudou.
- Dinheiro sempre em `Decimal` (`src/domain/shared/decimal.ts`); o carrinho usa `lineTotal` e
  `cartTotal` da 009.
- Uma tarefa de código só é marcada como feita com `pnpm test:menu` em 100% para os arquivos dela
  e `pnpm test:mutation` em 100% quando ela mexe em domínio.
- `[P]` = pode andar em paralelo (arquivos diferentes, sem depender de tarefa aberta). `[USn]` =
  história da spec.
- Números dos testes: os da spec e do [quickstart](quickstart.md) (X-Burger R$ 30,00 com "+ 2 Fatia
  de queijo" a R$ 2,00 e "SEM cebola", Suco R$ 9,00, total R$ 43,00; 12 pratos em Lanches; Mesa 12;
  180 s, 30 s, 10 s; 10 min sem sinal; logo 200 px, capa 1200 px).
- Antes de começar: a 015 já está em `main`? Se não, seguir a nota do T012 sobre a origem do pedido.

## Fase 1: Ferramentas de teste

- [ ] T001 `vitest.config.mts`: a cobertura do modo `menu` (`menuCoverage`) passa a incluir `src/domain/ordering/menu-access.ts`, `src/domain/ordering/tablet-screen.ts`, `src/domain/ordering/tablet-signal.ts`, `src/domain/ordering/quick-add.ts`, `src/application/ordering/tablets.ts`, `src/application/ordering/menu-access.ts`, `src/application/ordering/menu.ts` e os componentes novos de `src/components/ordering/` listados no [plano](plan.md#estrutura) (`menu-header`, `product-row`, `product-card`, `section-bar`, `cart-panel`, `cart-bar`, `tablet-shell`, `tablet-welcome`, `still-there`, `table-tablet-card`); limite continua 100%
- [ ] T002 `stryker.config.json`: `mutate` ganha `src/domain/ordering/menu-access.ts`, `src/domain/ordering/tablet-screen.ts`, `src/domain/ordering/tablet-signal.ts`, `src/domain/ordering/quick-add.ts` (sem os `*.test.ts`); `thresholds.break` continua 100
- [ ] T003 [P] `scripts/make-test-photos.mjs`: gera uma vez, sem nada aleatório, `tests/screens/photos/logo.png` (400 × 400), `logo-pequeno.png` (150 × 150), `capa.jpg` (1920 × 640) e `capa-estreita.jpg` (1000 × 400); os arquivos entram no repositório (lição do PR #22)

## Fase 2: Base (bloqueia todas as histórias)

- [ ] T004 [P] [teste] `src/domain/access/permissions.test.ts`: `menu.appearance` só de `MANAGER`; `CHEF` tem `menu.write` e não tem `menu.appearance`; `table.manage` continua só de `MANAGER` (FR-009, R13)
- [ ] T005 [P] Ação `menu.appearance` em `src/domain/access/permissions.ts` (verde o T004)
- [ ] T006 [P] [teste] `src/domain/ordering/menu-access.test.ts` (FR-005, R1): `MenuAccessTimes` com `kind`; `isAccessOpen` do `TABLET` é verdadeiro com `endedAt` nulo em qualquer data (12 h, 400 dias depois) e falso depois de encerrado; `canSubmitWith` igual para o tablet, sem tolerância a calcular; `secondsLeft` e `shouldWarn` do tablet devolvem `null`/`false`; `ordersLimit("QR") = 10` e `ordersLimit("TABLET") = null`; os testes do `QR` da 009 continuam como estão
- [ ] T007 [P] `src/domain/ordering/menu-access.ts` por tipo, com `MenuAccessKind`, `expiresAt: Date | null` e `MenuAccessEndReason` + `RELEASED`, `LINK_ROTATED` (verde o T006)
- [ ] T008 [P] [teste] `src/domain/ordering/order.test.ts`: `ORDER_SOURCES` contém `TABLET`; `ORDER_SOURCE_LABELS.TABLET = "tablet"`; `tableWithSource("Mesa 12", "TABLET") = "Mesa 12 · tablet"` e `QR` mostra só "Mesa 12" (FR-008)
- [ ] T009 [P] `TABLET`, rótulo e `tableWithSource` em `src/domain/ordering/order.ts` (verde o T008)
- [ ] T010 [P] Códigos `TABLET_LINK_IN_USE`, `TABLET_RELEASED`, `TABLET_LINK_INVALID` em `src/domain/shared/result.ts`; [teste] em `src/components/forms/error-messages.test.ts` com os textos da tabela "Mensagens novas" do [contrato](contracts/use-cases.md#mensagens-novas), inclusive `PHOTO_TOO_SMALL` com `LOGO` ("O logo precisa ter pelo menos 200 px no lado menor.") e com `COVER` ("A foto de capa precisa ter pelo menos 1200 px de largura."); depois os textos em `src/components/forms/error-messages.ts`
- [ ] T011 [teste] `tests/integration/ordering/tablet-schema.test.ts`, conferindo cada regra de [data-model.md](data-model.md):
  - `restaurants`: `restaurants_logo_pair` e `restaurants_cover_pair` ("base e larguras nulas juntas, e pelo menos uma largura quando há imagem")
  - `dining_tables`: `tablet_token` "único, nulo até o gerente criar"; `dining_tables_tablet_token_pair` ("os dois nulos juntos")
  - `menu_accesses`: `kind` obrigatório e os acessos antigos viram `QR`; `menu_accesses_expiry_by_kind` (`QR` com 20 min, `TABLET` com `expires_at` nulo; `TABLET` com prazo e `QR` sem prazo recusados); `menu_accesses_last_seen` ("`kind = 'TABLET'` or `last_seen_at` is null"); `menu_accesses_one_tablet` (segundo `TABLET` aberto na mesma mesa recusado; aceito depois de encerrar o primeiro; aceito em outra mesa); gatilho `menu_accesses_frozen` recusa `UPDATE` de `kind`, `table_id`, `token_hash`, `opened_at` e todo `DELETE`, e aceita `ended_at`, `end_reason`, `last_seen_at`
  - `menu_access_end_reason` aceita `RELEASED` e `LINK_ROTATED`
  - `orders`: `source = 'TABLET'` com `menu_access_id` e sem `placed_by` aceito; `TABLET` sem `menu_access_id` recusado; o gatilho `orders_status_only` recusa mudar `source`
  - `app_table_by_tablet_token` acha a mesa sem restaurante na sessão e devolve nada para token desconhecido; `app_menu_access_by_token_hash` devolve `kind`
  - RLS: um restaurante não lê o tablet, o token nem a aparência de outro
- [ ] T012 Schema em `src/infra/db/schema/access.ts` (`logo_base`, `logo_widths`, `cover_base`, `cover_widths`) e `src/infra/db/schema/ordering.ts` (`menuAccessKindEnum`, `kind`, `expires_at` opcional, `last_seen_at`, `tablet_token`, `tablet_token_rotated_at`, motivos novos, `TABLET` em `order_source`) e a migração `src/infra/db/migrations/0016_table_tablets.sql` com checks, único parcial, gatilho, funções `SECURITY DEFINER` (`DROP` e `CREATE` de `app_menu_access_by_token_hash`) e `ALTER TYPE … ADD VALUE` em instruções próprias (verde o T011). **Se a 015 ainda não estiver em `main`**: a migração cria `order_source` com `QR` e `TABLET`, a coluna `orders.source` (default `QR` só durante a migração) e o check `source in ('QR','TABLET') and menu_access_id is not null`; anotar no PR que a 015 acrescenta `STAFF` e troca o check ([R7](research.md#r7-origem-do-pedido-tablet)). Acertar o número da migração com a ordem real
- [ ] T013 [P] `tests/builders/menu-data.ts` e `tests/integration/ordering/fixtures.ts`: restaurante com gerente, chef e caixa; mesas 4 e 12; X-Burger, Suco e 12 pratos em Lanches com foto; ajudantes `createTabletLink(mesa)` e `bindTablet(mesa)` que devolvem o cookie
- [ ] T014 [teste] `tests/integration/ordering/tablet-repository.test.ts`: `menuAccesses.insertTablet` grava `kind = 'TABLET'` e devolve `null` ao perder no único; `openTablet(tableId)` devolve o acesso aberto ou nulo; `touch(id, now)` grava `last_seen_at` só quando o gravado tem mais de 60 s (duas chamadas em 30 s = uma gravação); `endOpenForTable` encerra só acessos `QR` (R6); `tables.setTabletToken` soma 1 no `version`; `orders.listForTab(tabId)` traz pedidos de todas as origens, mais novo primeiro; `orders.tabStamp(tableId)` muda quando um pedido muda de situação, a conta fecha, a mesa muda de nome ou a aparência muda, numa ida ao banco
- [ ] T015 Repositórios em `src/infra/db/repositories/ordering-repository.ts` e `src/infra/db/public-ordering.ts` (`tableByTabletToken`, `menuAccessByTokenHash` com `kind`), portas em `src/application/ordering/ports.ts` e ligação em `src/application/ports.ts` e `src/infra/deps.ts` (verde o T014)

**Ponto de controle**: `pnpm test:menu` e `pnpm test:integration` verdes; esquema, domínio por tipo e
repositórios prontos; nenhuma tela mudou.

## Fase 3: US2 — Mais pratos por tela, em qualquer aparelho (P1) 🎯 MVP

**Objetivo**: linhas no celular, 3 ou 4 colunas no tablet e no computador, abas em até 2 linhas,
"+" direto.
**Teste independente**: com 12 pratos em Lanches, no celular de 390 px aparecem pelo menos 4 pratos
inteiros depois do topo; no tablet deitado, 2 linhas de 3 cartões com o carrinho ao lado.

- [ ] T016 [P] [teste] [US2] `src/domain/menu/menu-layout.test.ts` (FR-002, R10): `menuLayout` dá `list` em 320, 390 e 599; `grid3` em 600, 768, 820, 844 e 1023; `grid3side` em 1024 e 1279; `grid4side` em 1280 e 1920; `CART_COLUMN_PX = 320`; `LAYOUT_BREAKPOINTS` = 600, 1024, 1280
- [ ] T017 [P] [US2] `src/domain/menu/menu-layout.ts` (verde o T016)
- [ ] T018 [P] [teste] [US2] `src/domain/ordering/quick-add.test.ts` (US2-6, R11): Suco sem adicionais nem retiradas → `{ kind: "ADD", line }` com quantidade 1, preço R$ 9,00 e as mesmas chaves de `addToCart`; X-Burger com adicional → `{ kind: "OPEN" }`; produto só com retirada → `OPEN`
- [ ] T019 [P] [US2] `src/domain/ordering/quick-add.ts` (verde o T018)
- [ ] T020 [teste] [US2] `tests/screens/layout.spec.ts`: um teste lê os pontos de quebra declarados no `@theme` de `app/globals.css` e compara com `LAYOUT_BREAKPOINTS`
- [ ] T021 [US2] Pontos `--breakpoint-*` de 600, 1024 e 1280 no `@theme` de `app/globals.css` (verde o T020)
- [ ] T022 [P] [teste] [US2] `src/components/ordering/product-row.test.tsx` (US2-1): foto 4:3 de 112 px à esquerda com `srcset` e `loading="lazy"`; nome com `line-clamp-2` e o nome inteiro no `title` e no nome acessível; descrição em até 2 linhas; preço "R$ 30,00"; botão **+** de 44 × 44 px com nome "Pôr X-Burger no carrinho"; sem foto, o texto ocupa a linha inteira; tocar no nome ou na foto chama `onOpen`, tocar no **+** chama `onQuickAdd`
- [ ] T023 [P] [US2] `src/components/ordering/product-row.tsx` (verde o T022)
- [ ] T024 [P] [teste] [US2] `src/components/ordering/product-card.test.tsx`: cartão compacto (foto em cima, nome, até 2 linhas de descrição, preço e **+**) com as mesmas regras de toque do T022; os testes da 013 sobre o cartão grande mudam de sentido aqui, e o commit diz isso
- [ ] T025 [P] [US2] `src/components/ordering/product-card.tsx` compacto (verde o T024)
- [ ] T026 [P] [teste] [US2] `src/components/ordering/section-bar.test.tsx` (US2-5): a partir de 600 px as abas quebram em até 2 linhas; com mais seções do que cabe em 2 linhas (`ResizeObserver` falso), vira uma linha que rola, sem cortar nenhum nome; no celular, uma linha que rola; a aba da seção na tela fica marcada (`aria-current`); barra presa no topo
- [ ] T027 [P] [US2] `src/components/ordering/section-bar.tsx` (verde o T026)
- [ ] T028 [teste] [US2] `src/components/ordering/menu-app.test.tsx`: com `menuLayout` `list` usa `ProductRow`, com `grid3` usa a grade de 3 colunas, com `grid4side` a de 4; **+** do Suco põe 1 no carrinho e anuncia "Suco no carrinho. Total R$ 9,00" na região `aria-live`; **+** do X-Burger abre a tela do prato; girar (mudar a largura) não perde o carrinho nem a seção marcada
- [ ] T029 [US2] `src/components/ordering/menu-app.tsx` com o layout por largura e o "+" direto (verde o T028)
- [ ] T030 [US2] [teste] `tests/screens/matrix.ts`: `columns` sai, entra `layout` calculado por `menuLayout(width)` (`celular-*` → `list`; `celular-deitado`, `tablet-em-pe`, `tablet-grande-em-pe` → `grid3`; `tablet-deitado` → `grid3side`; `computador` → `grid4side`); `tests/screens/customer-menu.spec.ts` confere o layout de cada tamanho e o SC-001 (no `celular-iphone`, com 12 pratos, pelo menos 4 cartões inteiros entre a barra de seções e a barra do carrinho); as regras da 013 (nada rola para o lado, nada cortado, toque de 44 px, letra 200%) em todos os tamanhos, claro e escuro

**Ponto de controle**: cardápio do QR code com o layout novo; imagens de referência ainda não
refeitas (T053).

## Fase 4: US3 — Carrinho sempre à vista (P1)

**Objetivo**: carrinho em coluna ao lado na tela larga e barra no pé na estreita, com o total e
**Enviar pedido** sempre visíveis.
**Teste independente**: no tablet deitado, 1 X-Burger + 2 Fatia de queijo sem cebola e 1 Suco
mostram as duas linhas, as escolhas, o total R$ 43,00 e **Enviar pedido** sem rolar.

- [ ] T031 [P] [teste] [US3] `src/components/ordering/cart-panel.test.tsx` (US3-1, FR-003): título "Seu pedido"; por linha a quantidade, o nome, "+ 2 Fatia de queijo", "SEM cebola", o preço da linha e **−**, **+**, **Tirar**; total R$ 43,00; **Enviar pedido** no pé, fora da área que rola; vazio: "Escolha os pratos e eles aparecem aqui."; aba "Pedidos enviados" com a lista da 009
- [ ] T032 [P] [US3] `src/components/ordering/cart-panel.tsx` (verde o T031)
- [ ] T033 [P] [teste] [US3] `src/components/ordering/cart-bar.test.tsx` (US3-2): "Ver pedido · 3 itens · R$ 98,00" com plural certo ("1 item"); escondida com o carrinho vazio; tocar abre o carrinho por cima do cardápio com foco no título e fecha com Esc; a página reserva a altura da barra mais `env(safe-area-inset-bottom)`
- [ ] T034 [P] [US3] `src/components/ordering/cart-bar.tsx` (verde o T033)
- [ ] T035 [teste] [US3] `src/components/ordering/menu-app.test.tsx`: em `grid3side` e `grid4side` o `CartPanel` fica ao lado; em `list` e `grid3` a `CartBar`; pôr um prato destaca a linha por 600 ms (sem destaque com `prefers-reduced-motion`) e anuncia o total (US3-3); "Pedidos enviados" atualiza a cada 10 s como hoje (US3-4); envio, resumo, preço que mudou e produto que saiu continuam com os testes da 009 e da 010 verdes (US3-5)
- [ ] T036 [US3] `src/components/ordering/menu-app.tsx` e `src/components/ordering/cart.tsx` com as duas formas do carrinho (verde o T035)
- [ ] T037 [US3] [teste] `tests/screens/customer-menu.spec.ts`: SC-002 no `tablet-deitado` e no `computador` com 1, 8 e 20 linhas no carrinho (total e **Enviar pedido** dentro da janela sem rolar); a barra do carrinho não cobre o último cartão em nenhum tamanho `list` e `grid3`

**Ponto de controle**: cardápio do QR code completo com o carrinho novo.

## Fase 5: US1 — O cardápio mostra o logo e a foto do restaurante (P1)

**Objetivo**: o gerente põe logo e capa; o topo do cardápio mostra os dois.
**Teste independente**: o gerente envia `logo.png` e `capa.jpg`; o cardápio pelo QR no celular e
no tablet mostra a capa escurecida com o logo, o nome e "Mesa 12".

- [ ] T038 [P] [teste] [US1] `src/domain/menu/photo.test.ts` (FR-001, R8): `PHOTO_SHAPES`; `checkPhotoFile(file, "LOGO")` recusa 150 × 150 (`PHOTO_TOO_SMALL`) e aceita 200 × 200; `"COVER"` recusa 1000 px de largura e aceita 1200; `"PRODUCT"` continua com 600 no lado menor; `croppedSize(1920, 640, "COVER") = 1920 × 640`, `croppedSize(400, 300, "LOGO") = 300 × 300`; `variantWidths(384, "LOGO") = [96, 192, 384]`, `variantWidths(200, "LOGO") = [96, 192]`, `variantWidths(1500, "COVER") = [600, 1200]`; os testes da 013 sem formato viram `"PRODUCT"` e continuam passando
- [ ] T039 [P] [US1] `src/domain/menu/photo.ts` com formatos (verde o T038)
- [ ] T040 [P] [teste] [US1] `src/domain/menu/cover-overlay.test.ts` (US1-3, R9): `coverTextContrast()` com fundo branco e a opacidade da linha do texto dá pelo menos 4,5:1 (usa `src/lib/contrast.ts`); baixar a opacidade de baixo para 0,3 faz o teste falhar (o teste prova a regra)
- [ ] T041 [P] [US1] `src/domain/menu/cover-overlay.ts` (verde o T040)
- [ ] T042 [teste] [US1] `src/infra/photos/storage.test.ts` e um teste do processador: `sharpProcessor.process(bytes, "LOGO")` com `logo.png` grava 96, 192 e 384 em 1:1; `"COVER"` com `capa.jpg` grava 600, 1200 e 1920 em 3:1; `logo-pequeno.png` dá `PHOTO_TOO_SMALL`; `"PRODUCT"` continua 4:3
- [ ] T043 [US1] `src/infra/photos/sharp-processor.ts` e `PhotoProcessor` em `src/application/menu/ports.ts` com o formato; `setProductPhoto` passa `"PRODUCT"` (verde o T042)
- [ ] T044 [teste] [US1] `tests/integration/menu/appearance.test.ts` (contrato "Aparência do restaurante"): `setAppearanceImage` do gerente grava logo e capa, soma 1 em `restaurants.version`, grava `audit_log` `entity = restaurant` com as bases; trocar apaga os arquivos antigos só depois do commit; falha do banco apaga os novos; `removeAppearanceImage` sem imagem → `NO_CHANGE`; chef → `FORBIDDEN` com `DENIED`; `getAppearance` funciona para gerente e chef
- [ ] T045 [US1] `src/application/menu/appearance.ts`, repositório `appearance` em `src/infra/db/repositories/menu-repository.ts` e o parâmetro `kind` em `app/api/cardapio/foto/route.ts` (verde o T044)
- [ ] T046 [teste] [US1] `tests/integration/ordering/menu.test.ts`: `getMenu` devolve `appearance` com logo e capa; `getMenuPreview` também
- [ ] T047 [US1] `appearance` em `getMenu` (`src/application/ordering/menu.ts`) e `getMenuPreview` (`src/application/menu/preview.ts`), lida na mesma ida ao banco das configurações (verde o T046)
- [ ] T048 [P] [teste] [US1] `src/components/ordering/menu-header.test.tsx` (US1-2 a US1-5): com capa, `<img>` da capa com `srcset` e a camada escura; logo quadrado com cantos arredondados; nome do restaurante e "Mesa 12" em branco; altura 120 px em `list` e 160 px nos outros; ao rolar sai e fica a barra de seções; sem capa usa `--primary`; sem logo só o nome
- [ ] T049 [P] [US1] `src/components/ordering/menu-header.tsx` e uso em `menu-app.tsx` (verde o T048)
- [ ] T050 [P] [teste] [US1] `src/components/menu/appearance-form.test.tsx` (US1-1, US1-2, US1-6): quadro **Aparência** só com `menu.appearance`; escolher arquivo mostra o recorte 1:1 do logo e 3:1 da capa antes de salvar; arquivo pequeno mostra a mensagem do T010 sem enviar; **Trocar**; **Tirar** pede confirmação; usa `reduce-photo.ts` da 013
- [ ] T051 [P] [US1] `src/components/menu/appearance-form.tsx`, ações `src/actions/appearance.ts` e o quadro em `app/(app)/pedidos/cardapio/page.tsx` (verde o T050)
- [ ] T052 [US1] [teste] `tests/screens/appearance.spec.ts` e `customer-menu.spec.ts`: topo com capa e logo nos 9 tamanhos, claro e escuro; quadro **Aparência** nos tamanhos da equipe; contraste do texto do topo medido na tela com a `capa.jpg` (≥ 4,5:1)
- [ ] T053 [US1] Refazer as imagens de referência do cardápio do cliente (`pnpm build && pnpm test:screens:update` no contêiner do Playwright), com as fotos fixas do T003; o commit lista os tamanhos e diz que o motivo é o layout novo (FR-012)

**Ponto de controle**: cardápio novo completo para o QR code; dá para entrar em produção sem o
tablet.

## Fase 6: US4 — Ligar um tablet fixo na mesa (P1)

**Objetivo**: link do tablet por mesa, um aparelho por link, **Liberar**, **Trocar link**, sinal de
vida, origem "tablet".
**Teste independente**: na Mesa 12, **Tablet da mesa** → **Criar link**, abrir no tablet, ver o
cardápio sem "Faltam N min"; 3 horas depois um pedido cai na conta da Mesa 12.

- [ ] T054 [P] [teste] [US4] `src/domain/ordering/tablet-signal.test.ts` (US4-8): `tabletSignal(null, now)` = `NEVER`; visto há 2 min = `SEEN` com 2; há 10 min = `LOST` com 10; há 25 min = `LOST` com 25; `HEARTBEAT_SECONDS = 60`
- [ ] T055 [P] [US4] `src/domain/ordering/tablet-signal.ts` (verde o T054)
- [ ] T056 [teste] [US4] `tests/integration/ordering/tablet-link.test.ts` (contrato "Tablet da mesa — equipe"): `createTabletLink` grava token de 43 caracteres base64url diferente do `qr_token` e auditoria `link_created`; de novo → `NO_CHANGE`; `version` velho → `STALE_RECORD`; `releaseTablet` encerra o acesso com `RELEASED` e auditoria `released`, sem tablet → `NO_CHANGE`; `rotateTabletLink` troca o token e encerra o acesso com `LINK_ROTATED` na mesma transação; `listTabletStatus` devolve link, ligado desde, `lastSeenAt` e o total de ligados em uma consulta (conta as idas ao banco com 1 e com 60 mesas); chef e caixa → `FORBIDDEN` com `DENIED`
- [ ] T057 [US4] `src/application/ordering/tablets.ts` (verde o T056)
- [ ] T058 [teste] [US4] `tests/integration/ordering/tablet-bind.test.ts` (rota `GET /t/{token}`, R2, R3): token desconhecido → 404 "Link inválido. Chame um garçom."; primeiro aparelho → 303 para `/cardapio` com `Set-Cookie: menu_tablet=…; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax` (com `Secure` só em HTTPS) e auditoria `bound` sem `user_id`, com IP e navegador; o mesmo aparelho de novo → 303 com o mesmo token; outro aparelho → 200 "Este link já está ligado em outro tablet. Peça ao gerente para liberar."; **dois aparelhos ao mesmo tempo** (20 rodadas em paralelo) → sempre um liga e o outro recebe a mensagem; depois de **Liberar**, o próximo aparelho liga; depois de **Trocar link**, o link antigo → "Link inválido. Chame um garçom."; mesa inativa e chave desligada ligam assim mesmo; cabeçalhos `no-store` e `no-referrer`
- [ ] T059 [US4] `bindTablet` em `src/application/ordering/menu-access.ts`, `src/actions/_tablet.ts` e `app/t/[token]/route.ts` (verde o T058)
- [ ] T060 [teste] [US4] `tests/integration/ordering/tablet-menu.test.ts` (FR-005, FR-011): com o cookie do tablet, `getMenu` devolve `mode: "TABLET"`, `expiresAt` e `ordersLeft` nulos, 400 dias depois ainda abre; com os dois cookies usa o do tablet; acesso `RELEASED` → `TABLET_RELEASED`; `LINK_ROTATED` → `TABLET_LINK_INVALID`; mesa inativa → `TABLE_INACTIVE`; chave desligada → `ORDERING_PAUSED`; ler um QR code no navegador do tablet não encerra o acesso do tablet; nenhum dado de outra mesa ou restaurante
- [ ] T061 [US4] `accessFromCookie` com os dois cookies, `getMenu` por modo e `app/(cardapio)/cardapio/page.tsx` lendo `menu_tablet` (verde o T060)
- [ ] T062 [teste] [US4] `tests/integration/ordering/tablet-submit.test.ts`: `submitOrder` pelo tablet grava `source = 'TABLET'` e entra na conta da Mesa 12; 11 pedidos seguidos passam (sem o limite de 10 do QR code); toque duplo com o mesmo `clientRequestId` devolve o mesmo pedido; **fechar a conta não encerra o acesso do tablet** (o teste da 011 que espera "todos os acessos encerrados" passa a dizer "todos os acessos `QR`", e o commit diz isso); pedido do tablet × `closeTab` em corrida (20 rodadas): o pedido cai na conta que fechou antes do fechamento ou numa conta nova, nunca fora de conta; 3 horas depois (relógio falso) o pedido ainda entra
- [ ] T063 [US4] `submitOrder` por tipo em `src/application/ordering/submit-order.ts` e `closeTab` em `src/application/billing/tabs.ts` (verde o T062)
- [ ] T064 [teste] [US4] `tests/integration/ordering/tablet-status.test.ts` (rota `GET /api/cardapio/tablet`, R5): sem cookie → 401 `UNKNOWN`; ligado → `OK` com `tableName`, `tabId` e `stamp`; o `stamp` muda quando a mesa muda de nome, a conta abre ou fecha, um pedido muda de situação, a aparência muda, e não muda sem nada disso; `RELEASED` e `LINK_ROTATED`; grava `last_seen_at` no máximo uma vez por minuto; `Cache-Control: no-store`
- [ ] T065 [US4] `tabletStatus` em `src/application/ordering/menu-access.ts` e `app/api/cardapio/tablet/route.ts` (verde o T064)
- [ ] T066 [teste] [US4] Telas da equipe que mostram a mesa: `kitchen-board.test.tsx`, `ready-list.test.tsx`, a conta da mesa e a consulta de pedidos mostram "Mesa 12 · tablet" no pedido do tablet; o filtro "Origem" da consulta ganha "Tablet" e filtra (FR-008)
- [ ] T067 [US4] `tableWithSource` nas telas da cozinha, do garçom, da conta e da consulta, e o filtro (verde o T066)
- [ ] T068 [P] [teste] [US4] `src/components/ordering/table-tablet-card.test.tsx` (US4-1, US4-3, US4-4, US4-8): sem link, **Criar link do tablet**; com link, o link, **Copiar** ("Link copiado"), o QR code do link e "Nenhum tablet ligado"; ligado, "Tablet ligado desde 16/11 20:05 · visto há 2 min"; acima de 10 min, "Sem sinal há 25 min" em destaque; **Liberar** e **Trocar link** pedem confirmação; ajuda "Como travar o tablet" com Android "Fixar app", iPad "Acesso Guiado", abrir no navegador (não pela Tela de Início) e "Bloqueio automático: Nunca"
- [ ] T069 [P] [US4] `src/components/ordering/table-tablet-card.tsx` (verde o T068)
- [ ] T070 [US4] Ações `createTabletLinkAction`, `releaseTabletAction`, `rotateTabletLinkAction` em `src/actions/tables.ts`; **Tablet da mesa** em cada cartão e "4 mesas com tablet ligado" no topo de `app/(app)/pedidos/mesas/page.tsx`, lendo `listTabletStatus` junto com a lista de mesas num `Promise.all`
- [ ] T071 [US4] [teste] `tests/integration/audit/tablet-audit.test.ts` (FR-010, R14): depois de criar link, ligar, liberar e trocar link, nenhuma linha do `audit_log` contém o token antigo nem o novo (busca pelo texto em `changes` e `origin`)

**Ponto de controle**: o tablet liga, pede sem prazo e aparece na tela Mesas; ainda não volta
sozinho às boas-vindas.

## Fase 7: US5 — O tablet fica pronto para o próximo cliente (P1)

**Objetivo**: boas-vindas, limpeza sozinho, só a conta aberta, tela acesa, sem internet.
**Teste independente**: 2 pratos no carrinho e 3 min parado → "Ainda está aí?" e, 30 s depois, as
boas-vindas vazias; fechar a conta da Mesa 12 → boas-vindas sem os pedidos anteriores.

- [ ] T072 [P] [teste] [US5] `src/domain/ordering/tablet-screen.test.ts` (FR-006, R4), com os segundos da spec: `open` → `WELCOME`; `touch` em **Ver o cardápio** → `MENU`; 179 s sem toque continua `MENU`, 180 s com carrinho vazio → `WELCOME`, com carrinho → `STILL_THERE`; em `STILL_THERE`, `touch` → `MENU` com o carrinho, 30 s → `WELCOME` com `clearCart`; `sent` → `SENT`, 10 s ou `touch` → `MENU` com `clearCart`; `tabChanged` em qualquer estado → `WELCOME` com `clearCart`; o tempo conta do último toque, não do último `tick`
- [ ] T073 [P] [US5] `src/domain/ordering/tablet-screen.ts` (verde o T072)
- [ ] T074 [teste] [US5] `tests/integration/ordering/tablet-orders.test.ts` (FR-007): `listAccessOrders` do tablet traz os pedidos da conta aberta da mesa de qualquer origem (QR code, tablet, equipe); sem conta aberta, vazio; depois de fechar a conta, nada da conta fechada; o celular do QR code continua vendo só os seus
- [ ] T075 [US5] `listAccessOrders` por modo em `src/application/ordering/menu.ts` (verde o T074)
- [ ] T076 [P] [teste] [US5] `src/components/ordering/tablet-welcome.test.tsx` (US5-1): capa e logo em tela cheia, "Mesa 12" e o botão grande **Ver o cardápio**; sem capa e sem logo, a cor principal e o nome
- [ ] T077 [P] [US5] `src/components/ordering/tablet-welcome.tsx` (verde o T076)
- [ ] T078 [P] [teste] [US5] `src/components/ordering/still-there.test.tsx` (US5-2): diálogo "Ainda está aí? Seu pedido não foi enviado." com **Continuar** em foco e a contagem dos 30 s anunciada só no começo (sem anunciar cada segundo)
- [ ] T079 [P] [US5] `src/components/ordering/still-there.tsx` (verde o T078)
- [ ] T080 [teste] [US5] `src/components/ordering/tablet-shell.test.tsx`, com o relógio falso do Vitest e `fetch` falso: liga a máquina do T073 a `pointerdown` e `keydown`; "Pedido enviado para a cozinha" por 10 s depois do envio (US5-3); chama `/api/cardapio/tablet` a cada 10 s fora das boas-vindas e a cada 60 s nelas; `stamp` novo chama `router.refresh()`; `tabId` novo volta às boas-vindas e limpa o carrinho (SC-005); `state` `TABLE_INACTIVE` mostra "Esta mesa não está recebendo pedidos. Chame um garçom." e volta sozinho com `OK`; `RELEASED` mostra "Este tablet foi desligado. Peça ao gerente."; `LINK_ROTATED` mostra "Link inválido. Chame um garçom."; duas falhas seguidas ou `offline` mostram "Sem conexão com o restaurante. Chame um garçom." por cima, sem limpar o carrinho, e o primeiro sucesso tira (US5-6); pede `navigator.wakeLock.request("screen")` ao entrar no cardápio e de novo em `visibilitychange`, e não quebra sem a API; **Tela cheia** só com `document.fullscreenEnabled` (US5-5); o carrinho não vai para `localStorage` (US5-7)
- [ ] T081 [US5] `src/components/ordering/tablet-shell.tsx` e o modo tablet em `menu-app.tsx` (sem "Faltam N min" nem o aviso dos 10 pedidos) (verde o T080)
- [ ] T082 [P] [teste] [US5] `src/components/menu/preview-frame.test.tsx`: a pré-visualização ganha a escolha "Celular pelo QR code" / "Tablet da mesa"; no tablet mostra as boas-vindas e o cardápio sem prazo, sem enviar nada
- [ ] T083 [P] [US5] `preview-frame.tsx`, `getMenuPreview` com `mode` e `app/(app)/pedidos/cardapio/ver/page.tsx` (verde o T082)
- [ ] T084 [US5] [teste] `tests/screens/tablet.spec.ts`: boas-vindas, cardápio do tablet com o carrinho ao lado, "Ainda está aí?" e "Sem conexão" nos tamanhos `tablet-*` e `computador`, e o **Tablet da mesa** da equipe nos tamanhos da equipe, claro e escuro, Chromium e WebKit; imagens de referência novas a partir do build de produção (SC-006)

**Ponto de controle**: o roteiro do quickstart passa à mão do passo 1 ao 24.

## Fase 8: Ponta a ponta e documentação

- [ ] T085 [teste] `tests/e2e/tablet.spec.ts`: o roteiro do [quickstart](quickstart.md) com dois contextos do navegador (tablet e "outro aparelho"), `page.clock` para os 3 min, os 30 s, os 10 s e os 10 min sem sinal; SC-003 (ligar em menos de 1 min a partir de **Criar link**); SC-004 (relógio adiantado 12 h em passos de 10 min, a checagem roda em cada passo, e um pedido enviado no fim entra na conta)
- [ ] T086 [P] [teste] `tests/e2e/accessibility.spec.ts`: axe sem violação no cardápio novo (celular e tablet deitado), boas-vindas, "Ainda está aí?", **Tablet da mesa** e quadro **Aparência**
- [ ] T087 [P] [teste] `tests/integration/performance/indexes.test.ts` e `tests/integration/performance/tablet-status.test.ts`: a checagem do tablet e o `listTabletStatus` usam índice; 60 tablets checando ao mesmo tempo respondem em menos de 200 ms cada no banco do teste, com no máximo 1 gravação de sinal de vida por tablet por minuto
- [ ] T088 [P] Docs de produto: `docs/produto/pedidos/02-cardapio-do-cliente.md` (layout, carrinho, topo, "+" direto), `01-mesas-e-qr-code.md` (link do tablet), `06-editar-o-cardapio.md` (Aparência), `05-conta-da-mesa.md` (fechar a conta não desliga o tablet), `09-tablet-da-mesa.md` (novo: ligar, liberar, trocar, boas-vindas, travar o aparelho), `00-visao-geral.md` e `docs/produto/estoque/09-controles-e-permissoes.md` (`menu.appearance`, `table.manage` cobre o tablet)
- [ ] T089 [P] Docs de sistema: `docs/sistema/pedidos/01-modelo-de-dados.md`, `02-regras.md`, `03-rota-publica.md` (`/t/{token}`, `/api/cardapio/tablet`, cookie `menu_tablet`), `04-plano-de-testes.md`, `docs/sistema/05-testes-de-tela.md` (layouts e telas novas), `04-desempenho.md` (checagem do tablet); linha 016 do roadmap em `docs/produto/estoque/00-visao-geral.md` vira "Feito"
- [ ] T090 Conferência final: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:menu`, `pnpm test:mutation`, `pnpm test:e2e --trace off`, `pnpm build && pnpm test:screens`; a descrição do PR lista as imagens de referência refeitas, com antes e depois, e avisa a ordem das migrações (T012)

## Dependências

```text
Fase 1 ──► Fase 2 ──► US2 ──► US3 ──► US1 ──► US4 ──► US5 ──► Fase 8
                     (US3 usa o layout da US2; US1 entra depois para as imagens de referência
                      serem refeitas uma vez, no T053; US4 usa o cardápio novo; US5 precisa do
                      tablet ligado da US4)
```

- US1 não depende da US2 nem da US3 no código (topo e aparência são à parte); só a ordem das
  imagens de referência pede US2 → US3 → US1.
- US4 é a única que toca o código da 011 (T063) e das telas da 009 e 015 (T067).
- Dentro de cada história: teste de domínio → domínio → teste de integração → caso de uso →
  teste de componente → componente → ação e página → teste de tela.

## Paralelo

- Fase 2: T004–T005, T006–T007, T008–T009, T010 e T013 andam juntas; T011–T012 e T014–T015 em
  série.
- US2: T016–T017, T018–T019, T022–T023, T024–T025 e T026–T027 juntas; T028–T029 depois.
- US3: T031–T032 e T033–T034 juntas.
- US1: T038–T039, T040–T041, T048–T049 e T050–T051 juntas, enquanto T042–T047 seguem em série.
- US4: T054–T055 e T068–T069 em paralelo com T056–T065.
- US5: T072–T073, T076–T077, T078–T079 e T082–T083 juntas; T080–T081 depois.
- Fase 8: T086, T087, T088 e T089 juntas.

## Estratégia

1. **MVP**: Fases 1 e 2 + US2 + US3 + US1. É o visual da imagem do dono para todo cliente do QR
   code, e já pode entrar em produção (a migração cria as colunas do tablet sem usar).
2. **Tablet**: US4 + US5 juntas. Sem a US5 o tablet mostraria o pedido do cliente anterior, então
   as duas entram no mesmo deploy.
3. Cada fase fecha com `pnpm test:menu` verde e um commit por par vermelho → verde.
