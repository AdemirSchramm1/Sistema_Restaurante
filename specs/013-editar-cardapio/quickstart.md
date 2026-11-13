# Como conferir a 013

Guia de validação. Modelo em [data-model.md](data-model.md), contratos em
[contracts/](contracts/).

## Preparar

```bash
pnpm install
pnpm db:up && pnpm db:migrate && pnpm db:dev-login   # na nuvem: inicie o dockerd antes
MENU_PHOTOS=file MENU_PHOTO_DIR=.menu-photos pnpm dev
```

Em produção: criar a loja Blob no projeto da Vercel (ela define `BLOB_READ_WRITE_TOKEN`) e
`MENU_PHOTOS=vercel-blob`.

## Pela tela

1. Entrar como chef. O menu mostra **Cardápio** em Operação; como estoquista, não mostra e
   `/pedidos/cardapio` leva a "Sem acesso".
2. Criar as seções "Entradas", "Lanches" e "Bebidas"; criar "lanches" de novo mostra "Já existe a
   seção Lanches". Subir "Bebidas" e ver a ordem mudar.
3. Abrir o X-Burger: escolher a seção "Lanches", escrever a descrição (o contador mostra quanto
   falta) e enviar uma foto. A prévia aparece no recorte do cartão antes de salvar; depois, "Salvo".
4. Tentar um PDF ("Use uma foto JPG, PNG ou WebP"), uma foto de 12 MB ("A foto pode ter até 10
   MB") e uma de 400 px ("Essa foto é pequena…").
5. **Novo produto**: "Suco de laranja", item "Laranja" 300 g, R$ 9,00, seção "Bebidas", foto e
   descrição. Ele aparece no fim de "Bebidas".
6. Em "Lanches", subir o X-Salada para antes do X-Burger.
7. **Ver como o cliente**: alternar Celular, Tablet em pé e Tablet deitado; ver 1, 2 e 3 colunas e
   a faixa "Pré-visualização: pedidos não são enviados".
8. Ler o QR code de uma mesa no celular: barra de seções no topo, cartões com foto, descrição e
   preço, X-Salada antes do X-Burger; tocar no cartão abre a foto maior e a descrição inteira. O
   pedido continua funcionando como antes.
9. Com o cardápio aberto no celular, trocar a foto do X-Burger no computador: em até 10 segundos o
   celular mostra a nova, sem perder o carrinho.
10. Apagar a seção "Entradas" com produtos: a confirmação diz quantos vão para "Outros".
11. Em Auditoria, ver cada mudança com quem e quando.

## Pelos testes

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test:unit && pnpm test:integration
pnpm test:menu          # 100% do código novo da 013
pnpm test:mutation      # todo mutante de src/domain/menu morto
pnpm build && pnpm test:e2e
pnpm test:screens       # 9 telas, claro e escuro, Chromium e WebKit, na imagem do Playwright
```

Esperado: tudo verde; `test:menu` em 100% de linhas, desvios e funções; `test:mutation` sem
mutante vivo; `test:screens` sem diferença de imagem acima de 0,1%; nenhum teste pulado.

## Conferir o TDD no histórico

```bash
git log --oneline main..HEAD | grep "(013)"
```

Esperado: cada `feat(013)` tem antes dele um `test(013) … (vermelho)` do mesmo assunto.
