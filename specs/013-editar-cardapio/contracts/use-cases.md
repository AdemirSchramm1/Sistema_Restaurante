# Contratos: 013 — casos de uso e rotas

Mesmo formato dos contratos da [010](../../010-adicionais-retiradas/contracts/use-cases.md). Todo
caso de uso recebe o contexto de quem está logado e devolve `Result`; sem a permissão devolve
`FORBIDDEN` e grava a tentativa negada. Preço entra como string no formato brasileiro (`"9,00"`).

## Tela Cardápio (equipe)

| Caso de uso | Permissão | Entrada | Saída | Erros |
|---|---|---|---|---|
| `getMenuBoard` | `menu.write` | – | `MenuBoard` (abaixo) | – |
| `getMenuProduct` | `menu.write` | `id` | produto do quadro + `description`, `sectionId`, `version`, `soldOutToday`, seções para escolher | `NOT_FOUND`, `NOT_A_DISH` |
| `setMenuDetails` | `menu.write` | `id`, `version`, `description`, `sectionId \| null` | – | `INVALID_DESCRIPTION`, `NOT_FOUND` (produto ou seção), `NOT_A_DISH`, `STALE_RECORD` |
| `setProductPhoto` | `menu.write` | `id`, `bytes` | `{ photo }` | `PHOTO_TYPE`, `PHOTO_TOO_BIG`, `PHOTO_TOO_SMALL`, `NOT_FOUND`, `NOT_A_DISH`, `PHOTO_STORAGE_FAILED` |
| `removeProductPhoto` | `menu.write` | `id` | – | `NOT_FOUND`, `NO_CHANGE` |
| `moveProduct` | `menu.write` | `id`, `direction: "up" \| "down"` | – | `NOT_FOUND`, `NOT_A_DISH`, `NO_CHANGE` |
| `createSection` | `menu.write` | `name` | `{ id }` | `INVALID_NAME`, `NAME_IN_USE` |
| `renameSection` | `menu.write` | `id`, `version`, `name` | – | `INVALID_NAME`, `NAME_IN_USE`, `NOT_FOUND`, `STALE_RECORD` |
| `moveSection` | `menu.write` | `id`, `direction` | – | `NOT_FOUND`, `NO_CHANGE` |
| `deleteSection` | `menu.write` | `id` | `{ movedProducts: number }` | `NOT_FOUND` |
| `createMenuProduct` | `menu.write` e `recipe.write` | nome e linhas da 003 + `salePrice?`, `sectionId?`, `description?` | `{ id }` | os da criação da 003 + `INVALID_PRICE`, `INVALID_DESCRIPTION`, `NOT_FOUND` (seção) |
| `getMenuPreview` | `menu.write` | – | `CustomerMenu` (abaixo), sem acesso nem pedidos | – |

Reaproveitados sem mudança de contrato: `setRecipeSalePrice` (008, `recipe.write`) e o "Esgotado
hoje" (009, `product.sold_out`).

Erros novos em `ErrorCode`: `PHOTO_TYPE`, `PHOTO_TOO_BIG`, `PHOTO_TOO_SMALL`,
`PHOTO_STORAGE_FAILED` e `PHOTO_PREPARE_FAILED` (só no navegador: não deu para reduzir a foto e o
original passa de 4 MB; research R2). Os outros já existem (`NOT_A_DISH`, `INVALID_DESCRIPTION`, `NAME_IN_USE`…).

```ts
type Photo = { base: string; widths: number[] } | null;

type MenuBoard = {
  sections: {
    id: string | null; // null = "Outros"
    name: string;
    version: number | null;
    canMoveUp: boolean;
    canMoveDown: boolean;
    products: {
      id: string;
      name: string;
      price: string | null; // "28.00"; null = "Sem preço"
      active: boolean;
      soldOutToday: boolean;
      photo: Photo;
      canMoveUp: boolean;
      canMoveDown: boolean;
    }[];
  }[];
};
```

Seção sem produtos aparece para a equipe (para poder receber produtos); "Outros" só aparece se
tiver produtos.

## Cardápio do cliente (estende a rota pública da 009)

`MenuView` troca `products` por `sections` e mantém o resto (`restaurantName`, `tableName`,
`serverNow`, `expiresAt`, `ordersLeft`):

```ts
type CustomerMenu = {
  /** false quando nenhum produto tem seção: o cardápio não mostra títulos (US2.4). */
  showSectionTitles: boolean;
  sections: {
    id: string | null;
    name: string; // "Outros" para null
    products: (MenuProduct & { description: string | null; photo: Photo })[];
  }[];
};
```

Só entram produtos vendidos, ativos, com preço e não esgotados hoje (regra da 009); seção sem
nenhum deles não vem. A ordem é a das seções e, dentro de cada uma, a de `menu_position`.
`submitOrder` não muda.

## Portas novas (`src/application/menu/ports.ts`)

```ts
interface PhotoProcessor {
  /** Lê pelo conteúdo, gira, recorta 4:3 no centro e gera WebP nas larguras pedidas pelo domínio. */
  process(bytes: Uint8Array): Promise<Result<{ variants: { width: number; bytes: Uint8Array }[] }>>;
}

interface PhotoStorage {
  /** Grava as variantes em menu/{photoId}/{largura}.webp e devolve a base do endereço. */
  put(photoId: string, variants: { width: number; bytes: Uint8Array }[]): Promise<{ base: string }>;
  remove(base: string, widths: number[]): Promise<void>;
}
```

## Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /pedidos/cardapio` | `menu.write` | Tela Cardápio: seções, produtos, subir e descer, criar, renomear e apagar seção |
| `GET /pedidos/cardapio/novo` | `menu.write` e `recipe.write` | Produto novo (formulário da 003 + preço, seção, descrição, foto) |
| `GET /pedidos/cardapio/[id]` | `menu.write` | Foto, descrição, preço, seção, "Esgotado hoje"; link "Editar nome e ingredientes" |
| `GET /pedidos/cardapio/ver` | `menu.write` | Botões Celular, Tablet em pé, Tablet deitado e a moldura |
| `GET /pedidos/cardapio/ver/cliente` | `menu.write` | O cardápio do cliente em modo pré-visualização (conteúdo da moldura) |
| `POST /api/cardapio/foto` | `menu.write` | `multipart/form-data` com `recipeId` e `photo` (até 4 MB, já reduzida). `200 { photo }`; `400 { code }` para os erros de `setProductPhoto`; `401`/`403`; `413` acima de 4 MB |
| `GET /fotos/menu/{photoId}/{largura}.webp` | público | Só com `MENU_PHOTOS=file`: devolve o arquivo local; com outro valor, `404` |

Sem a permissão, as telas levam a "Sem acesso", como as demais. As demais escritas são Server
Actions em `src/actions/menu-board.ts`, uma por caso de uso, com `useFormAction` (o "Salvo" só
aparece com a confirmação do servidor, padrão da 012).

## Mensagens

| Código | Texto |
|---|---|
| `PHOTO_TOO_BIG` | A foto pode ter até 10 MB |
| `PHOTO_TYPE` | Use uma foto JPG, PNG ou WebP |
| `PHOTO_TOO_SMALL` | Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px |
| `PHOTO_STORAGE_FAILED` e falha de rede | Não foi possível enviar a foto. Tente de novo. |
| `PHOTO_PREPARE_FAILED` | Não foi possível preparar a foto neste aparelho. Use uma foto menor que 4 MB. |
| `INVALID_DESCRIPTION` | A descrição pode ter até 300 caracteres |
| `NAME_IN_USE` (seção) | Já existe a seção {nome} |
| `STALE_RECORD` | Outra pessoa mudou este produto. Recarregue a tela. |
| confirmação de apagar seção | Os {n} produtos de {nome} vão para Outros |
| faixa da pré-visualização | Pré-visualização: pedidos não são enviados |

## Ajustes feitos na implementação

- **Nome dos botões da foto**: "Tirar foto" na spec quer dizer tirar a foto do cardápio; para não
  confundir com fotografar, os botões são **Escolher foto**, **Tirar foto com a câmera** e **Tirar
  foto do cardápio** (este pede confirmação).
- **Salvar a foto é um passo**: depois de escolher, a prévia aparece no recorte do cartão com
  **Salvar foto** e **Cancelar** (US1.2: ver antes de salvar).
- **Cartão do cliente**: o botão continua **Adicionar {nome}** para todo produto (com opções, ele
  abre a tela do prato, como nas specs 009 e 010); foto e nome formam o botão **Ver {nome}**, que
  abre a tela do prato com a descrição inteira.
- **Foto não muda a `version` do produto**: só descrição, seção e preço sobem a trava otimista.
