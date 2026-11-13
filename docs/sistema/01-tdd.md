# Desenvolvimento guiado por testes (TDD)

TDD é **inegociável** neste projeto (constituição, princípio I).

## O ciclo

1. **Vermelho** — escreva um teste pequeno que descreve um comportamento e veja ele falhar pelo
   motivo certo.
2. **Verde** — escreva o mínimo de código para o teste passar.
3. **Refatorar** — melhore nomes e estrutura com os testes verdes.

Repita em passos pequenos. Commit sugerido a cada ciclo verde.

## Pirâmide de testes

| Nível | Ferramenta | O que testa | Onde | Velocidade |
|---|---|---|---|---|
| Unidade (domínio) | Vitest | Funções puras: conversão, custo médio, PP, CMV, custo do produto | `src/domain/**/*.test.ts` | ms |
| Unidade (componentes) | Vitest + Testing Library | Componentes React com lógica (formulários, tabelas) | `src/components/**/*.test.tsx` | ms |
| Integração | Vitest + PostgreSQL real (Testcontainers) | Casos de uso com banco: movimentação → saldo, isolamento de tenant, constraints | `tests/integration/` | s |
| Ponta a ponta | Playwright | Fluxos críticos do usuário (cadastrar item, receber, contar) | `tests/e2e/` | dezenas de s |

Regra de proporção: muitos testes de domínio, alguns de integração, poucos E2E (só fluxos críticos).

## Da documentação ao teste

Os documentos de `docs/produto/` têm **exemplos numéricos** e **critérios de aceite**. Eles viram
testes diretamente:

```ts
// src/domain/inventory/reorder.test.ts
import { describe, it, expect } from "vitest";
import { calculateReorder } from "./reorder";
import { d } from "../shared/decimal";

describe("reposição (docs/produto/estoque/08-ciclo-operacional.md#planejamento)", () => {
  it("calcula ES, PP, par e quantidade a pedir do exemplo do filé mignon", () => {
    const r = calculateReorder({
      averageDailyUsage: d("6"),
      leadTimeDays: 1,
      reorderCycleDays: 3,
      safetyMargin: d("0.20"),
      currentBalance: d("9.6"),
      inTransit: d("0"),
    });

    expect(r.safetyStock.toString()).toBe("3.6");
    expect(r.reorderPoint.toString()).toBe("9.6");
    expect(r.parLevel.toString()).toBe("21.6");
    expect(r.orderQuantity.toString()).toBe("18");
  });
});
```

Convenção: o `describe` cita o documento de produto de onde a regra vem.

## Regras práticas

- **Nada de `Date.now()` ou `new Date()` no domínio.** Passe a data como parâmetro; nos casos de
  uso, injete um `Clock`.
- **Sem mock de banco para regra que depende de SQL.** Use PostgreSQL real em container. Mocks só
  para fronteiras externas (NF-e, PDV, e-mail).
- **Um comportamento por teste**, nome em português descrevendo o comportamento:
  `it("bloqueia ajuste aprovado pelo mesmo usuário que lançou")`.
- **Builders de dados de teste** (`tests/builders/`) para criar itens, fornecedores e movimentações
  sem repetir código.
- **Vermelho pelo motivo certo.** Rode o teste antes do código e veja a **asserção** falhar. Se o
  módulo ainda não existe, crie um esqueleto vazio (ex.: componente que devolve `null`) para o teste
  falhar no comportamento, não no `import`.
- **Tela nova também tem teste antes.** A lógica de exibição de uma página (textos condicionais,
  plural, estado vazio) vai para um componente com teste de unidade escrito antes; o E2E do fluxo
  também vem antes da página, vermelho.
- **Bug → teste primeiro.** Todo bug corrigido ganha um teste que falhava antes da correção.
- **Nunca** usar `.skip`, `.only` ou apagar teste para passar na CI (lint bloqueia `.only`).

## Cobertura e CI

- Régua de cobertura por pasta (`vitest.config.mts`, conferida pelo `pnpm test:unit`):

  | Pasta | Linhas | Desvios | Funções |
  |---|---|---|---|
  | `src/domain/` | 95% | 90% | 95% |
  | `src/components/` | 90% | 80% | — |
  | Leitores de formulário (`src/application/**/*-input.ts`) | 90% | 80% | — |

  Os casos de uso ficam fora da régua de unidade porque são testados com banco: todo caso de uso tem
  ao menos um teste de integração.
- **Desempenho também tem teste**: as consultas das telas usam índice
  (`tests/integration/performance/indexes.test.ts`), o envio do pedido faz o mesmo número de
  consultas com 1 ou 3 linhas (`submit-order.test.ts`) e o contexto do login sai de uma consulta
  (`tests/integration/access/context.test.ts`). Ver [04-desempenho.md](04-desempenho.md).
- **O visual também tem teste**: contraste de todas as cores do tema nos dois modos
  (`src/components/ui/tokens.test.ts`) e nenhuma cor crua do Tailwind fora do tema
  (`no-raw-colors.test.ts`). Ver [03-padroes-do-front.md](03-padroes-do-front.md).
- A CI roda em todo PR: `format:check` → `lint` → `typecheck` → `test:unit` → `test:integration`, e
  `test:e2e` (com o axe) no job de ponta a ponta.
- PR com CI vermelha não é mergeado.

## TDD no fluxo Spec Kit

- `spec.md` traz os critérios de aceite (copiados ou referenciados de `docs/produto/`).
- `tasks.md` lista, para cada história, **primeiro** as tarefas de teste, depois as de
  implementação (o template do Spec Kit já ordena assim quando os testes são pedidos).
- `speckit implement` executa as tarefas em ordem: o teste é escrito, roda vermelho, depois o código.
