# Contratos: 013 — matriz de telas e testes de tela

Este contrato é o que os testes de `tests/screens/` verificam. Ele vale para o plano, as tarefas e
a implementação (spec, TDD-003 a TDD-005).

## Matriz (`tests/screens/matrix.ts`)

| `name` | `width` × `height` | Cliente | Equipe | Colunas do cardápio |
|---|---|---|---|---|
| `celular-pequeno` | 320 × 568 | sim | sim | 1 |
| `celular-android` | 360 × 800 | sim | sim | 1 |
| `celular-iphone` | 390 × 844 | sim | sim | 1 |
| `celular-grande` | 430 × 932 | sim | – | 1 |
| `celular-deitado` | 844 × 390 | sim | – | 2 |
| `tablet-em-pe` | 768 × 1024 | sim | sim | 2 |
| `tablet-grande-em-pe` | 820 × 1180 | sim | – | 2 |
| `tablet-deitado` | 1024 × 768 | sim | sim | 3 |
| `computador` | 1280 × 800 | sim | sim | 3 |

Projetos do Playwright: `telas-chromium` e `telas-webkit`. Modos de cor: `light` e `dark`. Tamanho
novo com problema entra aqui antes da correção (TDD-010).

## Dados fixos (`tests/screens/fixtures.ts`)

Um restaurante com as seções "Entradas", "Lanches" e "Bebidas" e produtos em "Outros", contendo
pelo menos: produto com foto, produto sem foto, produto com nome de 70 caracteres, produto com
descrição de 300 caracteres, produto com adicionais e retiradas, 8 seções para o teste da barra que
rola, e um conjunto de 40 produtos com foto para o teste de peso.

## Asserções de layout (`tests/screens/layout.ts`)

Cada uma tem, em `tests/screens/layout.spec.ts`, uma página quebrada de propósito em que ela é
obrigada a falhar.

| Asserção | Passa quando | Cenário |
|---|---|---|
| `expectNoSideScroll(page)` | `scrollWidth` do documento ≤ largura da tela | US6.6 |
| `expectNoClippedText(scope)` | Nenhum texto marcado sai da caixa do pai nem é cortado, fora a descrição do cartão (3 linhas com "…") | US6.4 |
| `expectTapTargets(scope)` | Todo botão, link e campo visível tem ≥ 44 × 44 px e as caixas não se sobrepõem | US6.5 |
| `expectPhotoRatio(scope)` | Toda foto é desenhada em 4:3 (±1 px), com `object-fit: cover`, e tem `alt` | US6.3 |
| `expectNoBrokenImage(scope)` | Nenhuma `<img>` com largura natural 0; produto sem foto não tem `<img>` nem espaço reservado | US6.3 |
| `expectColumns(scope, n)` | Os cartões da primeira linha ocupam `n` colunas | US6.2 |
| `expectStickyAfterScroll(page, bar)` | Depois de rolar, a barra de seções continua no topo e visível; rolar a barra para o lado não rola a página | US6.1 |
| `expectReadableAt200(page)` | Com a fonte raiz em 200%, valem `expectNoSideScroll`, `expectNoClippedText` e nenhuma sobreposição | US6.7 |
| `expectSurvivesRotation(page)` | Trocar largura por altura mantém o carrinho e o produto que estava à vista | US6.8 |
| `expectLazyPhotos(page)` | Fotos fora da tela só são pedidas depois de rolar; a foto pedida é a menor que cobre a largura do cartão × densidade | US6.10 |

## O que roda em cada tela

| Arquivo | Onde | Verifica |
|---|---|---|
| `customer-menu.spec.ts` | 9 telas × 2 modos × 2 motores | Todas as asserções acima no cardápio e na tela do prato; busca, adicionais, retiradas, carrinho, "Meus pedidos" e tempo do acesso continuam funcionando (US6.11); axe sem falha grave; imagem de referência |
| `menu-board.spec.ts` | 6 telas × 2 modos × 2 motores | `expectNoSideScroll`, `expectNoClippedText`, `expectTapTargets`, `expectPhotoRatio`, `expectReadableAt200` na tela Cardápio, no produto e na pré-visualização; axe; imagem de referência |
| `weight.spec.ts` | `celular-iphone`, só `telas-chromium`, 4G lento | Primeira pintura com conteúdo ≤ 2 s; fotos do primeiro carregamento ≤ 1 MB (SC-004) |

## Comparação de imagem

- 60 referências em `tests/screens/__screenshots__/`: (9 telas do cliente + 6 da equipe) × 2 modos
  × 2 motores.
- `maxDiffPixelRatio: 0.001`, `threshold: 0.2`, animações desligadas, cursor escondido, contador
  "Faltam N min" mascarado.
- Só roda dentro de `mcr.microsoft.com/playwright:v1.63.0-noble` (`pnpm test:screens`). Atualizar:
  `pnpm test:screens:update`, com as imagens novas no PR.

## Comandos

| Comando | O que faz | Na CI |
|---|---|---|
| `pnpm test:menu` | Unidade + integração com cobertura de 100% (linhas, desvios, funções) do código novo da 013 | job `check` |
| `pnpm test:mutation` | Stryker em `src/domain/menu/`, todo mutante morto | job `check` |
| `pnpm test:screens` | Projetos `telas-*` na imagem do Playwright | job `telas` |
| `pnpm test:e2e` | Projeto `chromium` (fluxos), como hoje | job `e2e` |
