# Padrões do front

> Criado na spec 012. O contrato de cada componente (props e valores) está em
> [specs/012-nova-cara-e-desempenho/contracts/ui-components.md](../../specs/012-nova-cara-e-desempenho/contracts/ui-components.md);
> aqui ficam as regras de uso.

## Identidade

O sistema é de restaurante, então a paleta vem da cozinha. Cada cor tem **nome por função**, nunca
por cor: quem escreve `bg-primary` não precisa saber que é páprica, e o modo escuro troca tudo junto.

| Função (token) | Nome | Uso |
|---|---|---|
| `primary` | Páprica | ação principal, link, item ativo, destaque de preço |
| `success` | Manjericão | deu certo, pago, pronto, entregue |
| `warning` | Açafrão | atenção, Repor, pedido recebido |
| `destructive` / `danger-soft` | Beterraba | erro, apagar, cancelar, atrasado |
| `info` | Mirtilo | informação neutra |
| `background`, `card`, `muted` | Creme | fundos |
| `foreground`, `muted-foreground` | Café | texto |
| `sidebar*` | Lousa | menu lateral (lousa de cardápio) |
| `chart-1` a `chart-4` | Páprica, açafrão, manjericão, mirtilo | barras dos gráficos |

- As cores ficam em OKLCH nas variáveis de `app/globals.css`, com uma segunda tabela para
  `prefers-color-scheme: dark`. O modo escuro segue o sistema da pessoa; não há botão.
- Cada função tem a cor cheia (`bg-success`, com `text-success-foreground`) e a suave
  (`bg-success-soft`, com `text-success-soft-foreground`). Selo, aviso e fundo de linha usam a suave;
  botão usa a cheia.
- **Cor crua é proibida** em `app/` e `src/components/`: uma classe da paleta do Tailwind
  (`bg-red-500`, `text-white`, `bg-black/40`…) faz `src/components/ui/no-raw-colors.test.ts` falhar.
  Cor em hexadecimal só existe na regra de impressão de `globals.css` e na cor da barra do navegador
  (`themeColor`, em `app/layout.tsx`), que não aceita variável.
- **Contraste**: todo par de texto e fundo passa 4,5:1 e toda cor que não é texto (borda de campo,
  anel de foco, barras dos gráficos) passa 3:1, nos dois modos. Quem confere é
  `src/components/ui/tokens.test.ts`, que converte OKLCH para sRGB (`src/lib/contrast.ts`).

### Fontes

- **Inter** no texto, com números tabulares (`tabular-nums`) em valores e tabelas.
- **Fraunces** (`font-display`), serifada como um cardápio, só em títulos: o `h1` da tela (já vem no
  `PageHeader`), o nome da mesa e os títulos das telas de operação (cozinha, garçom, caixa,
  cardápio do cliente).
- As duas vêm do `next/font` (`app/layout.tsx`): baixadas no build e servidas pelo próprio domínio,
  sem chamada ao Google quando a tela abre e sem salto de layout.

## Componentes

Use o componente do padrão antes de escrever classes. Todos estão em `src/components/ui/` e
`src/components/layout/`, com teste ao lado.

| Para | Use | Observações |
|---|---|---|
| Título da tela, voltar, selos e ações | `PageHeader` | Toda tela da equipe começa com ele. É o único `h1`. |
| Botão, ou link com cara de botão | `Button`, `buttonVariants()` | `size="xl"` (48 px) nas ações principais da cozinha, do caixa e do cardápio do cliente. `destructive` só para apagar ou cancelar. |
| Formulário curto (campos escondidos + um botão) | `ActionForm` | Inativar, bloquear, esgotado hoje, revogar convite. Mostra o erro do servidor e aceita `size` e `variant`. |
| Link no meio do texto ou da tabela | `TextLink` | Nunca `<a>` ou `<Link>` com classes próprias. |
| Situação curta (inativo, esgotado, atrasado) | `Badge` com `tone` | `neutral`, `primary`, `success`, `warning`, `danger`, `info`. |
| Mensagem que pede atenção | `Alert` com `tone` | `error` vira `role="alert"`; `success` vira `role="status"`. |
| Bloco de conteúdo | `Card`, `CardTitle` | `CardTitle` é `h2`; use `as="h3"` dentro de outro cartão. |
| Lista vazia | `EmptyState` | Diz o que fazer, não só "nada aqui". |
| Campos | `Input`, `Select`, `Textarea`, `Label`, `Checkbox` | 40 px de altura; `aria-invalid` pinta a borda de beterraba. |
| Tabela | `Table`, `Th`, `Td` | `Td numeric` para valores (direita e números tabulares). |
| Barras de gráfico | `BarList` | `color` de 1 a 4 escolhe a cor do gráfico. |
| Marca | `Brand`, `BrandMark` | Menu lateral, telas de entrada e "não encontrado". |
| Campo de 44 px | `Input`, `Select`, `Textarea` com `size="lg"` | Cardápio do cliente e tela Cardápio, onde todo alvo de toque tem 44 px. |
| Foto do produto | `ProductPhoto` (`src/components/ordering/product-photo.tsx`) | Sempre 4:3, `srcset` das larguras guardadas, `sizes` da largura real do cartão, `lazy` fora das duas primeiras. Sem foto, não desenha nada. |
| Cartão do produto | `ProductCard` | Foto e nome abrem a tela do prato; descrição em 3 linhas (`data-clamp`); botão "Adicionar". |
| Barra de seções | `SectionBar` | Presa no topo; com muitas seções rola para o lado só dentro dela. Marca a seção na tela com `aria-current`. |
| Moldura de pré-visualização | `PreviewFrame` | "Ver como o cliente": Celular, Tablet em pé e Tablet deitado. |

### Casco da tela

- `AppShell` monta o menu lateral (a partir de 1024 px) e, no celular, a barra do topo com o botão
  "Menu". Tem o link "Pular para o conteúdo" e o `main id="conteudo"`.
- O menu vem de `NAV` em `src/components/layout/nav.tsx`. **Tela nova no menu** = uma entrada com
  `href`, `label`, a permissão (`action`), a área (`stock`, `operation` ou `settings`) e um ícone do
  Lucide. A ordem e as permissões de `navFor` são as mesmas da tela inicial de cada papel
  (`homeFor`).

## Telas

- **Estrutura**: `PageHeader`, depois o conteúdo em `grid gap-6`. Duas colunas com
  `lg:grid-cols-[…] items-start`, para um cartão curto não esticar até a altura do vizinho.
- **Dinheiro**: `formatBrl` (`src/domain/shared/decimal.ts`) no servidor; `brl` e `priceOrFree`
  (`src/components/ordering/format.ts`) nos componentes do cliente, que recebem o valor como texto
  (`"28.00"`). Nunca montar "R$" à mão.
- **Filtros da URL**: `firstParam` (`src/lib/search-params.ts`); um valor repetido ou vazio vira
  `undefined`.
- **Toque**: alvos de pelo menos 44 px no celular e na cozinha (`h-11`, `size="lg"` ou `xl`).
- **Acessibilidade**: um `h1` por tela, ícones decorativos com `aria-hidden`, o link ativo do menu
  com `aria-current="page"`, anel de foco visível. Os testes de ponta a ponta passam o axe
  (WCAG 2.1 AA) nas telas principais.
- **Texto**: português do Brasil, verbo no botão ("Salvar exceção", "Começar preparo"), e a tela
  vazia explica o próximo passo.
- **Grade que encolhe**: em tela estreita, `grid` sem colunas definidas deixa o filho mais largo
  (uma barra que rola, um botão com `whitespace-nowrap`) esticar a página. Use `grid-cols-1` e
  linhas com `flex-wrap`. Os testes de tela pegam isso em 320 px e com a letra em 200%.
- **Telas que mudam de tamanho**: o cardápio do cliente e a tela Cardápio são testados na matriz de
  [05-testes-de-tela.md](05-testes-de-tela.md). Classe de layout nova nasce de uma asserção
  vermelha ali.
- **Janela modal**: com `aria-modal`, a janela vai para o `body` (`createPortal`) e o `main` fica
  `inert` enquanto ela está aberta, para o foco e a leitura de tela não saírem dela (ver a
  conferência do pedido em `cart.tsx`).
- **Impressão**: `.no-print` some na impressão; a conta da mesa usa `.tab-print` (80 mm ou A4).

## Como mudar o padrão

- **Cor nova**: variável no `:root` e no modo escuro, linha no `@theme inline`, par no
  `tokens.test.ts` (texto ou não texto) e linha na tabela acima, no mesmo PR.
- **Componente novo do padrão**: teste primeiro em `src/components/ui/`, depois o componente, e uma
  linha na tabela de componentes.
- **Tela nova**: `PageHeader`, entrada no `NAV` se for para o menu e, se for tela principal, o axe
  no teste de ponta a ponta.
