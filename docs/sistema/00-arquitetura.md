# Arquitetura

> Status: decisões da feature 001 fechadas em 2026-10-31 (ver [ADRs](adr/)).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript `strict` |
| Interface | Tailwind CSS com o tema próprio (paleta de comida em OKLCH, Inter e Fraunces) e componentes em `src/components/ui/` ([padrões do front](03-padroes-do-front.md)) |
| Banco | PostgreSQL 17 no Neon, via Vercel ([ADR 0002](adr/0002-postgres-neon.md)) |
| Acesso a dados | Drizzle ORM + drizzle-kit ([ADR 0001](adr/0001-orm-drizzle.md)) |
| Validação | Zod (entrada de formulários, Server Actions e rotas) |
| Decimais | `decimal.js` no TS; `numeric(p,s)` no PostgreSQL |
| Autenticação | Better Auth, e-mail e senha; papéis em tabelas do domínio ([ADR 0003](adr/0003-auth-better-auth.md)) |
| Testes | Vitest, Testing Library, PostgreSQL em container (Testcontainers), Playwright |
| Deploy | Vercel (preview por PR, produção na `main`) |
| CI | GitHub Actions: formatação, lint, typecheck, testes com régua de cobertura, ponta a ponta com axe |

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
- **Server Actions / rotas** fazem só: autenticar, ler a entrada com os leitores de formulário
  (`src/application/*-input.ts`, que usam `formText`, `optionalText`, `optionalDecimal`, `isId`,
  `componentRef` e `formDataToObject` de `src/application/form-input.ts`), chamar o caso de uso,
  devolver resultado.
- **Páginas** resolvem a sessão e o contexto uma vez por carregamento (`cache()` do React) e chamam
  em paralelo os casos de uso que não dependem um do outro. Regras de desempenho em
  [04-desempenho.md](04-desempenho.md).

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
    ordering/          # pedidos pelo QR code, adicionar e tirar (009, 010)
    billing/           # conta da mesa: totais, taxa, pagamento, divisão, fechar (011)
  application/
    inventory/
      register-entry.ts
      register-exit.ts
      sales.ts         # baixa pelo pedido e cancelamento depois do preparo (011)
      ...
    ordering/
    billing/           # caixa: contas, pagamentos, fechar, contas fechadas, reabrir (011)
  infra/
    db/
      schema/          # tabelas
      migrations/
      repositories/
  actions/             # Server Actions finas (chamam application/)
  components/
    ui/                # componentes do padrão (botão, selo, aviso, cartão, tabela…)
    layout/            # casco da tela: menu lateral, cabeçalho da tela, marca
    ...                # componentes de cada módulo, com teste ao lado
  lib/                 # utilidades sem regra de negócio (contraste, filtros da URL)
tests/
  integration/         # casos de uso + banco real
  e2e/                 # Playwright
scripts/perf/          # medição de consultas e de tempo até o primeiro byte (04-desempenho.md)
docs/
specs/
.specify/
```

## Multi-tenant (SaaS)

- Toda tabela de negócio tem `restaurant_id`.
- Repositórios recebem o `restaurant_id` do usuário autenticado; nunca do cliente.
- Defesa em profundidade: Row Level Security no PostgreSQL com `app.restaurant_id` por transação
  ([ADR 0004](adr/0004-rls-tenant.md)).
- Teste obrigatório: usuário do restaurante A não lê nem grava dados do restaurante B.

## Decisões em aberto

| Decisão | Opções | Quando |
|---|---|---|
| – | – | – |

Decididas: saldo negativo em vendas é permitido com aviso no item (feature 011; ver
[estoque/03](estoque/03-movimentacoes-e-saldo.md#saldo-negativo)).

Registre cada decisão tomada como ADR curto em `docs/sistema/adr/NNNN-titulo.md`.
