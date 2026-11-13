# Plano técnico: 013 — Gerente e chef editam o cardápio

**Branch**: `claude/project-thread-licz2z` | **Data**: 2026-11-13 | **Spec**: [spec.md](spec.md)

## Resumo

O produto vendido ganha descrição, foto, seção e posição; entra a tabela de seções; nasce a tela
**Cardápio** da equipe (`/pedidos/cardapio`) com pré-visualização; e o cardápio do cliente passa a
mostrar seções, fotos e descrições. As regras ficam em `src/domain/menu/` (puras), as fotos passam
por duas portas novas (`PhotoProcessor` e `PhotoStorage`) e os testes ganham três coisas que o
projeto não tinha: a **matriz de telas** em dois motores de navegador, a **comparação de imagem** e
o **teste de mutação**. As regras TDD-001 a TDD-010 da spec viram travas automáticas na CI
([research.md, R11](research.md#r11-cada-linha-só-existe-se-um-teste-exigir)).

## Contexto técnico

| Item | Valor |
|---|---|
| Base | Mesma stack: Next.js 16 (App Router), React 19, TypeScript `strict`, PostgreSQL, Drizzle, Tailwind 4, Vitest 5, Playwright 1.63 |
| Dependências novas | `sharp` (tratar a foto), `@vercel/blob` (guardar a foto em produção); de desenvolvimento: `@stryker-mutator/core` e `@stryker-mutator/vitest-runner` |
| Serviço novo | Loja de arquivos Vercel Blob, só em produção, atrás da porta `PhotoStorage` |
| Migração | `0013_menu_editing` |
| Variáveis novas | `MENU_PHOTOS` (`memory`, `file`, `vercel-blob`), `MENU_PHOTO_DIR`, `BLOB_READ_WRITE_TOKEN` |
| Testes | Vitest (unidade e integração com PostgreSQL real), Playwright em Chromium e WebKit sobre a matriz de 9 telas, comparação de imagem, axe, Stryker |
| Desempenho | Primeira tela do cardápio em até 2 s em 4G lento e até 1 MB de fotos (SC-004); `getMenu` com uma consulta a mais (seções) |
| Restrições | Foto até 10 MB no aparelho, reduzida antes do envio (corpo até 4 MB); preço em decimal; nenhuma consulta ou foto cruza restaurantes |
| Escala | Dezenas de seções e até cerca de 200 produtos por restaurante |

Nenhum ponto em aberto: as três premissas da spec (vale na hora, produto novo com ingrediente, uma
foto por produto) seguem valendo.

## Constituição

| Princípio | Como a 013 cumpre |
|---|---|
| I. Testes primeiro | Mais apertado que a regra geral: `test(013) … (vermelho)` antes de cada `feat(013)`, 100% de cobertura do código novo, mutação no domínio, layout testado em cada tela (TDD-001 a TDD-010) |
| II. Domínio puro | `src/domain/menu/` sem banco, rede, React nem relógio: limites da foto, larguras, descrição, nome de seção, mover, montar o cardápio do cliente |
| III. Livro imutável | Não toca em movimentações nem em pedidos enviados. Foto, descrição, seção e ordem não criam versão do produto |
| IV. Precisão | O preço continua `numeric(12,2)` e passa pelo caso de uso da 008. Posição e larguras são inteiros, não dinheiro nem quantidade |
| V. Rastreabilidade | Permissão nova `menu.write` (gerente e chef); toda escrita e toda tentativa negada na trilha de auditoria; tudo por restaurante com RLS |
| VI. Docs vivas | Docs de produto e de sistema no PR da implementação (FR-012); glossário com os termos novos |
| VII. Simplicidade | Uma foto por produto, subir e descer em vez de arrastar, sem rascunho. A loja de arquivos e as ferramentas de teste novas estão justificadas em [Complexity Tracking](#complexity-tracking) |

Conferido de novo depois do desenho (modelo de dados e contratos): sem violação além das duas
justificadas.

## Decisões principais

Detalhes em [research.md](research.md).

- **R1 Fotos atrás de uma porta**: `PhotoStorage` com adaptadores `memory`, `file` e `vercel-blob`,
  como o `Mailer`. O banco guarda só a base do endereço e as larguras.
- **R2 O navegador reduz a foto** (lado maior até 1600 px) antes de enviar para
  `POST /api/cardapio/foto`: um caminho só em desenvolvimento, teste e produção, dentro do limite de
  corpo da plataforma. Os limites da spec são conferidos sobre o arquivo original.
- **R3 O servidor recorta em 4:3 e gera WebP** nas larguras 300, 600, 900 e 1200, sem metadados e
  na orientação certa (`sharp`, atrás da porta `PhotoProcessor`).
- **R4 Endereço aleatório e imutável** por envio; trocar a foto apaga os arquivos antigos depois do
  commit.
- **R5 `<img>` com `srcset`**, tamanho fixo 4:3 e carregamento sob demanda.
- **R6 Posições densas** por seção; subir e descer travam o grupo, aplicam a função pura `move` e
  regravam 1..n. A migração mantém a ordem alfabética de hoje.
- **R7 Colunas**: 1 abaixo de 640 px, 2 até 1023 px, 3 a partir de 1024 px.
- **R8 Pré-visualização em `iframe`** com o mesmo `MenuApp` em modo `preview`.
- **R9 Matriz de telas** num arquivo só, dois projetos novos do Playwright (`telas-chromium`,
  `telas-webkit`), asserções de layout com teste próprio.
- **R10 Comparação de imagem** com 60 referências, sempre dentro da imagem oficial do Playwright.
- **R11 Quatro travas de TDD**: ordem dos commits, cobertura de 100% do código novo, mutação no
  domínio, layout por asserção.
- **R12 Teste de peso e velocidade** em 4G lento simulado.
- **R13 Permissão `menu.write`**; trava otimista em descrição, seção e preço.
- **R14 `createMenuProduct`** numa transação; a foto vai em seguida.

## Modelo de dados (migração `0013_menu_editing`)

Detalhe em [data-model.md](data-model.md).

```text
menu_sections          name, name_normalized (único no restaurante), position     + editable
recipes (003)          + description (até 300), menu_section_id (nulo = "Outros"),
                         menu_position, photo_base, photo_widths
                       + índice recipes_menu_order (restaurant_id, kind, menu_section_id, menu_position)
```

## Casos de uso e rotas

Contratos em [contracts/use-cases.md](contracts/use-cases.md) e
[contracts/screens.md](contracts/screens.md).

- Gerente e chef (`menu.write`): `getMenuBoard`, `getMenuProduct`, `setMenuDetails`,
  `setProductPhoto`, `removeProductPhoto`, `moveProduct`, `createSection`, `renameSection`,
  `moveSection`, `deleteSection`, `createMenuProduct`, `getMenuPreview`.
- Reaproveitados: `setRecipeSalePrice` (008) e o "Esgotado hoje" (009).
- Público (estende a 009): `getMenu` devolve seções, descrição e foto, na ordem escolhida.
- Rotas: `/pedidos/cardapio`, `/pedidos/cardapio/novo`, `/pedidos/cardapio/[id]`,
  `/pedidos/cardapio/ver`, `/pedidos/cardapio/ver/cliente`, `POST /api/cardapio/foto` e, só com
  `MENU_PHOTOS=file`, `GET /fotos/...`.

## Estrutura

```text
src/domain/menu/              photo.ts (checkPhotoFile, variantWidths, photoSrcSet),
                              description.ts, section.ts, order.ts (move),
                              customer-menu.ts (buildCustomerMenu), cada um com teste
src/domain/access/            permissions.ts (+ menu.write)
src/domain/ordering/          menu.ts (buildMenu passa a ordenar por seção e posição)
src/application/menu/         board.ts, details.ts, photo.ts, sections.ts, order.ts,
                              create-product.ts, preview.ts, ports.ts, *-input.ts
src/application/ordering/     menu.ts (seções, descrição, foto)
src/infra/photos/             sharp-processor.ts, memory-storage.ts, file-storage.ts,
                              vercel-blob-storage.ts
src/infra/db/                 schema/catalog.ts, migrations/0013_menu_editing.sql,
                              repositories/menu-repository.ts, ordering-repository.ts
src/actions/                  menu-board.ts
src/components/menu/          menu-board.tsx, section-form.tsx, move-buttons.tsx,
                              photo-field.tsx, reduce-photo.ts, upload-photo.ts,
                              description-field.tsx, product-menu-form.tsx, preview-frame.tsx
src/components/ordering/      menu-app.tsx (seções, preview), section-bar.tsx, product-card.tsx,
                              product-photo.tsx, dish-options.tsx (foto e descrição)
src/components/ui/            input.tsx, select.tsx, textarea.tsx (+ size="lg", 44 px)
src/components/layout/        nav.tsx (+ Cardápio, em Operação)
app/(app)/pedidos/cardapio/   page.tsx, novo/page.tsx, [id]/page.tsx, ver/page.tsx,
                              ver/cliente/page.tsx
app/api/cardapio/foto/        route.ts
app/fotos/[...path]/          route.ts (só MENU_PHOTOS=file)
tests/integration/menu/       seções, ordem, detalhes, foto, produto novo, prévia, permissões,
                              isolamento, auditoria, índice
tests/screens/                matrix.ts, layout.ts, layout.spec.ts, fixtures.ts,
                              customer-menu.spec.ts, menu-board.spec.ts, weight.spec.ts,
                              __screenshots__/
tests/e2e/                    menu-editing.spec.ts (fluxo do chef), accessibility.spec.ts
playwright.config.ts          + projetos telas-chromium e telas-webkit
stryker.config.json           mutação em src/domain/menu/
.github/workflows/ci.yml      + test:menu, test:mutation, job de telas na imagem do Playwright
docs/                         produto/pedidos/06-editar-o-cardapio.md, 02-cardapio-do-cliente.md,
                              estoque/09-controles-e-permissoes.md, sistema/01-tdd.md,
                              sistema/05-testes-de-tela.md, sistema/glossario.md
```

## Ordem de entrega

Cada passo começa pelo teste vermelho. Os passos 3 a 8 são fatias que funcionam sozinhas.

1. **Ferramentas de teste**: matriz, asserções de layout com o teste próprio, projetos `telas-*`,
   imagem do Playwright na CI, `pnpm test:menu` (100%), Stryker. Prova de fumaça com uma tela que
   já existe. Sem isso, nenhuma linha de tela pode ser exigida por teste.
2. **Domínio**: foto, descrição, seção, mover, cardápio do cliente; `menu.write`.
3. **Migração e repositórios**, com isolamento entre restaurantes e o índice.
4. **US2 Seções** e **US3 Ordem** na tela Cardápio (lista, criar, renomear, apagar, subir, descer).
5. **US1 Descrição e foto**: portas, adaptadores, rota de envio, campo de foto e de descrição.
6. **US4 Produto num lugar só**: preço e esgotado na mesma tela, produto novo.
7. **US6 Cardápio do cliente**: barra de seções, cartões, foto, tela do prato, em toda a matriz,
   com as referências de imagem e o teste de peso.
8. **US5 Pré-visualização**.
9. **Documentação** de produto e de sistema, glossário, `README` (loja de fotos no deploy).

## Riscos

- **Imagem do Playwright no ambiente de nuvem**: se o Docker não conseguir baixá-la, as referências
  de imagem e o WebKit rodam só na CI, pelo fluxo manual do R10. O passo 1 descobre isso cedo.
- **Stryker com Vitest 5**: se o executor não for compatível, usa-se o executor por comando (R11).
- **Tempo da CI**: 2 motores × 9 telas × 2 modos. Os testes de tela rodam em paralelo por projeto
  e só carregam os dados uma vez por arquivo; meta de até 10 minutos no job de telas.
- **Teste de 4G lento instável**: o limite de bytes é exato; o de tempo usa rede limitada sobre o
  build de produção e uma segunda tentativa só para esse teste, sem afrouxar o limite.
- **Páginas e Server Actions fora da medição de cobertura** (R11): ficam sem lógica e são cobertas
  pelos testes ponta a ponta e de tela.
- **Teste da 009 que espera ordem alfabética**: muda junto com a regra (R6); é a única expectativa
  antiga alterada.
- **Deploy**: sem a loja Blob criada e `MENU_PHOTOS=vercel-blob`, o envio de foto falha com aviso
  claro; o resto do cardápio funciona.

## Complexity Tracking

| Desvio do princípio VII | Por que é necessário | Alternativa mais simples e por que não |
|---|---|---|
| Loja de arquivos fora do PostgreSQL (Vercel Blob) | Foto pública servida pela rede de borda, com cache longo, sem acordar a aplicação nem o banco a cada foto vista | `bytea` no banco: cada foto viraria função e consulta, e o banco cresceria com dado que não é dele |
| Ferramentas de teste novas (WebKit, comparação de imagem na imagem do Playwright, Stryker) | O dono pediu o cardápio certo em cada aparelho e cada linha exigida por teste; sem elas TDD-003, TDD-004 e TDD-008 não são verificáveis | Só Chromium e só cobertura: não pega erro de layout do iPhone nem teste que não falha quando a regra muda |
