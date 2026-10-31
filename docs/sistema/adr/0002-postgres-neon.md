# ADR 0002 — Provedor PostgreSQL: Neon

- **Status**: aceito · **Data**: 2026-10-31 · **Feature**: [001](../../../specs/001-cadastros-base/research.md#r2-provedor-postgresql)
- **Contexto**: deploy na Vercel, preview por PR, testes com PostgreSQL real em container.
- **Decisão**: Neon (PostgreSQL 17) via integração da Vercel, com branch de banco por preview. Testes
  usam `postgres:17` puro (Testcontainers). Nenhum recurso exclusivo do provedor no código.
- **Consequências**: trocar de provedor é trocar a string de conexão. Alternativas: Supabase, RDS.
