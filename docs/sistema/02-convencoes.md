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

## Datas

- Banco: `timestamptz` (UTC). Datas sem hora (validade, data do fato contábil): `date`.
- Fuso de apresentação: configurado por restaurante (padrão `America/Sao_Paulo`).

## Banco

- Tabelas no plural, `snake_case`. Chave primária `id uuid` (gerado na aplicação, UUID v7).
- Toda tabela de negócio: `restaurant_id`, `created_at`, `created_by`.
- Migrações versionadas no repositório; nunca alterar migração já aplicada em produção.
- Tabelas de livro (movimentações, registros sanitários) **não têm `updated_at`**: são só inserção.

## Erros

- Domínio retorna `Result<T, ErroDeDominio>` para regras de negócio violadas (ex.: unidade
  incompatível); exceções só para falhas inesperadas.
- Mensagens de erro de domínio têm código estável (`ITEM_UNIT_LOCKED`) e texto em português na UI.

## Git

- Branch por feature: `NNN-nome-da-feature` (igual à pasta em `specs/`).
- Commits no padrão Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- PR pequeno, ligado à spec, com docs atualizadas.
