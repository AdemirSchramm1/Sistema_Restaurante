# Plano técnico: 018 — Validar o estoque, a conta e o pedido

**Branch**: `claude/project-thread-oukdi6` | **Data**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Resumo

Levar o código das features 001 a 011 à régua que as features 013 a 016 já cumprem: teste de
mutação de 100% em todo `src/domain/`, 100% de linhas, desvios e funções (unidade + integração) na
conta da mesa, no estoque e no pedido, e testes de tela para Cozinha, Garçom, Conta da mesa e
Lançamentos. Nenhuma tabela, rota ou tela nova; o código de produção só muda onde um teste novo
mostrar erro do sistema, ou para tirar código morto ou ambíguo.

Medido em 2026-11-26 sobre o `main` 3237ce7:

| O quê | Hoje | Meta |
|---|---|---|
| Mutação no domínio fora da régua (32 arquivos, 2.314 mutantes) | 80,8% (396 vivos, 44 sem teste) | 100% |
| Desvios não cobertos em `src/application/{billing,inventory,ordering,suppliers}` | 243 | 0 |
| Desvios não cobertos nos repositórios desses módulos | 83 | 0 |
| Desvios não cobertos nos componentes desses módulos | ~130 | 0 |
| Telas da US4 nos testes de tela | 0 de 4 | 4 de 4 |

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16, React 19 |
| Dependências novas | Nenhuma (Stryker, Vitest, Playwright já estão no projeto) |
| Banco | PostgreSQL 17; nenhuma migração |
| Testes | Vitest (unidade, componentes, integração com PostgreSQL real), Stryker, Playwright |
| Restrições | Nenhum teste existente apagado, pulado ou afrouxado; nenhum arquivo sai de régua; nenhum `// Stryker disable` nem `/* v8 ignore */` novo |
| Tempo de CI | Nenhum job acima de ~5 min (`06-ci-cd.md`); total cresce no máximo 10 min (SC-006) |

Nenhum ponto em aberto; escolhas técnicas em [research.md](research.md).

## Constituição

| Princípio | Como a 018 cumpre |
|---|---|
| I. Testes primeiro | A feature é testes. Erro do sistema achado: commit `test(018): … (vermelho)` antes do `fix(018)` ([R6](research.md#r6-quando-o-teste-mostra-erro-do-sistema)). FR-007 fecha o "cada regra tem teste nomeado" |
| II. Domínio puro | Nada muda; mutação em todo o domínio prova as regras isoladas |
| III. Livro imutável | Testes novos de integração conferem que movimentação, pagamento e contagem só recebem inserção |
| IV. Precisão | Mutação em `shared/decimal.ts`, `average-cost.ts`, `units.ts`, `split.ts`, `payment.ts` |
| V. Rastreabilidade | Testes de integração conferem a auditoria de cada escrita coberta |
| VI. Docs vivas | `docs/sistema/01-tdd.md`, `05-testes-de-tela.md`, `06-ci-cd.md`; `docs/produto/` se um erro mudar regra |
| VII. Simplicidade | Mesmo padrão dos portões existentes (`--mode` no Vitest, `mutate` no Stryker); nenhuma ferramenta nova |

Sem violação.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R1 Mutação**: `stryker.config.json` passa a mutar `src/domain/**/*.ts` (menos testes) e o
  `vitest.stryker.config.mts` inclui todos os testes de unidade do domínio. O job `unidade` vira
  uma matriz: `unidade` (testes + cobertura) e `mutacao` em 2 partes (`--mutate` por pasta).
- **R2 Portões de cobertura**: três modos novos no Vitest, como `cash` e `staff`:
  `test:billing` (US1), `test:stock` (US2) e `test:orders` (US3), cada um 100% de linhas, desvios,
  funções e instruções, somando unidade e integração do seu escopo.
- **R3 Integração em partes**: o job `integracao` vira matriz (`menu`, `cash+staff`, `billing`,
  `stock`, `orders`), cada parte com o seu PostgreSQL.
- **R4 Textos e códigos**: teste confere o código de erro e o campo; textos que a pessoa vê
  (árvore padrão, motivos, rótulos do histórico) são conferidos por tabela no teste.
- **R5 Telas**: novo `tests/screens/operations.spec.ts` com Cozinha, Garçom, Conta da mesa e
  Lançamentos, nos tamanhos dos aparelhos de cada uma, só checagens de layout (como o caixa).
- **R6 Erro do sistema**: corrigir com teste primeiro; regra visível que muda → perguntar ao dono.
- **R7 Mutante equivalente**: reescrever o código para não ter a forma ambígua; nunca desligar.
- **R8 Registros**: `mutants.md` (decisão por grupo de sobreviventes) e `rules.md` (regra →
  teste) nesta pasta.

## Estrutura

```text
stryker.config.json            mutate: src/domain/**/*.ts
vitest.stryker.config.mts      include: src/domain/**/*.test.ts
vitest.config.mts              + billingCoverage, stockCoverage, ordersCoverage
package.json                   + test:billing, test:stock, test:orders
.github/workflows/ci.yml       unidade → unidade + mutacao (2 partes); integracao → 5 partes;
                               telas: a parte "resto" ganha operations.spec.ts sozinha
src/domain/**/*.test.ts        testes novos (mutantes)
src/components/**/*.test.tsx   testes novos (desvios das telas)
tests/integration/**           testes novos (casos de uso e repositórios)
tests/screens/operations.spec.ts   Cozinha, Garçom, Conta da mesa, Lançamentos
specs/018-validar-estoque-conta/   mutants.md, rules.md, tasks.md
docs/sistema/                  01-tdd.md, 05-testes-de-tela.md, 06-ci-cd.md
```

## Escopo de cada portão

Contrato completo em [contracts/gates.md](contracts/gates.md).

| Portão | Domínio | Casos de uso | Repositórios | Componentes |
|---|---|---|---|---|
| `test:billing` | `billing/**` | `billing/**` | `billing-repository` | `billing/**` |
| `test:stock` | `inventory/**` | `inventory/**` | `item`, `group`, `movement`, `recipe`, `report` | `items`, `groups`, `movements`, `recipes`, `costs`, `reorder`, `reports`, `audit` |
| `test:orders` | `ordering/**` fora da régua, `suppliers/**`, `shared/**` | `ordering/**` fora da régua, `suppliers/**` | `ordering`, `addon`, `supplier` | `ordering/**` fora da régua, `suppliers/**`, `layout/**` |

`access` (login, convite, equipe) fica fora: não está na spec e vai junto da feature 019.

## Complexity Tracking

Vazio.
