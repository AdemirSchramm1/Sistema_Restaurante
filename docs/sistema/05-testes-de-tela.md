# Testes de tela

O cardápio do cliente abre em celulares e tablets de todos os tamanhos, e a tela **Cardápio** da
equipe é usada no celular do chef e no tablet da cozinha. Por isso essas telas têm uma camada de
teste própria, além do ponta a ponta (spec 013, contracts/screens.md e research R9 a R12).

## A matriz

`tests/screens/matrix.ts` é a única fonte dos tamanhos. Todo teste de tela percorre a lista e os
dois modos de cor (claro e escuro), nos dois motores (`telas-chromium` e `telas-webkit`, o WebKit
faz o papel do Safari do iPhone).

| Tela | Largura × altura | Cliente | Equipe | Colunas de cartões |
|---|---|---|---|---|
| `celular-pequeno` | 320 × 568 | sim | sim | 1 (`list`, linhas) |
| `celular-android` | 360 × 800 | sim | sim | 1 (`list`, linhas) |
| `celular-iphone` | 390 × 844 | sim | sim | 1 (`list`, linhas) |
| `celular-grande` | 430 × 932 | sim | – | 1 (`list`, linhas) |
| `celular-deitado` | 844 × 390 | sim | – | 3 (`grid3`) |
| `tablet-em-pe` | 768 × 1024 | sim | sim | 3 (`grid3`) |
| `tablet-grande-em-pe` | 820 × 1180 | sim | – | 3 (`grid3`) |
| `tablet-deitado` | 1024 × 768 | sim | sim | 3, carrinho ao lado (`grid3side`) |
| `computador` | 1280 × 800 | sim | sim | 4, carrinho ao lado (`grid4side`) |

Desde a 016 a coluna vem de `menuLayout(largura)` (`src/domain/menu/menu-layout.ts`): linhas abaixo
de 600 px (breakpoint `tab`), 3 cartões de 600 px, o carrinho ao lado de 1024 px (`lg`) e 4 cartões
de 1280 px (`xl`). O layout é só CSS: um cartão e um carrinho, posicionados por classe, sem medir a
tela em JavaScript (nada pula ao carregar). `customer-menu.spec.ts` confere que o total e **Enviar
pedido** ficam à vista sem rolar na tela larga e que a barra do pé não cobre o último cartão na
estreita.

Apareceu um aparelho com problema? A linha dele entra na matriz **antes** da correção, o teste fica
vermelho e só então vem a classe que resolve.

## As asserções

Ficam em `tests/screens/layout.ts`, uma por regra da US6:

| Asserção | O que exige |
|---|---|
| `expectNoSideScroll` | A página nunca rola para o lado |
| `expectNoClippedText` | Nenhum texto cortado (exceto o que tem `data-clamp`, cortado de propósito com "…") |
| `expectTapTargets` | Todo botão, link e campo com pelo menos 44 × 44 px, sem sobreposição |
| `expectPhotoRatio` | Foto em 4:3, sem deformar |
| `expectNoBrokenImage` | Nenhuma imagem quebrada |
| `expectColumns(n)` | Cartões em `n` colunas |
| `expectStickyAfterScroll` | A barra de seções fica no topo; rolar a barra não rola a página |
| `expectReadableAt200` | Com a letra em 200%, nada rola para o lado, corta ou sobrepõe |
| `expectSurvivesRotation` | Girar o aparelho mantém o carrinho e o que estava no topo da tela |
| `expectLazyPhotos` | Foto longe da tela só carrega ao chegar perto, na menor variante que serve |

As asserções têm teste próprio: `tests/screens/layout.spec.ts` monta páginas quebradas de propósito
e exige que cada uma **falhe** nelas. Um verde da camada de tela quer dizer alguma coisa.

Specs: `customer-menu.spec.ts` (cardápio do cliente e tela do prato), `section-bar.spec.ts` (8
seções), `menu-board.spec.ts` (tela Cardápio, página do produto e "Ver como o cliente") e
`weight.spec.ts` (peso e velocidade, só Chromium). Os dados vêm de `tests/support/seed-menu.mts`,
pelos casos de uso, com a fixture `asStaff` (gerente logado) ou `asCustomer` (celular que acabou de
ler o QR code da mesa 12).

Os dados de tela não podem variar de um preparo para outro. O nome do restaurante é sempre
`RESTAURANT_NAME` (`tests/builders/menu-data.ts`), com uma palavra de 16 letras sem espaço, o pior
caso do nome em maiúsculas no topo do cardápio em 320 px com a letra em 200%. Antes ele levava um
carimbo aleatório: em 320 px o nome ora cabia numa linha, ora não, e os testes do `celular-pequeno`
falhavam só em algumas rodadas.

## Comparação de imagem

`toHaveScreenshot` com as referências em `tests/screens/__screenshots__/{motor}/`. Tolerância de
0,1% dos pixels; animações desligadas; o contador "Faltam N min" fica mascarado. As referências só
valem geradas dentro da imagem oficial `mcr.microsoft.com/playwright:v1.63.0-noble`: fora dela as
fontes mudam alguns pixels.

## Como rodar

```bash
pnpm build                       # os testes de tela rodam contra o build de produção
pnpm test:screens                # tudo, nos dois motores, dentro da imagem do Playwright (Docker)
pnpm test:screens tests/screens/customer-menu.spec.ts -g "celular-pequeno light"
pnpm test:screens:update         # regrava as referências; revise cada imagem no PR
```

Na CI o job "telas" já roda dentro da imagem (`SCREENS_IN_CONTAINER=1`). Referência nova ou
mudada só entra pelo `test:screens:update`, e o PR mostra a imagem para revisão.

## Cada linha nasce de um teste

O código novo do cardápio tem três travas, além da ordem dos commits (`test(013): … (vermelho)`
antes de `feat(013): …`):

- `pnpm test:menu`: unidade + integração com 100% de linhas, desvios e funções em
  `src/domain/menu/**`, `src/application/menu/**`, `src/components/menu/**`, nos componentes novos
  do cardápio do cliente, em `src/infra/photos/**` e no repositório do cardápio.
- `pnpm test:mutation`: Stryker em `src/domain/menu/**`; todo mutante tem de morrer.
- Layout: cada classe de layout responde a uma asserção acima que estava vermelha.
