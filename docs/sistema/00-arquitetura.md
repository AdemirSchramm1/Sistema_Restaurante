# Arquitetura

> Status: **proposta inicial**. Pontos marcados *(a decidir)* são fechados no `speckit plan` da
> primeira feature e então atualizados aqui.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript `strict` |
| Interface | Tailwind CSS + shadcn/ui |
| Banco | PostgreSQL (Vercel Postgres/Neon ou outro gerenciado *(a decidir)*) |
| Acesso a dados | ORM com migrações versionadas — sugestão: Drizzle ORM *(a decidir)* |
| Validação | Zod (entrada de formulários, Server Actions e rotas) |
| Decimais | `decimal.js` (ou similar) no TS; `numeric(p,s)` no PostgreSQL |
| Autenticação | *(a decidir: Auth.js, Clerk ou Supabase Auth)* |
| Testes | Vitest, Testing Library, PostgreSQL em container (Testcontainers), Playwright |
| Deploy | Vercel (preview por PR, produção na `main`) |
| CI | GitHub Actions: lint, typecheck, testes |

## Camadas

```text
┌──────────────────────────────────────────────┐
│ app/  (rotas, páginas, Server Actions)       │  ← fino: valida entrada, chama aplicação
├──────────────────────────────────────────────┤
│ src/application/  (casos de uso)             │  ← orquestra: carrega, chama domínio, grava
├──────────────────────────────────────────────┤
│ src/domain/  (regras puras)                  │  ← sem banco, sem React, sem Date.now()
├──────────────────────────────────────────────┤
│ src/infra/  (banco, repositórios, integrações)│  ← SQL, ORM, NF-e, PDV
└──────────────────────────────────────────────┘
```

- **Domínio** não importa nada de `application`, `infra` ou `app`. Regra checada por lint
  (`eslint-plugin-boundaries` ou `dependency-cruiser`).
- **Casos de uso** recebem dependências (repositórios, relógio, gerador de ID) por parâmetro, o que
  permite testar com implementações em memória.
- **Server Actions / rotas** fazem só: autenticar, validar com Zod, chamar o caso de uso, devolver
  resultado.

## Estrutura de pastas proposta

```text
app/
  (auth)/...
  (app)/estoque/
    itens/page.tsx
    movimentacoes/page.tsx
    ...
src/
  domain/
    shared/            # Decimal, Quantity, Unit, Money, Result
    inventory/
      units.ts         # conversões
      average-cost.ts
      reorder.ts       # ES, PP, par, quantidade a pedir
      cogs.ts
      recipe.ts
      expiry.ts
      *.test.ts        # testes ao lado do código
  application/
    inventory/
      register-entry.ts
      register-exit.ts
      ...
  infra/
    db/
      schema/          # tabelas
      migrations/
      repositories/
  components/          # componentes React (shadcn/ui em components/ui)
tests/
  integration/         # casos de uso + banco real
  e2e/                 # Playwright
docs/
specs/
.specify/
```

## Multi-tenant (SaaS)

- Toda tabela de negócio tem `restaurant_id`.
- Repositórios recebem o `restaurant_id` do usuário autenticado; nunca do cliente.
- Defesa em profundidade: Row Level Security no PostgreSQL *(a decidir na feature 001)*.
- Teste obrigatório: usuário do restaurante A não lê nem grava dados do restaurante B.

## Decisões em aberto

| Decisão | Opções | Quando |
|---|---|---|
| ORM | Drizzle × Prisma | `speckit plan` da feature 001 |
| Autenticação | Auth.js × Clerk × Supabase Auth | `speckit plan` da feature 001 |
| Provedor PostgreSQL | Vercel Postgres/Neon × Supabase × outro | `speckit plan` da feature 001 |
| RLS | Sim × só filtro na aplicação | `speckit plan` da feature 001 |
| Saldo negativo em vendas | Permitir com alerta × bloquear | `speckit clarify` da feature 003 |

Registre cada decisão tomada como ADR curto em `docs/sistema/adr/NNNN-titulo.md`.
