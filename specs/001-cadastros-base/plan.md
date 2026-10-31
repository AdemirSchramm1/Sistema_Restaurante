# Implementation Plan: Cadastros base do estoque (grupos, unidades, locais, itens)

**Branch**: `001-cadastros-base` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-cadastros-base/spec.md`

## Summary

Primeira feature do ERP: cria o esqueleto do projeto e entrega login com restaurante (tenant),
convite de equipe com papéis, e os cadastros mestres do estoque: árvore de grupos e subgrupos,
catálogo de unidades com conversão exata, locais com rota de contagem e itens com três unidades
(compra, estoque, receita). Abordagem técnica: aplicação Next.js única, regras em funções puras de
domínio testadas primeiro (conversão, código `GG.SS.NNNN`, normalização de descrição, permissões,
compatibilidade item × local), casos de uso que gravam e auditam na mesma transação, e isolamento
entre restaurantes em duas barreiras (filtro na aplicação + Row Level Security). Decisões em
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict`, Node.js 22 LTS

**Primary Dependencies**: Next.js (App Router) + React; Tailwind CSS + shadcn/ui; Drizzle ORM +
drizzle-kit (R1); Better Auth (R3); Zod; react-hook-form; decimal.js (R5); uuid (v7); Resend
(e-mail, atrás da porta `Mailer`)

**Storage**: PostgreSQL 17 — Neon em produção/preview (R2); RLS por `app.restaurant_id` (R4);
extensão `pg_trgm` para busca

**Testing**: Vitest (unidade e integração), Testing Library (componentes de formulário),
Testcontainers com `postgres:17` (integração, sem mock de banco), Playwright (ponta a ponta)

**Target Platform**: aplicação web na Vercel; navegadores atuais em computador e tablet

**Project Type**: aplicação web única (Next.js full-stack)

**Performance Goals**: busca na lista com 2.000 itens em ≤ 1 s para o usuário (SC-005); salvar
cadastro em ≤ 500 ms no servidor em condições normais

**Constraints**: decimal exato em todo valor de quantidade e fator; nenhum dado cruza restaurantes;
auditoria na mesma transação; interface em pt-BR com vírgula decimal; domínio sem I/O nem relógio

**Scale/Scope**: até ~100 restaurantes no início, até 5.000 itens e 30 usuários por restaurante;
~12 telas (entrar, criar conta, aceitar convite, recuperar senha, equipe, grupos, locais, folha do
local, lista de itens, item, histórico, primeiro acesso)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | Antes | Depois do desenho |
|---|---|:-:|:-:|
| I. Testes primeiro | Toda regra da spec tem teste nomeado pela regra; `tasks.md` põe teste antes de código; casos de [04-plano-de-testes](../../docs/sistema/estoque/04-plano-de-testes.md#001--cadastros-base) cobertos | ✓ | ✓ |
| II. Domínio puro | 15 funções puras em `src/domain/` ([data-model](data-model.md#regras-de-domínio-funções-puras-srcdomain)); relógio, IDs e mailer injetados; lint de fronteiras | ✓ | ✓ |
| III. Livro imutável | Não há movimentação nesta feature. `audit_log` segue a mesma regra (só inserção, trigger contra `UPDATE`/`DELETE`). Bloqueio da unidade de estoque já preparado (R8) | ✓ | ✓ |
| IV. Precisão numérica | `numeric(14,4)` + decimal.js; `numeric` lido como string; lint proíbe `parseFloat`/`Number(` no domínio; arredonda só na exibição | ✓ | ✓ |
| V. Rastreabilidade e segregação | Auditoria de toda escrita com antes/depois e origem (R10); matriz de papéis (R11); RLS + filtro (R4); teste de isolamento obrigatório. Segregação de aprovação não se aplica (não há aprovação nesta feature) | ✓ | ✓ |
| VI. Documentação viva | ADRs 0001–0004 criados e `docs/sistema/00-arquitetura.md`, `estoque/01-modelo-de-dados.md` e glossário atualizados neste plano | ✓ | ✓ |
| VII. Simplicidade | Uma aplicação, um banco, sem fila nem cache. Better Auth e RLS justificados em research (R3, R4) e não violam o princípio | ✓ | ✓ |

**Restrições técnicas**: stack, ferramentas de teste, idioma e `timestamptz` conforme a
constituição. Nenhuma violação; tabela de Complexity Tracking vazia.

## Project Structure

### Documentation (this feature)

```text
specs/001-cadastros-base/
├── plan.md              # este arquivo
├── research.md          # decisões R1–R15
├── data-model.md        # tabelas, estados e funções de domínio
├── quickstart.md        # roteiro de validação
├── contracts/
│   └── use-cases.md     # casos de uso, permissões e códigos de erro
├── checklists/
│   └── requirements.md
└── tasks.md             # próxima fase (speckit tasks)
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── entrar/page.tsx
│   ├── criar-conta/page.tsx
│   ├── convite/[token]/page.tsx
│   └── recuperar-senha/page.tsx
├── (app)/
│   ├── equipe/page.tsx
│   └── estoque/
│       ├── grupos/page.tsx
│       ├── locais/page.tsx
│       ├── locais/[id]/folha/page.tsx
│       ├── itens/page.tsx
│       ├── itens/novo/page.tsx
│       └── itens/[id]/page.tsx          # inclui aba de histórico
└── api/auth/[...all]/route.ts           # Better Auth

src/
├── domain/
│   ├── shared/        # decimal.ts, result.ts, audit.ts (diffFields)
│   ├── access/        # permissions.ts, memberships.ts
│   └── inventory/     # units.ts, item-code.ts, description.ts, item.ts,
│                      # location.ts, allergens.ts, default-tree.ts  (+ *.test.ts ao lado)
├── application/
│   ├── context.ts     # RequestContext { userId, restaurantId, roles, origin }
│   ├── access/        # sign-up-restaurant.ts, invite-member.ts, accept-invitation.ts, ...
│   └── inventory/     # create-item.ts, update-item.ts, set-item-locations.ts, ...
├── infra/
│   ├── db/
│   │   ├── schema/        # Drizzle
│   │   ├── migrations/    # SQL gerado + SQL manual (RLS, triggers, índices parciais)
│   │   ├── tx.ts          # withTenantTx(restaurantId, fn)
│   │   └── repositories/
│   ├── auth/              # configuração do Better Auth
│   └── mailer/            # resend.ts, memory.ts
├── actions/               # Server Actions (finas)
└── components/            # formulários e tabelas; shadcn em components/ui

tests/
├── builders/              # restaurantBuilder, itemBuilder, locationBuilder
├── integration/           # Testcontainers: RLS, duplicidade, triggers, auditoria, desempenho
└── e2e/                   # Playwright: cadastro de item, convite de chef
```

**Structure Decision**: aplicação web única com as camadas de
[`docs/sistema/00-arquitetura.md`](../../docs/sistema/00-arquitetura.md#camadas). A única
diferença em relação à estrutura proposta lá é a pasta `src/actions/`, que separa as Server Actions
das páginas para que os testes de integração possam chamá-las sem renderizar React.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
