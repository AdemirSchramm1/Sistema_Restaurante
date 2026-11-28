# Quickstart: 018 — conferir a validação

Precisa de Docker (PostgreSQL) e das dependências instaladas (`pnpm install`).

```bash
pnpm db:up
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

pnpm test:mutation      # 100%: todo o domínio
pnpm test:billing       # 100%: conta da mesa
pnpm test:stock         # 100%: estoque
pnpm test:orders        # 100%: pedido, adicionais, mesas, fornecedores
pnpm build && scripts/screens.sh tests/screens/operations.spec.ts   # Cozinha, Garçom, Conta, Lançamentos
```

Roteiro de prova manual (US1, US5): em `src/domain/billing/split.ts`, apague a linha que recusa
valor negativo e rode `pnpm vitest run --project unit split`: algum teste tem de falhar. Desfaça.

Conferir os registros: `mutants.md` não tem linha sem decisão; `rules.md` não tem regra sem teste.
