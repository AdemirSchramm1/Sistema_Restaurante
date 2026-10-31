# ADR 0004 — Isolamento de restaurantes com RLS

- **Status**: aceito · **Data**: 2026-10-31 · **Feature**: [001](../../../specs/001-cadastros-base/research.md#r4-isolamento-entre-restaurantes-rls)
- **Contexto**: constituição, princípio V: nenhuma consulta cruza tenants.
- **Decisão**: duas barreiras. Repositórios filtram por `restaurantId` vindo da sessão; e RLS em toda
  tabela com `restaurant_id`, com política `restaurant_id = current_setting('app.restaurant_id')::uuid`.
  Cada transação faz `set_config('app.restaurant_id', $1, true)` (`withTenantTx`). A aplicação usa
  um papel sem `BYPASSRLS`; migrações usam o papel dono.
- **Consequências**: toda escrita e leitura de negócio passa por `withTenantTx`; teste de isolamento
  roda com e sem o filtro da aplicação. Alternativas: só filtro na aplicação; schema por tenant.
