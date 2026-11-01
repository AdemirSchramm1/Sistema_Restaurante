# Plano técnico: 002 — Simplificar o cadastro de itens e retirar os locais

**Branch**: `002-simplificar-cadastro` | **Data**: 2026-11-01 | **Spec**: [spec.md](spec.md)

## Resumo

Retirar do cadastro tudo o que não é usado no dia a dia (sanitário, fiscal, contagem, unidade de
receita e conversões do item) e reescrever os textos da tela em linguagem simples. Mesma stack e
arquitetura da [001](../001-cadastros-base/plan.md); nenhuma dependência nova.

## Contexto técnico

Igual à 001: Next.js (App Router), TypeScript `strict`, Drizzle + PostgreSQL 17 com RLS, Vitest,
Testcontainers e Playwright. Decimal exato em quantidade e preço.

## Constituição

| Princípio | Como a 002 cumpre |
|---|---|
| I. Testes primeiro | Testes de domínio, formulário e integração mudados antes do código (commits `test(002)` antes de `feat(002)`) |
| II. Domínio puro | `item.ts`, `location.ts` e `units.ts` continuam sem banco nem React |
| III. Livro imutável | Não muda (movimentações ainda não existem) |
| IV. Precisão | `purchase_factor` continua `numeric(14,4)`; a frase "1 Caixa = 20 kg" formata só na tela |
| V. Rastreabilidade | Auditoria mantida; rótulos antigos continuam no histórico para eventos já gravados |
| VI. Docs vivas | `docs/produto` e `docs/sistema` atualizados no mesmo PR; specs e tasks da 001 marcadas |
| VII. Simplicidade | É a própria feature: menos campos, menos regras |

## Decisões

- **Uma medida por item** (`stock_unit_id`). A quantidade usada em cada produto vai para a tela de
  Produtos (003), que aceita a medida do item ou uma menor da mesma família (g para kg).
- **Embalagem de compra opcional**: `purchase_unit_label` e `purchase_factor` passam a aceitar
  nulo, com o check `items_purchase_pair` (os dois juntos ou nenhum).
- **Migração destrutiva `0002_simplify_items`**: remove colunas e a tabela `item_unit_conversions`.
  Os dados apagados não eram usados por nenhuma outra feature. A quarentena antiga vira local comum
  (`is_system = false`) para o gerente poder inativá-la.
- **Tipos de local**: o enum do banco mantém `QUARANTINE` e `IN_TRANSIT` só para dados antigos; a
  tela oferece sete tipos simples.
- **Classe de armazenagem do grupo** fica no banco e na tela (como "Que tipo de coisa é"), mas não
  bloqueia mais em qual local o item fica.
- **Histórico**: `field-labels.ts` mantém os rótulos dos campos removidos para mostrar eventos
  antigos.

## Arquivos tocados

```text
src/domain/inventory/        item.ts, location.ts, units.ts, suggested-locations.ts
                             (removidos: allergens.ts, ean.ts)
src/application/inventory/   item-input.ts, location-input.ts, locations.ts, get-item.ts, item-audit.ts
src/components/items/        item-form.tsx, item-form-values.ts, item-locations.tsx
src/components/locations/    location-fields.tsx (removido: print-button.tsx)
src/components/groups/       group-labels.ts (textos da tela de grupos)
src/infra/db/                schema/catalog.ts, migrations/0002_simplify_items.sql, repositórios
app/(app)/estoque/           itens, locais, grupos (removido: locais/[id]/folha)
tests/                       integração e E2E atualizados
```

## Riscos

- Migração apaga dados: aceitável porque ainda não há restaurante em produção. Testada sobre um
  banco com dados da 001.

## US3 — Retirada dos locais

- Migração `0003_remove_locations`: apaga `item_locations`, `locations` e o enum `location_kind`.
  Nenhuma outra tabela aponta para elas.
- Saem `location.ts`, `suggested-locations.ts`, `location-input.ts`, `locations.ts`,
  `set-item-locations.ts`, os repositórios, `actions/locations.ts`, a tela `estoque/locais`, o
  quadro "Onde fica guardado" do item, o filtro por local da lista e as permissões
  `location.manage` e `item_location.manage`.
- Depois de criar a conta, a pessoa vai para `/estoque/itens`.
- O livro de movimentações (feature 004) terá um saldo por item, sem `location_id`.
