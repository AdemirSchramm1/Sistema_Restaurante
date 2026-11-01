# ADR 0001 — ORM: Drizzle

- **Status**: aceito · **Data**: 2026-10-31 · **Feature**: [001](../../../specs/001-cadastros-base/research.md#r1-orm-e-migrações)
- **Contexto**: precisamos de migrações versionadas e de recursos do PostgreSQL que ORMs modelam mal
  (RLS, índice único parcial, triggers), com `numeric` sem passar por `number`.
- **Decisão**: Drizzle ORM + drizzle-kit; SQL manual na mesma pasta de migrações quando preciso.
- **Consequências**: schema em TypeScript, migrações em SQL legível; `numeric` chega como string e é
  convertido para `Decimal` no repositório. Alternativas: Prisma, Kysely.
