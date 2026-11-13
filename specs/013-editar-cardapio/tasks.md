# Tarefas — 013 Gerente e chef editam o cardápio

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md).

## Regras (spec, TDD-001 a TDD-010)

- Toda tarefa de código vem **depois** da tarefa `[teste]` que a exige. O teste é escrito, rodado e
  visto falhar **na asserção** (não no `import`: crie um esqueleto vazio antes, se preciso). Só
  então entra o mínimo de código para passar.
- Commits: `test(013): … (vermelho)` antes de `feat(013): …` do mesmo assunto. Refatoração só com
  tudo verde.
- Classe de layout só entra quando uma asserção de `tests/screens/layout.ts` falha por falta dela.
- Nenhum `.skip`, `.only`, teste apagado ou referência de imagem atualizada só para passar.
- Uma tarefa de código só é marcada como feita com `pnpm test:menu` em 100% para os arquivos dela.
- `[P]` = pode andar em paralelo (arquivos diferentes, sem depender de tarefa aberta). `[USn]` =
  história da spec. A matriz, os dados fixos e as asserções citados estão em
  [contracts/screens.md](contracts/screens.md).

## Fase 1: Ferramentas de teste (bloqueia tudo)

Sem esta fase nenhuma linha de tela pode ser exigida por teste.

- [x] T001 Instalar `sharp`, `@vercel/blob` e, em desenvolvimento, `@stryker-mutator/core` e `@stryker-mutator/vitest-runner` em `package.json`; `MENU_PHOTOS`, `MENU_PHOTO_DIR` e `BLOB_READ_WRITE_TOKEN` em `.env.example`; `.menu-photos/` e `reports/` em `.gitignore`
- [x] T002 [P] `tests/screens/matrix.ts`: as 9 telas de [contracts/screens.md](contracts/screens.md) com `name`, `width`, `height`, `customer`, `staff` e `columns`; modos `light` e `dark`
- [x] T003 Projetos `telas-chromium` e `telas-webkit` em `playwright.config.ts` (rodam `tests/screens/**/*.spec.ts`; o projeto `chromium` continua só com `tests/e2e/`); `toHaveScreenshot` com `maxDiffPixelRatio: 0.001`, `threshold: 0.2`, animações desligadas, pasta `tests/screens/__screenshots__/`
- [x] T004 [teste] `tests/screens/layout.spec.ts`: para cada asserção de [contracts/screens.md](contracts/screens.md) (`expectNoSideScroll`, `expectNoClippedText`, `expectTapTargets`, `expectPhotoRatio`, `expectNoBrokenImage`, `expectColumns`, `expectStickyAfterScroll`, `expectReadableAt200`, `expectSurvivesRotation`, `expectLazyPhotos`), uma página montada com `page.setContent` que está certa (a asserção passa) e uma quebrada de propósito (a asserção tem de lançar erro): texto cortado, botão de 30 px, dois botões sobrepostos, foto esticada, imagem quebrada, página com rolagem lateral
- [x] T005 `tests/screens/layout.ts` com as dez asserções (verde o T004)
- [x] T006 Scripts `test:screens` e `test:screens:update` em `package.json` e `scripts/screens.sh`: rodam os projetos `telas-*` dentro de `mcr.microsoft.com/playwright:v1.63.0-noble` contra o build de produção com `MENU_PHOTOS=file`. Conferir aqui se o ambiente baixa a imagem; se não baixar, registrar em [research.md](research.md#r10-comparação-de-imagem) e criar `.github/workflows/atualizar-telas.yml` (manual, devolve as imagens como artefato)
- [x] T007 Script `test:menu` em `package.json` e `vitest.menu.config.mts`: projetos `unit` e `integration` juntos, cobertura só de `src/domain/menu/**`, `src/application/menu/**`, `src/components/menu/**`, `src/components/ordering/{section-bar,product-card,product-photo}.tsx`, `src/infra/photos/**` e `src/infra/db/repositories/menu-repository.ts`, com limite de 100% de linhas, desvios e funções
- [x] T008 `stryker.config.json` e script `test:mutation`: mutação em `src/domain/menu/**/*.ts` (fora os testes), `thresholds.break: 100`. Conferir a compatibilidade do executor de Vitest com o Vitest 5; se não for compatível, usar o executor por comando (`vitest run src/domain/menu`) e registrar em [research.md](research.md#r11-cada-linha-só-existe-se-um-teste-exigir)
- [x] T009 `.github/workflows/ci.yml`: `pnpm test:menu` e `pnpm test:mutation` no job `check`; job novo `telas` na imagem do Playwright (banco como serviço, `pnpm build`, `pnpm test:screens`); o job `e2e` continua como está
- [x] T010 Prova de fumaça: `tests/screens/smoke.spec.ts` aplica `expectNoSideScroll` na tela `/entrar` em toda a matriz, nos dois motores, com uma imagem de referência; rodar `pnpm test:screens` e ver verde local e na CI

## Fase 2: Base (domínio, banco e permissão)

Bloqueia todas as histórias.

- [x] T011 [P] [teste] `src/domain/menu/photo.test.ts` (`describe` cita `docs/produto/pedidos/06-editar-o-cardapio.md`): `checkPhotoFile` aceita `image/jpeg`, `image/png` e `image/webp`; outro tipo → `PHOTO_TYPE`; 10 MB exatos passam e 10 MB + 1 byte → `PHOTO_TOO_BIG`; lado menor 600 passa e 599 → `PHOTO_TOO_SMALL` (em pé e deitada). `variantWidths`: 600 → `[300, 600]`; 899 → `[300, 600]`; 900 → `[300, 600, 900]`; 4000 → `[300, 600, 900, 1200]`. `photoSrcSet`: monta `"{base}/300.webp 300w, …"`; sem foto → `null`
- [x] T012 [P] `src/domain/menu/photo.ts`
- [x] T013 [P] [teste] `src/domain/menu/description.test.ts`: `cleanDescription` tira espaços das pontas, mantém quebras de linha, vazio ou só espaços → `null`, 300 caracteres passam, 301 → `INVALID_DESCRIPTION`, `<b>` e links ficam como texto
- [x] T014 [P] `src/domain/menu/description.ts`
- [x] T015 [P] [teste] `src/domain/menu/section.test.ts`: `checkSectionName` exige nome (vazio → `INVALID_NAME`), aceita 40 e recusa 41 caracteres, tira espaços das pontas, "lanches" e "Lánches" batem com "Lanches" existente → `NAME_IN_USE`, renomear para o próprio nome passa
- [x] T016 [P] `src/domain/menu/section.ts`
- [x] T017 [P] [teste] `src/domain/menu/order.test.ts`: `move` troca com o vizinho para cima e para baixo; primeiro com `"up"` e último com `"down"` → `NO_CHANGE`; id fora da lista → `NOT_FOUND`; lista de um só → `NO_CHANGE`; o resultado tem os mesmos ids, sem perder nem repetir. `appendPosition`: lista vazia → 1; `[1, 2, 3]` → 4
- [x] T018 [P] `src/domain/menu/order.ts`
- [x] T019 [P] [teste] `src/domain/menu/customer-menu.test.ts`: `buildCustomerMenu` põe as seções na ordem de `position` e "Outros" no fim; produtos por `menu_position`; some produto inativo, sem preço, esgotado hoje ou preparo; seção sem produto que o cliente possa pedir não vem; nenhum produto com seção → `showSectionTitles: false` e uma lista só; descrição e foto acompanham o produto
- [x] T020 [P] `src/domain/menu/customer-menu.ts`
- [x] T021 [P] [teste] `src/domain/access/permissions.test.ts`: `menu.write` é de `MANAGER` e `CHEF` e de mais ninguém
- [x] T022 [P] `menu.write` em `src/domain/access/permissions.ts`; os quatro códigos `PHOTO_TYPE`, `PHOTO_TOO_BIG`, `PHOTO_TOO_SMALL` e `PHOTO_STORAGE_FAILED` em `src/domain/shared/result.ts`
- [x] T023 [teste] `tests/integration/menu/schema.test.ts`: `menu_sections` com RLS (um restaurante não lê nem grava seção de outro), nome normalizado único por restaurante, `position > 0`; em `recipes`: `description` com 301 caracteres é recusada, preparo com descrição, seção, foto ou posição ≠ 0 é recusado (`recipes_menu_only_dish`), `photo_base` sem `photo_widths` é recusado (`recipes_photo_pair`), `menu_section_id` de outro restaurante é recusado; a migração deixa os produtos vendidos existentes em "Outros" com `menu_position` na ordem alfabética
- [x] T024 `menu_sections` e as colunas novas de `recipes` em `src/infra/db/schema/catalog.ts` e migração `src/infra/db/migrations/0013_menu_editing.sql` com o `update` de [data-model.md](data-model.md#dados-existentes)
- [x] T025 [teste] `tests/integration/performance/indexes.test.ts`: a consulta da tela Cardápio e a do cardápio do cliente por seção e posição usam `recipes_menu_order`
- [x] T026 Índice `recipes_menu_order (restaurant_id, kind, menu_section_id, menu_position)` no esquema e na migração `0013`
- [x] T027 [teste] `tests/integration/menu/repository.test.ts`: `menu-repository` lista seções em ordem, lista produtos vendidos por seção e posição, trava e regrava as posições de um grupo, grava descrição e seção subindo a `version`, grava e limpa a foto sem subir a `version`
- [x] T028 `src/infra/db/repositories/menu-repository.ts`, portas em `src/application/menu/ports.ts` (`MenuBoardRepo`, `PhotoProcessor`, `PhotoStorage`) e ligação em `src/application/ports.ts` e `src/infra/deps.ts`
- [x] T029 [P] `tests/builders/menu-data.ts` e `tests/integration/menu/fixtures.ts`: restaurante com chef, estoquista, três seções e produtos com e sem seção
- [x] T030 [P] `tests/screens/fixtures.ts` e `tests/screens/photos/`: os dados fixos de [contracts/screens.md](contracts/screens.md#dados-fixos-testsscreensfixturests) e fotos de teste pequenas (uma deitada, uma em pé, uma com orientação de câmera e dados de localização, uma de 400 px, um PDF)

**Ponto de conferência**: `pnpm test:menu` em 100% e `pnpm test:mutation` sem mutante vivo no domínio.

## Fase 3: US2 — Seções do cardápio (P1)

**Objetivo**: criar, renomear, ordenar e apagar seções na tela Cardápio.
**Teste independente**: criar "Entradas", "Lanches" e "Bebidas", subir "Bebidas" e ver a tela na ordem nova.

- [x] T031 [P] [US2] [teste] `tests/integration/menu/sections.test.ts`: `createSection` põe a seção no fim e audita (`menu.section.create`); nome repetido → `NAME_IN_USE`; vazio ou 41 caracteres → `INVALID_NAME`; `renameSection` com `version` antiga → `STALE_RECORD`; `moveSection` troca vizinhos, mantém 1..n e devolve `NO_CHANGE` na ponta; `deleteSection` manda os produtos para "Outros" no fim, devolve `movedProducts` e audita; estoquista → `FORBIDDEN` com a tentativa negada na auditoria; outro restaurante → `NOT_FOUND`
- [x] T032 [US2] `src/application/menu/sections.ts`
- [x] T033 [P] [US2] [teste] `src/application/menu/section-input.test.ts`: o leitor do formulário lê `name`, `id`, `version` e `direction`; direção fora de `up` e `down` → `VALIDATION`
- [x] T034 [P] [US2] `src/application/menu/section-input.ts`
- [x] T035 [US2] [teste] `tests/integration/menu/board.test.ts`: `getMenuBoard` devolve as seções na ordem com `canMoveUp` e `canMoveDown`, seção vazia aparece, "Outros" só com produtos, cada produto com preço (`null` = sem preço), `active`, `soldOutToday` e foto; preparo não aparece; faz o mesmo número de consultas com 2 ou com 20 produtos
- [x] T036 [US2] `src/application/menu/board.ts`
- [x] T037 [P] [US2] [teste] `src/components/menu/move-buttons.test.tsx`: botões "Subir {nome}" e "Descer {nome}" com nome acessível, desligados quando `canMoveUp` ou `canMoveDown` é falso, enviam `id` e `direction`, funcionam com Enter e espaço
- [x] T038 [P] [US2] `src/components/menu/move-buttons.tsx`
- [x] T039 [P] [US2] [teste] `src/components/menu/section-form.test.tsx`: criar e renomear com `useFormAction`; erro do servidor no campo ("Já existe a seção Lanches"); "Salvo" só com a confirmação do servidor; apagar pede confirmação com "Os 4 produtos de Lanches vão para Outros"
- [x] T040 [P] [US2] `src/components/menu/section-form.tsx`
- [x] T041 [US2] [teste] `src/components/menu/menu-board.test.tsx`: títulos das seções como `h2` na ordem, "Outros" no fim, lista vazia com `EmptyState` ("Crie a primeira seção…"), selos "Sem preço", "Inativo", "Esgotado hoje" e "Sem foto", link de cada produto para `/pedidos/cardapio/{id}`, botões "Nova seção", "Novo produto" e "Ver como o cliente"
- [x] T042 [US2] `src/components/menu/menu-board.tsx`
- [x] T043 [US2] [teste] `src/components/layout/nav.test.tsx`: "Cardápio" aparece em Operação só para quem tem `menu.write`; em `/pedidos/cardapio` só "Cardápio" fica com `aria-current` (não "Pedidos")
- [x] T044 [US2] Entrada "Cardápio" em `src/components/layout/nav.tsx`
- [x] T045 [US2] [teste] `tests/e2e/menu-editing.spec.ts` (vermelho): chef abre Cardápio pelo menu, cria três seções, renomeia uma, sobe "Bebidas", apaga "Entradas" confirmando; estoquista cai em "Sem acesso"
- [x] T046 [US2] Ações de seção em `src/actions/menu-board.ts` e tela `app/(app)/pedidos/cardapio/page.tsx`
- [x] T047 [US2] [teste] `tests/screens/menu-board.spec.ts` (vermelho): na tela Cardápio, nas 6 telas da equipe × 2 modos, `expectNoSideScroll`, `expectNoClippedText`, `expectTapTargets`, `expectReadableAt200` e axe sem falha grave
- [x] T048 [US2] [teste] `src/components/ui/input.test.tsx`, `select.test.tsx` e `textarea.test.tsx`: `size="lg"` dá 44 px de altura; sem `size` continua 40 px
- [x] T049 [US2] `size="lg"` em `src/components/ui/input.tsx`, `select.tsx` e `textarea.tsx`, e as classes de layout da tela Cardápio que o T047 exigir, uma asserção por vez

**Ponto de conferência**: T045 e T047 verdes nos dois motores.

## Fase 4: US3 — Ordem dos produtos (P1)

**Objetivo**: subir e descer produtos dentro da seção.
**Teste independente**: subir o X-Salada em "Lanches" e ver o cardápio com ele antes do X-Burger.

- [x] T050 [P] [US3] [teste] `tests/integration/menu/order.test.ts`: `moveProduct` troca com o vizinho da mesma seção (e dentro de "Outros"), mantém 1..n, não muda `version`, preço, versões nem pedidos enviados, audita (`menu.product.move`) e devolve `NO_CHANGE` na ponta; dois movimentos ao mesmo tempo no mesmo grupo terminam com todos os produtos, sem repetir posição; preparo → `NOT_A_DISH`; sem permissão → `FORBIDDEN`
- [x] T051 [US3] `src/application/menu/order.ts`
- [x] T052 [US3] [teste] `tests/integration/ordering/menu.test.ts`: `getMenu` devolve os produtos na ordem de seção e posição; ajustar a expectativa alfabética `["Suco", "X-Burger"]` para a ordem de posição (única expectativa antiga que muda: regra da US3.5)
- [x] T053 [US3] `buildMenu` em `src/domain/ordering/menu.ts` e `menuRepository.products()` em `src/infra/db/repositories/ordering-repository.ts` ordenam por seção e posição (o teste de unidade de `buildMenu` muda antes, vermelho)
- [x] T054 [US3] [teste] `tests/e2e/menu-editing.spec.ts` (vermelho): em "Lanches", "Subir X-Salada" põe o X-Salada antes do X-Burger; o primeiro produto tem "Subir" desligado; com o teclado também funciona
- [x] T055 [US3] Ação `moveProductAction` em `src/actions/menu-board.ts` e os botões no `menu-board.tsx` (o teste do componente ganha o caso antes)

## Fase 5: US1 — Foto e descrição (P1)

**Objetivo**: pôr foto e descrição no produto.
**Teste independente**: chef envia foto e descrição do X-Burger e as vê na tela do produto.

- [x] T056 [P] [US1] [teste] `tests/integration/menu/photo-processor.test.ts` com fotos de verdade de `tests/screens/photos/`: saída WebP em 4:3 nas larguras de `variantWidths`; o recorte é o central (foto de teste com faixas coloridas); foto com orientação de câmera sai em pé; saída sem EXIF nem localização; PDF renomeado para `.jpg` → `PHOTO_TYPE`; 400 px → `PHOTO_TOO_SMALL`
- [x] T057 [P] [US1] `src/infra/photos/sharp-processor.ts`
- [x] T058 [P] [US1] [teste] `src/infra/photos/storage.test.ts`: `memory-storage` e `file-storage` gravam `menu/{photoId}/{largura}.webp`, devolvem a base e apagam; `file-storage` recusa caminho com `..`; `vercel-blob-storage` chama `put` com acesso público, sem sufixo aleatório, tipo `image/webp` e cache de um ano, e `del` com os endereços certos (funções `put` e `del` recebidas por parâmetro)
- [x] T059 [P] [US1] `src/infra/photos/memory-storage.ts`, `file-storage.ts`, `vercel-blob-storage.ts` e a escolha por `MENU_PHOTOS` em `src/infra/deps.ts`
- [x] T060 [US1] [teste] `tests/integration/menu/photo.test.ts`: `setProductPhoto` grava as variantes, `photo_base` e `photo_widths`, audita (`menu.photo.set`) e apaga os arquivos da foto anterior depois do commit; se a gravação no banco falha, apaga os arquivos novos e o produto continua como estava; armazenamento fora do ar → `PHOTO_STORAGE_FAILED` sem mudar o produto; `removeProductPhoto` limpa, apaga os arquivos e audita, e sem foto → `NO_CHANGE`; preparo → `NOT_A_DISH`; sem permissão → `FORBIDDEN`; produto de outro restaurante → `NOT_FOUND`; o endereço não contém id de restaurante nem de produto
- [x] T061 [US1] `src/application/menu/photo.ts`
- [x] T062 [P] [US1] [teste] `tests/integration/menu/details.test.ts`: `setMenuDetails` grava descrição limpa e seção, põe o produto no fim da seção nova, sobe a `version`, audita antes e depois (`menu.details`); 301 caracteres → `INVALID_DESCRIPTION`; seção inexistente → `NOT_FOUND`; `version` antiga → `STALE_RECORD`; não cria versão do produto; `getMenuProduct` devolve o produto com as seções para escolher
- [x] T063 [US1] `src/application/menu/details.ts` e `details-input.ts` (com `details-input.test.ts` antes)
- [x] T064 [US1] [teste] `tests/integration/menu/photo-route.test.ts`: `POST /api/cardapio/foto` devolve `200 { photo }`; sem login `401`; sem `menu.write` `403`; corpo acima de 4 MB `413`; erros de `setProductPhoto` como `400 { code }`
- [x] T065 [US1] `app/api/cardapio/foto/route.ts` e `app/fotos/[...path]/route.ts` (este devolve o arquivo só com `MENU_PHOTOS=file`; com outro valor, `404`, também testado no T064)
- [x] T066 [P] [US1] [teste] `src/components/menu/reduce-photo.test.ts` (com `createImageBitmap` e canvas de mentira recebidos por parâmetro): foto de 4000 × 3000 vira 1600 × 1200 em JPEG 0,85; foto menor que 1600 não é ampliada; pede a orientação da câmera; falha ao reduzir devolve o original se tiver até 4 MB e, acima disso, o erro "Não foi possível preparar a foto neste aparelho. Use uma foto menor que 4 MB."
- [x] T067 [P] [US1] `src/components/menu/reduce-photo.ts`
- [x] T068 [P] [US1] [teste] `src/components/menu/upload-photo.test.ts` (com `XMLHttpRequest` de mentira): informa o progresso, resolve com a foto no `200`, devolve o código no `400` e "Não foi possível enviar a foto. Tente de novo." na queda de rede
- [x] T069 [P] [US1] `src/components/menu/upload-photo.ts`
- [x] T070 [US1] [teste] `src/components/menu/photo-field.test.tsx`: "Escolher foto" e "Tirar foto" (campo com `capture`); a prévia aparece em 4:3 antes de salvar; as três mensagens de `checkPhotoFile` sobre o arquivo original; barra de progresso com `role="progressbar"`; "Salvo" só depois do `200`; erro de envio mantém a foto antiga; com foto, "Trocar foto" e "Tirar foto do cardápio" com confirmação; sem foto, "Sem foto"
- [x] T071 [US1] `src/components/menu/photo-field.tsx`
- [x] T072 [P] [US1] [teste] `src/components/menu/description-field.test.tsx`: contador "Faltam N caracteres" ligado ao campo por `aria-describedby`, aviso ao passar de 300, quebras de linha mantidas
- [x] T073 [P] [US1] `src/components/menu/description-field.tsx`
- [x] T074 [US1] [teste] `tests/e2e/menu-editing.spec.ts` (vermelho): chef abre o X-Burger, escolhe a seção, escreve a descrição, envia uma foto de verdade e vê "Salvo" e a foto; PDF, foto de 400 px e foto acima de 10 MB mostram as mensagens da spec; tirar a foto pede confirmação
- [x] T075 [US1] `src/components/menu/product-menu-form.tsx` (com teste do componente antes), ações `setMenuDetailsAction` e `removeProductPhotoAction` em `src/actions/menu-board.ts` e tela `app/(app)/pedidos/cardapio/[id]/page.tsx`
- [x] T076 [US1] [teste] `tests/screens/menu-board.spec.ts` (vermelho): tela do produto nas 6 telas da equipe × 2 modos com as asserções do T047 e `expectPhotoRatio` na prévia; depois, as classes de layout que ele exigir

## Fase 6: US4 — O produto do cardápio num lugar só (P1)

**Objetivo**: preço e "Esgotado hoje" na mesma tela; produto novo pela tela Cardápio.
**Teste independente**: criar "Suco de laranja" com item, preço, seção, foto e descrição e vê-lo no fim de "Bebidas".

- [x] T077 [P] [US4] [teste] `tests/integration/menu/create-product.test.ts`: `createMenuProduct` cria o produto vendido com as validações da 003 (sem item → `RECIPE_EMPTY`; nome repetido → `RECIPE_DUPLICATE_NAME`), grava preço, descrição e seção e põe no fim da seção, tudo numa transação (erro em qualquer parte não deixa nada gravado); preço zero → `INVALID_PRICE`; exige `menu.write` e `recipe.write`
- [x] T078 [US4] `src/application/menu/create-product.ts` e `create-product-input.ts` (com `create-product-input.test.ts` antes)
- [x] T079 [US4] [teste] `src/components/menu/product-menu-form.test.tsx`: o formulário do produto mostra preço (regras da 008) e "Esgotado hoje" (009) junto de foto, descrição e seção, cada um salvando sozinho com seu "Salvo"; link "Editar nome e ingredientes" para `/estoque/produtos/{id}`; `STALE_RECORD` mostra "Outra pessoa mudou este produto. Recarregue a tela."
- [x] T080 [US4] Preço e "Esgotado hoje" em `product-menu-form.tsx`, reaproveitando `setSalePriceAction` e a ação de esgotado existentes
- [x] T081 [US4] [teste] `tests/e2e/menu-editing.spec.ts` (vermelho): "Novo produto" com nome, item, preço, seção, descrição e foto volta para a tela Cardápio com o produto no fim de "Bebidas"; se a foto falhar, "Produto salvo, mas a foto não foi enviada. Tente de novo."; mudar o preço pela tela Cardápio faz o carrinho de um cliente pedir nova confirmação
- [x] T082 [US4] `createMenuProductAction` em `src/actions/menu-board.ts` e tela `app/(app)/pedidos/cardapio/novo/page.tsx`, reaproveitando o formulário de linhas da 003
- [x] T083 [US4] [teste] `tests/integration/audit/menu.test.ts`: cada escrita da tela Cardápio aparece na consulta de auditoria com quem, quando e o que mudou, e cada tentativa sem permissão como negada (FR-009)
- [x] T084 [US4] Rótulos das ações `menu.*` na tela de auditoria (`src/components/audit/`), com o teste do componente antes

## Fase 7: US6 — Cardápio do cliente em qualquer tela (P1)

**Objetivo**: seções, fotos e descrições no cardápio do cliente, certo em toda a matriz.
**Teste independente**: abrir o cardápio de dados fixos em cada tela da matriz e passar em todas as asserções.

- [x] T085 [US6] [teste] `tests/integration/ordering/menu.test.ts`: `getMenu` devolve `showSectionTitles` e `sections` conforme [contracts/use-cases.md](contracts/use-cases.md#cardápio-do-cliente-estende-a-rota-pública-da-009), com descrição e foto; faz uma consulta a mais que antes e o mesmo número com 2 ou 40 produtos; nada de outro restaurante
- [x] T086 [US6] `src/application/ordering/menu.ts` e `menuRepository` passam a usar `buildCustomerMenu`
- [x] T087 [P] [US6] [teste] `src/components/ordering/product-photo.test.tsx`: `<img>` com `srcset` das larguras, `sizes` de [research.md, R5](research.md#r5-imagem-no-cardápio), `width` e `height` em 4:3, `alt` com o nome do produto, `loading="lazy"` por padrão e `eager` quando pedido; sem foto não desenha nada
- [x] T088 [P] [US6] `src/components/ordering/product-photo.tsx`
- [x] T089 [P] [US6] [teste] `src/components/ordering/product-card.test.tsx`: foto, nome inteiro, descrição, preço e botão com nome acessível "Adicionar {nome}" ou "Escolher {nome}"; sem descrição não deixa parágrafo vazio; sem foto não deixa espaço
- [x] T090 [P] [US6] `src/components/ordering/product-card.tsx`
- [x] T091 [P] [US6] [teste] `src/components/ordering/section-bar.test.tsx`: `nav` com nome "Seções do cardápio", um link por seção para a âncora do título, seção atual com `aria-current`, não aparece quando `showSectionTitles` é falso
- [x] T092 [P] [US6] `src/components/ordering/section-bar.tsx`
- [x] T093 [US6] [teste] `src/components/ordering/menu-app.test.tsx`: títulos de seção como `h2` com âncora; sem títulos quando `showSectionTitles` é falso; a busca procura em todas as seções e mantém a ordem do cardápio; as duas primeiras fotos `eager`; a atualização a cada 10 s troca foto e ordem sem perder o carrinho; os casos da 009 e da 010 continuam passando
- [x] T094 [US6] `src/components/ordering/menu-app.tsx`
- [x] T095 [US6] [teste] `src/components/ordering/dish-options.test.tsx`: a tela do prato mostra a foto maior e a descrição inteira com as quebras de linha
- [x] T096 [US6] `src/components/ordering/dish-options.tsx`
- [ ] T097 [US6] [teste] `tests/screens/customer-menu.spec.ts` (vermelho): no cardápio e na tela do prato, nas 9 telas × 2 modos, todas as asserções de [contracts/screens.md](contracts/screens.md#asserções-de-layout-testsscreenslayoutts) com `expectColumns` no número da matriz, a barra com 8 seções rolando só dentro dela, texto sobre foto com contraste, axe sem falha grave e os fluxos de busca, adicionais, retiradas, carrinho, "Meus pedidos" e tempo do acesso
- [ ] T098 [US6] Classes de layout em `menu-app.tsx`, `section-bar.tsx`, `product-card.tsx`, `product-photo.tsx`, `dish-options.tsx` e `app/(cardapio)/layout.tsx`, uma asserção vermelha por vez, até o T097 ficar verde nos dois motores
- [ ] T099 [US6] [teste] `tests/screens/weight.spec.ts` (vermelho): 40 produtos com foto, tela `celular-iphone`, 4G lento, só `telas-chromium`: primeira pintura com conteúdo em até 2 s e até 1 MB de fotos no primeiro carregamento; depois o ajuste que ele exigir
- [ ] T100 [US6] Imagens de referência do cardápio do cliente (9 telas × 2 modos × 2 motores) com `pnpm test:screens:update`, conferidas uma a uma, em `tests/screens/__screenshots__/`
- [ ] T101 [US6] [teste] `tests/e2e/accessibility.spec.ts`: o cardápio do cliente com seções e fotos e a tela do prato entram na lista do axe

**Ponto de conferência**: SC-002, SC-003 e SC-004 verdes.

## Fase 8: US5 — Ver como o cliente (P1)

**Objetivo**: pré-visualização em tamanho de celular e de tablet.
**Teste independente**: tocar "Ver como o cliente" e alternar Celular, Tablet em pé e Tablet deitado.

- [x] T102 [P] [US5] [teste] `tests/integration/menu/preview.test.ts`: `getMenuPreview` devolve o mesmo `CustomerMenu` que o `getMenu` da mesma hora, sem abrir acesso, sem contar pedido e sem gravar nada (nenhuma linha nova em `menu_accesses` nem em `audit_log`); exige `menu.write`
- [x] T103 [US5] `src/application/menu/preview.ts`
- [x] T104 [P] [US5] [teste] `src/components/ordering/menu-app.test.tsx`: com `preview`, mostra a faixa "Pré-visualização: pedidos não são enviados", não tem botão de enviar, contador de tempo nem atualização automática
- [x] T105 [US5] Modo `preview` em `src/components/ordering/menu-app.tsx`
- [x] T106 [P] [US5] [teste] `src/components/menu/preview-frame.test.tsx`: botões "Celular", "Tablet em pé" e "Tablet deitado" com `aria-pressed`; a moldura (`iframe` com título "Cardápio como o cliente vê") muda para 390, 768 e 1024 px; começa em "Celular"
- [x] T107 [P] [US5] `src/components/menu/preview-frame.tsx`
- [x] T108 [US5] [teste] `tests/e2e/menu-editing.spec.ts` (vermelho): "Ver como o cliente" mostra 1, 2 e 3 colunas ao alternar os tamanhos, a faixa de pré-visualização e só produtos que o cliente pode pedir; num celular abre em tela cheia
- [x] T109 [US5] Telas `app/(app)/pedidos/cardapio/ver/page.tsx` e `ver/cliente/page.tsx`
- [ ] T110 [US5] [teste] `tests/screens/menu-board.spec.ts`: a pré-visualização nas 6 telas da equipe × 2 modos com as asserções do T047; depois as classes que ele exigir
- [ ] T111 [US5] Imagens de referência da tela Cardápio (6 telas × 2 modos × 2 motores) com `pnpm test:screens:update`, conferidas uma a uma

## Fase 9: Documentação e fechamento

- [ ] T112 [P] `docs/produto/pedidos/06-editar-o-cardapio.md` (novo) e atualizar `docs/produto/pedidos/00-visao-geral.md` e `02-cardapio-do-cliente.md` (seções, fotos, descrições, ordem escolhida em vez de alfabética)
- [ ] T113 [P] `docs/produto/estoque/09-controles-e-permissoes.md`: `menu.write` (gerente e chef) e o que vai para a auditoria
- [ ] T114 [P] `docs/sistema/05-testes-de-tela.md` (novo: matriz, asserções, imagem do Playwright, como atualizar referência, mutação), `docs/sistema/01-tdd.md` (travas novas e régua de 100% do código novo), `docs/sistema/03-padroes-do-front.md` (`size="lg"`, foto do produto, barra de seções) e `docs/sistema/pedidos/01-modelo-de-dados.md`
- [ ] T115 [P] `docs/sistema/glossario.md` com os termos de [data-model.md](data-model.md#glossário-entra-em-docssistemaglossariomd) e `docs/sistema/adr/0006-fotos-do-cardapio.md` (loja de arquivos atrás de porta)
- [ ] T116 [P] `README.md`: loja Blob e `MENU_PHOTOS=vercel-blob` no deploy; `pnpm test:menu`, `test:mutation` e `test:screens`
- [ ] T117 Rodar o [quickstart.md](quickstart.md) inteiro: os 11 passos pela tela e todos os comandos de teste verdes, sem teste pulado
- [ ] T118 Conferir o histórico: `git log --oneline main..HEAD` mostra um `test(013) … (vermelho)` antes de cada `feat(013)`; marcar o estado da spec e abrir o PR com as imagens de referência para revisão

## Dependências

```text
Fase 1 (ferramentas) → Fase 2 (base) → US2 → US3 → US1 → US4
                                              └────────────→ US6 → US5
```

- **US2** depende só da base. **US3** usa a tela da US2.
- **US1** usa a tela da US2 para chegar ao produto; os casos de uso (T056 a T069) não dependem dela.
- **US4** depende da US1 (formulário do produto) e da US2 (seção).
- **US6** depende da base e do T053 (ordem); pode andar junto com a US1 e a US4, usando os dados
  fixos de `tests/screens/fixtures.ts`.
- **US5** depende da US6 (o cardápio que ela mostra).

## Em paralelo

- Fase 2: os pares T011 a T022 (domínio e permissão) andam juntos; T029 e T030 também.
- US2: T031, T033, T037 e T039 andam juntos.
- US1: T056, T058, T062, T066, T068 e T072 andam juntos.
- US6: T087, T089 e T091 andam juntos.
- Fase 9: T112 a T116 andam juntos.

## Estratégia

1. **Primeira entrega que já serve**: Fases 1 e 2 + US2 + US3. O gerente organiza o cardápio em
   seções e escolhe a ordem, e o cliente já vê a ordem nova.
2. **Segunda**: US1 + US4. Foto, descrição, preço e produto novo num lugar só.
3. **Terceira**: US6 + US5. O cardápio do cliente com seções e fotos, conferido em toda a matriz, e
   a pré-visualização.
4. Documentação e fechamento.

Cada entrega termina com `pnpm test:menu`, `pnpm test:mutation`, `pnpm test:e2e` e
`pnpm test:screens` verdes.

## Cobertura

| Spec | Tarefas |
|---|---|
| US1 | T056 a T076 |
| US2 | T031 a T049 |
| US3 | T050 a T055 |
| US4 | T077 a T084 |
| US5 | T102 a T111 |
| US6 | T085 a T101 |
| FR-001, FR-009 | T021, T022, T031, T083, T084 |
| FR-003 | T011, T056, T060 |
| FR-008 | T023, T060, T085 |
| FR-012 | T112 a T116 |
| TDD-001, TDD-002 | regras do topo, T118 |
| TDD-003 | T004, T005, T047, T076, T097, T110 |
| TDD-004 | T003, T006, T100, T111 |
| TDD-005 | T047, T097, T101 |
| TDD-006, TDD-007 | T011 a T021, T023 a T027 e os testes de integração de cada história |
| TDD-008 | T007, T008, T009 |
| TDD-009, TDD-010 | regras do topo, T002 |
| SC-004 | T099 |
| SC-006 | T052 (única expectativa antiga que muda), T093 |
| SC-007 | T093 |
