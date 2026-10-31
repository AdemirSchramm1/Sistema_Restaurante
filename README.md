# Sistema Restaurante

ERP para restaurantes, entregue como SaaS. O primeiro módulo é o de **Estoque**.

## Stack

Next.js · React · TypeScript · PostgreSQL · Vercel · Tailwind CSS · shadcn/ui — com
**Desenvolvimento Guiado por Testes (TDD)** obrigatório.

## Como o projeto está organizado

| Pasta                                                     | Conteúdo                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| [`docs/produto/`](docs/produto/estoque/00-visao-geral.md) | Como o sistema funciona para o usuário (regras de negócio)        |
| [`docs/sistema/`](docs/sistema/00-arquitetura.md)         | Como o código funciona (arquitetura, TDD, modelo de dados)        |
| [`.specify/`](.specify/memory/constitution.md)            | Spec Kit: constituição do projeto, templates e scripts            |
| `specs/`                                                  | Uma pasta por feature (spec → plan → tasks), criada pelo Spec Kit |

Índice completo da documentação: [`docs/README.md`](docs/README.md).

## Fluxo de trabalho (Spec Kit)

1. `speckit specify <descrição da feature>` → cria `specs/NNN-nome/spec.md`
2. `speckit clarify` (opcional) → resolve dúvidas da spec
3. `speckit plan <stack e restrições>` → plano técnico, modelo de dados, contratos
4. `speckit tasks` → tarefas ordenadas, testes antes do código
5. `speckit implement` → implementa seguindo TDD

A ordem das features do módulo de estoque está no
[roadmap](docs/produto/estoque/00-visao-geral.md#roadmap).

## Rodar localmente

```bash
pnpm install
cp .env.example .env.local   # ajuste segredos se quiser
pnpm db:up && pnpm db:migrate && pnpm db:dev-login
pnpm dev                     # http://localhost:3000 → "Criar conta"
```

Testes: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:e2e`.
O passo a passo completo, com o roteiro manual, está no
[quickstart da feature 001](specs/001-cadastros-base/quickstart.md). Regras para contribuir:
[CONTRIBUTING.md](CONTRIBUTING.md).
