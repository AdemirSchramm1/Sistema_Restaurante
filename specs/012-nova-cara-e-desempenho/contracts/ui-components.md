# Contrato dos componentes do padrão — 012

Componentes em `src/components/ui/` (e `src/components/layout/` para o casco da tela). Nenhum
componente recebe cor solta: a cor vem do `variant` ou do `tone`. Detalhes de uso em
[docs/sistema/03-padroes-do-front.md](../../../docs/sistema/03-padroes-do-front.md).

## `Button` / `buttonVariants` (`ui/button.tsx`)

| Prop | Valores | Padrão |
|---|---|---|
| `variant` | `default` (páprica), `secondary`, `outline`, `ghost`, `destructive`, `success`, `link` | `default` |
| `size` | `sm` (32 px), `default` (40 px), `lg` (44 px), `xl` (48 px, toque na cozinha e no caixa), `icon` | `default` |

`buttonVariants()` dá as mesmas classes para `<Link>` com cara de botão.

## `Badge` (`ui/badge.tsx`)

`tone`: `neutral`, `primary`, `success`, `warning`, `danger`, `info`. Padrão `neutral`. Fundo suave e
texto escuro da mesma cor (contraste ≥ 4,5:1).

## `Alert` (`ui/alert.tsx`)

`tone`: `error` (`role="alert"`), `warning`, `info`, `success` (`role="status"`). Mostra o ícone do tom
(decorativo) e o texto.

## `Card`, `CardHeader`, `CardTitle`, `CardDescription` (`ui/card.tsx`)

Cartão com borda, fundo `card` e sombra leve. `CardTitle` é `h2` por padrão (`as` muda o nível).

## `Input`, `Select`, `Textarea`, `Label`, `Checkbox` (`ui/input.tsx`)

Altura 40 px, borda `input`, anel de foco páprica, `aria-invalid` pinta a borda de beterraba.

## `Table`, `Th`, `Td` (`ui/table.tsx`)

Cabeçalho em `muted`, linhas com realce ao passar o mouse. `Td numeric` alinha à direita com
números tabulares.

## `TextLink` (`ui/text-link.tsx`)

`<Link>` com a cor e o sublinhado do padrão. Aceita as props do `next/link`.

## `PageHeader` (`layout/page-header.tsx`)

| Prop | Tipo | Uso |
|---|---|---|
| `title` | texto | vira o `h1` da tela, na fonte de títulos |
| `description` | texto, opcional | frase curta do que a tela faz |
| `actions` | nós React, opcional | botões e links à direita (abaixo do título no celular) |
| `badges` | nós React, opcional | selos ao lado do título (inativo, esgotado hoje, código do item) |
| `back` | `{ href, label }`, opcional | link "voltar" acima do título |

## `ActionForm` (`forms/action-form.tsx`)

Formulário curto ligado a uma Server Action: campos escondidos (`hidden`), filhos opcionais e um
botão (`submitLabel`, `variant` padrão `outline`, `size` padrão `sm`). Mostra a recusa do servidor
e, se houver `successMessage`, o aviso de salvo, que some enquanto o próximo envio está a caminho.
Substitui os antigos `*-active-toggle` (inativar item e produto, bloquear fornecedor).

## `useFormAction` (`forms/use-form-action.ts`)

Devolve `state`, `pending`, `error`, `formProps` e `saved`. `saved` é verdadeiro só quando o servidor
confirmou o último envio e nenhum outro está a caminho: é ele que liga o aviso "Alterações salvas"
de todos os formulários.

## `BarList` (`reports/bar-list.tsx`)

`title`, `rows` (`{ key, label, href?, amount, valueText, detail? }`) e `color` (1 a 4, as cores
`chart-*` do tema; padrão 1). `PairedBars` usa as cores 1 e 2.

## `Brand`, `BrandMark` (`layout/brand.tsx`)

`BrandMark` é o chapéu de cozinheiro em páprica (decorativo). `Brand` junta a marca, o nome
(`name`) e uma legenda opcional (`caption`); aparece no menu lateral, nas telas de entrada e em
"não encontrado".

## `EmptyState` (`ui/empty-state.tsx`)

`title` (texto), `children` (explicação, opcional), `action` (opcional), `icon` (ícone do Lucide,
opcional, decorativo).

## Casco da tela (`layout/app-shell.tsx`, `layout/nav.tsx`)

- `NAV` e `navFor(roles)` mantêm a ordem e as permissões de hoje; cada entrada ganha `section`
  (`stock`, `operation`, `settings`) e `icon`.
- `navSections(roles)` agrupa as entradas visíveis por área, na ordem Estoque, Operação,
  Configuração, sem trocar a ordem dos links.
- `activeHref(pathname, hrefs)` devolve o link mais específico que casa com o endereço (ou `null`).
- `MainNav` continua `<nav aria-label="Menu principal">` com um link por tela; o ativo leva
  `aria-current="page"`.
- `AppShell` monta o menu lateral (≥ 1024 px) e a barra do topo com o botão "Menu" (menor), o link
  "Pular para o conteúdo" e o `main id="conteudo"`.
