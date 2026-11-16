# Plano técnico: 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

**Branch**: `claude/project-thread-vfeeqt` | **Data**: 2026-11-16 | **Spec**: [spec.md](spec.md)

## Resumo

O cardápio do cliente ganha o **topo com a capa e o logo** do restaurante, **mais pratos por tela**
(linhas no celular, 3 ou 4 colunas no tablet e no computador) e o **carrinho sempre à vista** (ao
lado na tela larga, barra no pé na estreita). A mesa ganha um **link de tablet** que liga um
aparelho de uma vez, sem prazo nem limite de pedidos, e o tablet **volta sozinho às boas-vindas**
quando fica parado, depois de enviar e quando a conta fecha.

O tablet é um acesso ao cardápio da 009 de outro tipo (`kind = 'TABLET'`, sem `expires_at`), então
o envio, o "sem pedido em dobro", a conta da 011 e a RLS são os mesmos. Um único parcial garante um
aparelho por mesa. O tablet pergunta ao servidor a cada 10 s se algo mudou (mesa, conta, pedidos,
aparência) e só então recarrega; a mesma pergunta é o sinal de vida da tela Mesas. Logo e capa são
fotos da 013 com outro recorte. Nenhuma tabela nova, nenhuma dependência nova.

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19, Tailwind 4 |
| Dependências novas | Nenhuma (`sharp` da 013 trata logo e capa; `src/infra/qr.ts` da 009 gera o QR do link) |
| Banco | PostgreSQL 17 (Neon); migração `0016_table_tablets` (depois da `0014` e da `0015`; ver Riscos) |
| Testes | Vitest (unidade, componentes e integração com PostgreSQL em container), Playwright (ponta a ponta com `page.clock` e matriz de telas da 013) |
| Plataforma | Vercel; cliente no celular (QR) ou num tablet Android ou iPad fixo na mesa, só navegador; gerente no computador ou tablet |
| Desempenho | Pelo menos 4 pratos inteiros no celular de 390 px (SC-001); total e **Enviar pedido** sem rolar no tablet deitado (SC-002); tablet sai da conta fechada em ≤ 10 s (SC-005); checagem do tablet em 1 transação curta, no máximo 1 gravação de sinal de vida por minuto por tablet; tela Mesas sem crescer em idas ao banco com o número de mesas |
| Restrições | Dinheiro em decimal exato; pedido só inserção; um aparelho por mesa garantido pelo banco; o código do link nunca na auditoria; nada cruza restaurantes nem mesas; regras de tela da 013 em todas as telas novas |
| Escala | Até ~60 mesas com tablet por restaurante; um tablet por mesa |

Nenhum ponto em aberto: as premissas da spec (tabela Decisões) cobrem as escolhas de negócio, o
FR-009 é decidido no [R13](research.md#r13-permissões) e [research.md](research.md) resolve as
escolhas técnicas.

## Constituição

| Princípio | Como a 016 cumpre |
|---|---|
| I. Testes primeiro | Commit `test(016): … (vermelho)` antes de cada `feat(016)` em todas as camadas ([R16](research.md#r16-testes-primeiro-em-que-camada)); herda as regras TDD-001 a TDD-010 da 013 (FR-013). Testes nomeados por FR-001 a FR-012 e pelos casos-limite (dois aparelhos abrindo o link juntos, envio × fechamento da conta, mesa inativada com tablet ligado, cookie apagado, link copiado em outro aparelho) |
| II. Domínio puro | `tablet-screen.ts` (estados e tempos), `tablet-signal.ts`, `menu-access.ts` por tipo, `photo.ts` por formato, `menu-layout.ts`, `quick-add.ts`, `cover-overlay.ts`. Relógio por parâmetro; o componente só liga os eventos do navegador |
| III. Livro imutável | Nada de estoque muda. Pedido, linha e evento continuam só inserção; a origem `TABLET` entra no `INSERT` e o gatilho da 015 protege. `menu_accesses` ganha gatilho: só `ended_at`, `end_reason` e `last_seen_at` mudam; liberar e trocar link **encerram** o acesso, nunca apagam |
| IV. Precisão | O carrinho ao lado usa as mesmas funções `Decimal` da 009 e 010 (`lineTotal`, `cartTotal`); o envio confere preço no servidor como hoje. Nenhuma conta nova de dinheiro |
| V. Rastreabilidade | Auditoria de logo, capa, criar link, ligar (com IP e navegador), liberar e trocar link ([R14](research.md#r14-auditoria)); motivo de fim do acesso (`RELEASED`, `LINK_ROTATED`); origem do pedido. Teste varre o `audit_log` atrás do token. RLS herdada; a rota pública só acha a mesa por funções `SECURITY DEFINER` estreitas, como a 009 |
| VI. Docs vivas | Neste PR: plano, pesquisa, modelo, contratos, quickstart, glossário e roadmap. No PR da implementação: `docs/produto/pedidos/02-cardapio-do-cliente.md` (layout, carrinho, topo), `01-mesas-e-qr-code.md` (tablet da mesa), `06-editar-o-cardapio.md` (Aparência), `05-conta-da-mesa.md` (fechar a conta não desliga o tablet), `docs/produto/pedidos/09-tablet-da-mesa.md` (novo), `docs/produto/estoque/09-controles-e-permissoes.md` (`menu.appearance`), `docs/sistema/pedidos/01-modelo-de-dados.md`, `02-regras.md`, `03-rota-publica.md` (`/t/{token}`, `/api/cardapio/tablet`, cookie), `04-plano-de-testes.md`, `docs/sistema/05-testes-de-tela.md` (layouts novos), `04-desempenho.md` (checagem do tablet) |
| VII. Simplicidade | Sem tabela nova: o tablet é um acesso de outro tipo. Sem WebSocket nem service worker: uma checagem curta a cada 10 s. Sem app nem PWA. Carrinho do tablet só na memória da página. Mesma loja e mesmo processador de fotos da 013 |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1 Tablet = acesso que não vence**: `menu_accesses.kind` (`QR`, `TABLET`), `expires_at` nulo
  no tablet, regras por tipo no domínio, sem limite de 10 pedidos.
- **R2 Link e aparelho ligado**: `dining_tables.tablet_token` em texto (o gerente vê e copia),
  `/t/{token}`; um acesso `TABLET` aberto por mesa garantido por único parcial; **Liberar** e
  **Trocar link** encerram o acesso com motivo próprio.
- **R3 Cookie do tablet**: `menu_tablet`, `HttpOnly`, 400 dias, regravado a cada abertura; separado
  do cookie do QR code para uma leitura de QR no tablet não desligar o tablet.
- **R4 Boas-vindas e limpeza**: máquina de estados pura (`WELCOME`, `MENU`, `STILL_THERE`,
  `SENT`) com 180 s, 30 s e 10 s; carrinho só na memória.
- **R5 Checagem do tablet**: `GET /api/cardapio/tablet` com `stamp`; recarrega só quando muda; 10 s
  em uso, 60 s nas boas-vindas; grava `last_seen_at` no máximo 1 vez por minuto.
- **R6 Conta fechada**: fechar a conta encerra só acessos `QR`; o tablet mostra os pedidos da conta
  aberta da mesa, de qualquer origem.
- **R7 Origem**: `order_source` ganha `TABLET`; "Mesa 12 · tablet" na cozinha e na consulta.
- **R8 Logo e capa**: colunas em `restaurants`; processador com formato (`PRODUCT` 4:3, `LOGO` 1:1,
  `COVER` 3:1) e larguras próprias.
- **R9 Contraste**: degradê preto de 45% a 70% sob o texto, conferido contra fundo branco.
- **R10 Layout**: `list`, `grid3`, `grid3side`, `grid4side` por largura da janela; carrinho em
  coluna `sticky` de 320 px ou barra `fixed` com espaço reservado; abas em até 2 linhas.
- **R11 "+" direto** para produto sem adicionais nem retiradas, com aviso para leitor de tela.
- **R12 Tela acesa, tela cheia, sem internet**: Wake Lock e Fullscreen onde existem; aviso por cima
  sem perder o carrinho; nada guardado para enviar depois.
- **R13 Permissões**: tablet em `table.manage` (gerente); logo e capa em `menu.appearance` (nova,
  gerente).
- **R15 Telas**: matriz troca `columns` por `layout`; telas novas na matriz; imagens de referência
  do cardápio da 013 refeitas.

## Modelo de dados (migração `0016_table_tablets`)

Resumo; detalhe em [data-model.md](data-model.md).

```text
restaurants      + logo_base, logo_widths, cover_base, cover_widths   (pares com check)
dining_tables    + tablet_token (único, nulo até criar), tablet_token_rotated_at
menu_accesses    + kind (QR, TABLET), last_seen_at; expires_at nulo só no TABLET;
                 único (table_id) where kind = 'TABLET' and ended_at is null;
                 gatilho: só ended_at, end_reason e last_seen_at mudam
menu_access_end_reason + RELEASED, LINK_ROTATED
order_source           + TABLET   (check orders_source_shape da 015 ganha o ramo)
funções públicas       app_table_by_tablet_token; app_menu_access_by_token_hash + kind
```

## Casos de uso

Contrato completo em [contracts/use-cases.md](contracts/use-cases.md).

- Novos: `getAppearance`, `setAppearanceImage`, `removeAppearanceImage`; `listTabletStatus`,
  `createTabletLink`, `releaseTablet`, `rotateTabletLink`; `bindTablet` (rota `/t/{token}`);
  `tabletStatus` (rota `/api/cardapio/tablet`).
- Mudam: `openMenuAccess`, `accessFromCookie`, `getMenu`, `listAccessOrders`, `submitOrder` (009);
  `closeTab` (011); `getMenuPreview`, `setProductPhoto` (013); telas que mostram a origem (009, 011,
  015).

## Estrutura

```text
src/domain/ordering/            menu-access.ts (por tipo), tablet-screen.ts, tablet-signal.ts,
                                quick-add.ts, order.ts (+ TABLET), *.test.ts
src/domain/menu/                photo.ts (formatos), menu-layout.ts, cover-overlay.ts, *.test.ts
src/domain/access/              permissions.ts (+ menu.appearance)
src/application/menu/           appearance.ts, photo.ts (formato), preview.ts (modo), ports.ts
src/application/ordering/       tablets.ts, menu-access.ts (bindTablet, tabletStatus), menu.ts,
                                submit-order.ts, ports.ts
src/application/billing/        tabs.ts (closeTab só encerra QR)
src/infra/photos/               sharp-processor.ts (formato)
src/infra/db/                   schema/access.ts, schema/ordering.ts,
                                migrations/0016_table_tablets.sql, public-ordering.ts,
                                repositories/ordering-repository.ts, menu-repository.ts
src/actions/                    appearance.ts, tables.ts, _tablet.ts (rota pública)
src/components/ordering/        menu-header.tsx, product-row.tsx, product-card.tsx (compacto),
                                section-bar.tsx (2 linhas), cart-panel.tsx, cart-bar.tsx,
                                menu-app.tsx (layout), tablet-shell.tsx, tablet-welcome.tsx,
                                still-there.tsx, table-tablet-card.tsx, *.test.tsx
src/components/menu/            appearance-form.tsx, preview-frame.tsx (modo), *.test.tsx
app/t/[token]/                  route.ts
app/api/cardapio/tablet/        route.ts
app/api/cardapio/foto/          route.ts (+ kind)
app/(cardapio)/cardapio/        page.tsx (dois cookies, modo)
app/(app)/pedidos/              cardapio/page.tsx (Aparência), cardapio/ver/page.tsx (modo),
                                mesas/page.tsx (Tablet da mesa)
tests/integration/ordering/     tablet: um por mesa (corrida), ligar, liberar, trocar link, fechar
                                conta não desliga, envio × fechamento, sem limite de pedidos, origem,
                                sinal de vida a cada 60 s, token fora da auditoria, isolamento
tests/integration/menu/         aparência (formatos, permissões, arquivos antigos apagados)
tests/screens/                  matrix.ts (layout), customer-menu.spec.ts, tablet.spec.ts,
                                appearance.spec.ts, photos/ (logo e capa fixos), __screenshots__/
tests/e2e/                      tablet.spec.ts (roteiro do quickstart, page.clock, SC-004),
                                accessibility (cardápio novo, boas-vindas, Tablet da mesa, Aparência)
```

## Ordem de entrega (vira `tasks.md`)

1. Domínio: acesso por tipo, máquina do tablet, sinal de vida, formatos de foto, layout por largura,
   "+" direto, contraste da capa, permissão nova. Cada função nasce de um teste vermelho com os
   números da spec.
2. Migração, schema, funções públicas, gatilho e repositórios, com testes de integração (um tablet
   por mesa, gatilho, origem `TABLET`, isolamento).
3. US2 Mais pratos por tela → US3 Carrinho sempre à vista (o cardápio de todo mundo muda primeiro e
   as imagens de referência são refeitas uma vez) → US1 Logo e capa → US4 Ligar o tablet → US5
   Pronto para o próximo cliente.
4. Docs (produto, sistema, permissões, rota pública, testes de tela, desempenho) e e2e com axe.

## Riscos

- **Ordem 014 → 015 → 016**: a 016 usa a origem do pedido da 015. Se a 016 for implementada antes,
  a `0016` cria o enum com `QR` e `TABLET` e a coluna `source`, e a 015 acrescenta `STAFF` depois
  ([R7](research.md#r7-origem-do-pedido-tablet)); os números das migrações são acertados no PR da
  implementação.
- **Imagens de referência da 013 refeitas**: toda a matriz do cardápio do cliente muda de uma vez.
  O PR da implementação mostra as imagens antigas e novas lado a lado, por tamanho, para o dono
  conferir.
- **Tablet perde o cookie** (limpeza do navegador, atualização do sistema): o tablet vira "link em
  uso" e precisa de **Liberar**. A tela Mesas mostra "Sem sinal há N min", então o gerente percebe;
  a ajuda da tela explica.
- **Navegador que mata a aba parada**: Android economiza bateria fechando abas em segundo plano. Com
  o tablet na tomada, a aba em primeiro plano e a tela acesa (Wake Lock), isso não acontece; a
  ajuda pede "Fixar app" e o carregador ligado. Se acontecer, reabrir o link volta para a mesma
  mesa (o cookie continua).
- **60 tablets checando a cada 10 s**: 6 requisições curtas por segundo no pico, sem gravação na
  maioria. O teste de desempenho mede a checagem com 60 tablets e o `scripts/perf` confirma antes do
  merge.
