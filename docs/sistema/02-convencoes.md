# Convenções de código

## Idioma

- **Documentação, specs, mensagens de interface e nomes de teste:** português do Brasil.
- **Código** (variáveis, funções, tipos, tabelas, colunas): inglês, exceto termos de domínio sem
  tradução boa, que seguem o [glossário](glossario.md). Ex.: tabela `stock_movements`, função
  `calculateReorderPoint`; nome de teste "calcula o ponto de pedido do exemplo do filé mignon".

> *(Se preferir nomes em português também no código, altere esta regra, o glossário e a
> constituição no mesmo PR.)*

## Números

- Dinheiro e quantidade: **sempre decimal**. No banco, `numeric(14,4)` para quantidade e
  `numeric(14,4)` para custo unitário; `numeric(14,2)` para valores monetários totais.
- Proibido `parseFloat` / aritmética com `number` para esses valores (lint customizado ou revisão).
- Arredondamento: meio para cima (half-up) só na apresentação ou no ponto definido pela spec.
- Reais na tela: `formatBrl` (`src/domain/shared/decimal.ts`) → "R$ 1.234,50". Nos componentes do
  cliente, que recebem o valor como texto, `brl` e `priceOrFree` (`src/components/ordering/format.ts`).
  Nunca montar "R$" à mão.

## Datas

- Banco: `timestamptz` (UTC). Datas sem hora (data do fato contábil): `date`.
- Fuso de apresentação: configurado por restaurante (padrão `America/Sao_Paulo`). O dia de negócio
  sai de `businessDay(agora, fuso)`; os lançamentos do estoque usam `movementToday(agora)` (Brasília).

## Banco

- Tabelas no plural, `snake_case`. Chave primária `id uuid` (gerado na aplicação, UUID v7).
- Toda tabela de negócio: `restaurant_id`, `created_at`, `created_by`.
- Migrações versionadas no repositório; nunca alterar migração já aplicada em produção.
- Tabelas de livro (movimentações, auditoria) **não têm `updated_at`**: são só inserção.

## Entrada (formulários e URL)

- Leitores de formulário em `src/application/**/*-input.ts`, um por formulário, só com formato: a
  regra fica no domínio. Use as peças comuns de `src/application/form-input.ts`: `formText` (texto
  aparado), `optionalText` (em branco vira `null`), `optionalDecimal` (vírgula decimal; em branco
  vira `null`), `isId` (UUID), `componentRef` (`"ITEM:id"` / `"RECIPE:id"`) e `formDataToObject`.
- Filtros da URL (`searchParams`): `firstParam` (`src/lib/search-params.ts`).
- Junções em memória: `groupBy` (`src/domain/shared/collections.ts`), nunca `filter` dentro de `map`.

## Interface

- Cores, fontes e componentes seguem os [padrões do front](03-padroes-do-front.md). Cor crua do
  Tailwind (`bg-red-500`, `text-white`) é barrada por teste.
- Formulário com Server Action: `useFormAction` (mantém o que foi digitado quando o servidor recusa)
  e, para o aviso de salvo, o `saved` dele, que some enquanto o próximo envio está a caminho.
  Formulário curto de um botão: `ActionForm`.
- Formatação: Prettier (`pnpm format`); a CI roda `pnpm format:check`.

## Erros

- Domínio retorna `Result<T, ErroDeDominio>` para regras de negócio violadas (ex.: unidade
  incompatível); exceções só para falhas inesperadas.
- Mensagens de erro de domínio têm código estável (`ITEM_UNIT_LOCKED`) e texto em português na UI.

## Git

- Branch por feature: `NNN-nome-da-feature` (igual à pasta em `specs/`).
- Commits no padrão Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- PR pequeno, ligado à spec, com docs atualizadas.
