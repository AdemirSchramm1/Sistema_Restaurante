# Pesquisa: 013 — Gerente e chef editam o cardápio

Estado de partida, lido no código em 2026-11-13:

- O produto é `recipes` (`kind = 'DISH'`), com `name`, `sale_price`, `active`, `sold_out_on` e a
  trava otimista `version`. Não tem descrição, foto, seção nem posição.
- O cardápio do cliente sai de `getMenu` (`src/application/ordering/menu.ts`), que ordena por nome
  em `buildMenu` (`src/domain/ordering/menu.ts`) e é desenhado por `MenuApp`
  (`src/components/ordering/menu-app.tsx`).
- Gerente e chef já têm `recipe.write` e `product.sold_out`; o preço usa `setRecipeSalePrice` (008).
- O Playwright tem um projeto só (`Desktop Chrome`) e três specs que abrem um contexto `Pixel 7`.
  A CI instala só o Chromium. Não há comparação de imagem nem teste de mutação.
- O projeto não guarda nenhum arquivo fora do banco. O padrão para serviço de fora é uma porta com
  adaptadores (`Mailer`: `memory`, `file`, `resend`).

## R1. Onde as fotos ficam

- **Decisão**: porta `PhotoStorage` com três adaptadores, escolhidos por `MENU_PHOTOS`: `memory`
  (testes de integração), `file` (desenvolvimento e ponta a ponta; grava em `MENU_PHOTO_DIR` e uma
  rota `GET /fotos/...` devolve o arquivo) e `vercel-blob` (produção; loja pública do Vercel Blob,
  token em `BLOB_READ_WRITE_TOKEN`). O banco guarda só a base do endereço e as larguras geradas.
- **Motivo**: o deploy é na Vercel (constituição); a loja de arquivos entrega pela rede de borda,
  com cache de um ano, sem acordar a aplicação nem o banco a cada foto. É o mesmo desenho do
  `Mailer`, então desenvolvimento e testes não dependem de serviço de fora.
- **Alternativas**: `bytea` no PostgreSQL (uma peça a menos, mas cada foto vista viraria uma função
  e uma consulta, e o banco cresceria com dado que não é dele); S3 ou R2 (mais contas e chaves para
  o dono cuidar); `next/image` com otimizador (custo por imagem transformada e resultado diferente
  entre ambientes, ruim para a comparação de imagem).
- **O que o dono precisa fazer no deploy**: criar a loja Blob no projeto da Vercel (a Vercel já
  cria `BLOB_READ_WRITE_TOKEN`) e definir `MENU_PHOTOS=vercel-blob`. Entra no `quickstart.md` e no
  `README`.

## R2. Caminho do envio e o limite de 10 MB

- **Decisão**: o navegador **reduz a foto antes de enviar**. `reducePhoto` desenha a foto num
  canvas com o lado maior em até 1600 px e exporta JPEG com qualidade 0,85 (fica quase sempre
  abaixo de 1 MB). O envio vai por `XMLHttpRequest` (para mostrar o progresso) para o
  `POST /api/cardapio/foto`. Os limites da spec (tipo, 10 MB, lado menor de 600 px) são conferidos
  no navegador **sobre o arquivo original**, pela função de domínio `checkPhotoFile`; o servidor
  confere de novo o que recebeu (tipo pelo conteúdo, até 4 MB, lado menor de 600 px).
- **Motivo**: uma função na Vercel aceita corpo de até 4,5 MB e uma Server Action, 1 MB por
  padrão; 10 MB não passam direto. Reduzir no navegador resolve isso com **um caminho só** para
  desenvolvimento, teste e produção, e ainda economiza o plano de dados de quem está no celular.
- **Alternativas**: envio direto do navegador para a loja (`client upload` do Vercel Blob): aceita
  10 MB, mas cria um segundo caminho que só existe em produção e não é exercitado pelos testes;
  aumentar o limite da Server Action: não muda o teto de 4,5 MB da plataforma.
- **Sem canvas ou falha ao reduzir**: envia o original se tiver até 4 MB; senão, "Não foi possível
  preparar a foto neste aparelho. Use uma foto menor que 4 MB."
- **Testabilidade**: `reducePhoto` recebe `createImageBitmap` e a fábrica de canvas por parâmetro.
  O teste de unidade cobre cada linha com dublês; o ponta a ponta prova com fotos de verdade no
  Chromium e no WebKit.

## R3. Tratamento da foto no servidor

- **Decisão**: porta `PhotoProcessor`, adaptador com `sharp` (dependência nova). Para cada foto:
  ler pelo conteúdo (recusa o que não for JPEG, PNG ou WebP), girar pela orientação da câmera,
  recortar no centro em **4:3**, gerar WebP (qualidade 78) nas larguras **300, 600, 900 e 1200**
  que não passem da largura recortada, sem metadados (EXIF, GPS). Quais larguras gerar é regra de
  domínio (`variantWidths`); `sharp` só executa.
- **Motivo**: o lado menor mínimo de 600 px garante que a largura 600 sempre existe sem ampliar. O
  recorte no servidor faz todos os cartões terem o mesmo recorte e o celular não baixar a parte que
  o cartão esconderia. `sharp` roda nas funções Node da Vercel.
- **Alternativas**: guardar o original e recortar por CSS (baixa bytes que não aparecem); AVIF
  (menor, mas mais lento de gerar e sem ganho que justifique um segundo formato); ponto de foco
  escolhido pela pessoa (fora do escopo: "edição da foto dentro do sistema").
- **Prévia antes de salvar** (US1.2): a imagem local em `aspect-[4/3]` com `object-cover` mostra o
  mesmo recorte central que o servidor faz. Um teste de integração confere que o recorte do
  servidor é o central.

## R4. Endereço da foto

- **Decisão**: `menu/{photoId}/{largura}.webp`, com `photoId` aleatório (UUID v4, 122 bits) gerado
  a cada envio. `recipes.photo_base` guarda o endereço até o `photoId`; `recipes.photo_widths`, as
  larguras. Trocar a foto gera outro `photoId` e apaga os arquivos antigos; cache `immutable` de um
  ano.
- **Motivo**: o endereço não tem id de restaurante nem de produto e não pode ser adivinhado
  (caso-limite da spec); endereço que nunca muda de conteúdo pode ficar em cache para sempre.
- **Ordem das operações**: tratar → gravar os arquivos → transação (produto + auditoria) → depois
  do commit, apagar os antigos. Se a transação falhar, apaga os novos. Falha ao apagar não desfaz
  nada: fica registrada no log (arquivo órfão custa centavos; varredura de órfãos fica fora).

## R5. Imagem no cardápio

- **Decisão**: `<img>` com `srcset` das larguras guardadas, `sizes="(min-width: 1024px) 33vw,
  (min-width: 640px) 50vw, 100vw"`, `width`/`height` fixos em 4:3 (sem salto de layout),
  `loading="lazy"` e `decoding="async"`; só as duas primeiras fotos da tela vêm com
  `loading="eager"`. `alt` é o nome do produto. Produto sem foto não desenha o bloco da foto.
- **Motivo**: cobre US6.3 e US6.10 e o SC-004 sem serviço de otimização; o HTML é o mesmo em todo
  ambiente, o que a comparação de imagem precisa.
- **Alternativas**: `next/image` (ver R1); `picture` com vários formatos (só há WebP).

## R6. Seções e ordem

- **Decisão**: tabela `menu_sections` (nome, nome normalizado, `position`) e, no produto,
  `menu_section_id` (nulo = "Outros") e `menu_position`. Posições inteiras e densas (1..n) por
  grupo. **Subir/Descer** é um caso de uso que, numa transação, trava as linhas do grupo
  (`for update`), aplica a função pura `move` e regrava 1..n. Não usa trava otimista: o movimento
  é relativo ao estado atual, então dois movimentos ao mesmo tempo dão a ordem da última gravação
  sem perder nem repetir ninguém (caso-limite da spec).
- **Motivo**: listas pequenas (dezenas de produtos por seção); regravar o grupo é simples e deixa a
  regra inteira numa função pura testável.
- **Alternativas**: posição fracionária ou índice lexicográfico (evita regravar, mas é complexidade
  sem problema medido); arrastar e soltar (pior no toque e para leitor de tela; fora do escopo).
- **Migração**: produtos vendidos existentes recebem `menu_position` pela ordem alfabética atual
  (o cardápio de quem já usa não muda no dia do deploy).
- **Regra que muda**: o cardápio deixa de ser alfabético (US3.5). O teste de integração da 009 que
  espera `["Suco", "X-Burger"]` passa a criar os produtos nessa ordem ou a esperar a ordem de
  criação; é mudança de regra pedida pela spec, feita no mesmo commit do teste vermelho da regra
  nova, e é a única expectativa antiga que muda (SC-006).

## R7. Colunas por largura

- **Decisão**: pontos de quebra padrão do Tailwind: 1 coluna abaixo de 640 px, 2 de 640 a 1023 px,
  3 a partir de 1024 px. Na matriz: 320, 360, 390 e 430 → 1; 768, 820 e 844 (celular deitado) → 2;
  1024 e 1280 → 3.
- **Motivo**: atende a US6.2; o celular deitado (844 × 390) não está na spec e fica com 2 colunas,
  porque uma coluna só deixaria a foto mais alta que a tela.

## R8. Pré-visualização

- **Decisão**: `/pedidos/cardapio/ver` mostra os botões Celular (390), Tablet em pé (768) e Tablet
  deitado (1024) e um `iframe` com essa largura apontando para `/pedidos/cardapio/ver/cliente`, que
  desenha o mesmo `MenuApp` com `preview`: sem acesso de 20 minutos, sem `AutoRefresh`, sem botão
  de enviar e com a faixa "Pré-visualização: pedidos não são enviados". Em tela menor que a moldura
  escolhida, a página do cliente abre em tela cheia.
- **Motivo**: dentro do `iframe`, os pontos de quebra respondem à largura da moldura, então é o
  mesmo CSS do cliente, sem segunda versão do layout. O caso de uso `getMenuPreview` usa a mesma
  função `buildCustomerMenu` do `getMenu`, com login em vez de cookie.
- **Alternativas**: `@container` em todo o cardápio (mudaria o CSS do cliente só para a prévia);
  abrir um acesso de verdade para a equipe (contaria pedido e tempo).

## R9. Testes de tela: a matriz

- **Decisão**: a matriz vive num arquivo só, `tests/screens/matrix.ts` (nome, largura, altura, se
  vale para o cliente e para a equipe). O Playwright ganha dois projetos, `telas-chromium` e
  `telas-webkit`, que rodam `tests/screens/**/*.spec.ts`; cada spec percorre a matriz e os dois
  modos de cor. O projeto `chromium` atual continua rodando `tests/e2e/`.
- **Asserções de layout** (`tests/screens/layout.ts`), uma por cenário da US6:
  `expectNoSideScroll`, `expectNoClippedText`, `expectTapTargets` (≥ 44 × 44 px e sem
  sobreposição), `expectPhotoRatio` (4:3, sem deformar), `expectColumns(n)`,
  `expectStickyAfterScroll`, `expectReadableAt200` (fonte raiz em 200%) e
  `expectSurvivesRotation` (carrinho e posição).
- **As asserções têm teste próprio**: `tests/screens/layout.spec.ts` monta páginas quebradas de
  propósito (texto cortado, botão de 30 px, foto esticada) e exige que cada asserção **falhe**
  nelas. Assim um teste de layout verde quer dizer alguma coisa (TDD-001: vermelho pelo motivo
  certo).
- **Motor do tipo Safari**: WebKit do Playwright. A CI passa a instalar `chromium webkit`. O
  ambiente de nuvem das sessões só tem o Chromium; lá o WebKit roda pela imagem do R10.
- **Campos de 44 px**: os campos do padrão têm 40 px de altura. `Input`, `Select` e `Textarea`
  ganham `size="lg"` (44 px), usado no cardápio do cliente e na tela Cardápio.

## R10. Comparação de imagem

- **Decisão**: `toHaveScreenshot` do Playwright, com as referências no repositório em
  `tests/screens/__screenshots__/`. São 60 imagens: cardápio do cliente (9 larguras) e tela
  Cardápio (6 larguras) × claro e escuro × 2 motores. Tolerância: `maxDiffPixelRatio: 0.001`
  (0,1% dos pixels) e `threshold: 0.2`; animações desligadas; dados fixos
  (`tests/screens/fixtures.ts`: produto com foto, sem foto, nome longo, descrição longa, 3 seções)
  com fotos de teste pequenas; o contador "Faltam N min" fica mascarado.
- **Pixels iguais em todo lugar**: os projetos `telas-*` rodam sempre dentro da imagem oficial
  `mcr.microsoft.com/playwright:v1.63.0-noble` (a mesma versão do `@playwright/test` do projeto),
  na CI e na máquina de quem desenvolve (`pnpm test:screens`, que chama o Docker). Fora dessa
  imagem as fontes mudam alguns pixels e a comparação não é confiável.
- **Atualizar referência**: só com `pnpm test:screens:update`, e o PR mostra a imagem nova para
  revisão (TDD-004, TDD-009). Se o ambiente não conseguir baixar a imagem, o fluxo manual
  `Atualizar referências de tela` da CI gera as imagens e as devolve como artefato do PR.
- **Alternativas**: serviço pago de comparação visual (dependência e custo sem necessidade);
  comparar só no Chromium (o risco maior de layout está no Safari do iPhone).

## R11. "Cada linha só existe se um teste exigir"

- **Decisão**, em quatro travas:
  1. **Ordem dos commits**: `test(013): … (vermelho)` antes de `feat(013): …`, como na 012; o
     `tasks.md` terá cada tarefa de código precedida da tarefa de teste (TDD-002).
  2. **Cobertura de 100%** de linhas, desvios e funções no código novo: `pnpm test:menu` roda os
     projetos `unit` e `integration` juntos com cobertura restrita a `src/domain/menu/**`,
     `src/application/menu/**`, `src/components/menu/**`, os componentes novos de
     `src/components/ordering/`, `src/infra/photos/**` e `menu-repository.ts`, e falha abaixo de
     100% (TDD-008). Entra na CI.
  3. **Teste de mutação** com Stryker em `src/domain/menu/**`: todo mutante tem de morrer
     (`break: 100`); mutante equivalente só com `// Stryker disable` e o motivo escrito, revisado
     no PR. Comando `pnpm test:mutation`, na CI.
  4. **Layout**: cada classe de layout nasce de uma asserção do R9 que falhava; a comparação de
     imagem (R10) segura o que as asserções não medem.
- **Limite conhecido**: páginas (`app/`) e Server Actions (`src/actions/`) não entram na medição de
  cobertura do Vitest (rodam dentro do Next). Elas ficam sem lógica (só leem o formulário com um
  leitor testado e chamam o caso de uso) e são exercitadas pelos testes ponta a ponta e de tela.
- **Risco**: o executor de Vitest do Stryker pode não aceitar ainda o Vitest 5 com projetos. A
  primeira tarefa confere; se não aceitar, usa-se o executor por comando (`vitest run
  src/domain/menu`), mais lento mas suficiente para uma pasta pequena.
- **Alternativas**: só cobertura (não prova que o teste falha quando a regra muda); mutação no
  repositório inteiro (demorado e fora do escopo da 013).

## R12. Peso e velocidade (SC-004)

- **Decisão**: um teste de tela, só no Chromium, abre o cardápio com 40 produtos com foto, na
  largura 390 px, com a rede limitada ao perfil "4G lento" (protocolo de depuração do Chromium), e
  confere: primeira pintura com conteúdo em até 2 s e soma dos bytes de fotos baixados no primeiro
  carregamento em até 1 MB. Roda contra o build de produção (`pnpm start`), como o resto do ponta a
  ponta.
- **Consultas**: `getMenu` continua com o mesmo número de idas ao banco (as colunas novas vêm na
  consulta que já existe; as seções, numa consulta a mais). O índice novo
  `recipes_menu_order (restaurant_id, kind, menu_section_id, menu_position)` entra no teste de
  índices da 012.

## R13. Permissão e auditoria

- **Decisão**: ação nova `menu.write` (gerente e chef) para foto, descrição, seção do produto,
  ordem e seções. Preço continua em `recipe.write` (008) e "Esgotado hoje" em `product.sold_out`
  (009). A tela usa `menu.write` para aparecer no menu. Toda escrita grava em `audit_log` pelo
  `auditRepository`; tentativa negada também, como nas outras telas.
- **Trava otimista**: descrição, seção e preço usam a `version` do produto (`STALE_RECORD`: "Outra
  pessoa mudou este produto. Recarregue."). Foto e ordem não usam (R4 e R6).

## R14. Produto novo pela tela Cardápio

- **Decisão**: caso de uso `createMenuProduct`, que numa transação só chama a criação da 003 (nome
  e linhas, com as mesmas validações), grava preço, seção e descrição e põe o produto no fim da
  seção. A foto vai depois, pelo mesmo `POST /api/cardapio/foto`; se a foto falhar, o produto fica
  salvo e a tela avisa "Produto salvo, mas a foto não foi enviada. Tente de novo."
- **Motivo**: sem estado pela metade no banco; reaproveita o formulário de linhas da 003.
