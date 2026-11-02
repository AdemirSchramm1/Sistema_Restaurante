# Plano técnico: 003 — Produtos

**Branch**: `claude/project-thread-8lg7o1` | **Data**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Resumo

Nova tela **Produtos** com as linhas (item + quantidade). Cada edição grava uma versão nova e
imutável. Custo calculado no domínio a partir do custo médio do item. Mesma stack e camadas da
[001](../001-cadastros-base/plan.md); nenhuma dependência nova.

## Contexto técnico

Next.js (App Router), TypeScript `strict`, Drizzle + PostgreSQL 17 com RLS, Vitest,
Testcontainers e Playwright. `decimal.js` para quantidade e custo.

## Constituição

| Princípio | Como a 003 cumpre |
|---|---|
| I. Testes primeiro | Cada tarefa de código vem depois do teste correspondente em `tasks.md` (commits `test(003)` antes de `feat(003)`) |
| II. Domínio puro | `recipe.ts` (validação das linhas) e `recipe-cost.ts` (custo) sem banco nem React; data da versão recebida como parâmetro |
| III. Livro imutável | Não mexe em movimentações. As versões do produto seguem a mesma ideia: só inserção |
| IV. Precisão | `quantity numeric(14,4)`; conversão só por `convert` em `units.ts`; arredondamento só na tela |
| V. Rastreabilidade | Auditoria `recipe` em criar, editar, inativar e reativar; RLS em `recipes`, `recipe_versions`, `recipe_lines` |
| VI. Docs vivas | `docs/produto/estoque/04-fichas-tecnicas.md`, `docs/sistema/estoque/01-modelo-de-dados.md`, glossário e roadmap no mesmo PR |
| VII. Simplicidade | Sem sub-receitas, sem índices de rendimento; versão = cópia completa das linhas |

## Modelo de dados

```text
recipes          id, restaurant_id, name, name_normalized, active, current_version_id,
                 created_*/updated_*/version (trava otimista, como em items)
                 unique (restaurant_id, name_normalized) where active
recipe_versions  id, restaurant_id, recipe_id, number, valid_from timestamptz, created_by
                 unique (recipe_id, number)  — só inserção (trigger bloqueia UPDATE/DELETE)
recipe_lines     id, restaurant_id, recipe_version_id, item_id, quantity numeric(14,4) > 0, unit_id
                 unique (recipe_version_id, item_id)  — só inserção
```

- Compatibilidade de família entre `unit_id` da linha e `stock_unit_id` do item: validada no domínio
  e no caso de uso (o banco não tem check entre tabelas; um teste de integração cobre).
- Migração `0004_recipes` com políticas RLS iguais às de `items`.
- Versão vigente numa data: maior `valid_from` ≤ data (função de domínio + consulta no repositório),
  usada pela 005.

## Decisões

- **Nome no código `recipe`** (glossário), na tela "Produto".
- **Versão como cópia completa** das linhas: simples e fácil de ler; volume pequeno.
- **Salvar sem mudança não cria versão** (compara linhas normalizadas no domínio).
- **Item inativado depois** continua nas versões existentes; só não pode entrar em linha nova.
- **Permissão nova** `recipe.write` para gerente e chef.

## Arquivos

```text
src/domain/inventory/        recipe.ts, recipe-cost.ts (+ testes)
src/domain/access/           permissions.ts (recipe.write)
src/application/inventory/   recipe-input.ts, create-recipe.ts, update-recipe.ts,
                             set-recipe-active.ts, list-recipes.ts, get-recipe.ts
src/infra/db/                schema/catalog.ts, migrations/0004_recipes.sql, recipe-repository.ts
src/actions/                 recipes.ts
src/components/recipes/      recipe-form.tsx (linhas dinâmicas, busca de item, medida filtrada)
app/(app)/estoque/produtos/  page.tsx, novo/page.tsx, [id]/page.tsx
tests/                       integração e E2E
```

## Riscos

- Formulário com linhas dinâmicas é o primeiro do projeto: manter o que foi digitado quando o
  servidor recusa (padrão de `use-form-action.ts`).
- Custo vazio até a 004: a tela precisa deixar claro "Sem custo ainda" para não parecer erro.
