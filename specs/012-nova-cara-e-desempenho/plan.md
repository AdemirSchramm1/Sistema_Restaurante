# Plano técnico: 012 — Nova cara, padrões do front, limpeza e desempenho

**Branch**: `claude/project-thread-btqt25` | **Data**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Resumo

Três frentes no mesmo PR, porque se tocam (o casco novo da tela é também onde a sessão é lida):

1. **Padrão do front**: tema com a paleta de comida em variáveis OKLCH (claro e escuro), fontes
   Fraunces e Inter pelo `next/font`, componentes do padrão em `src/components/ui/`, casco novo
   (menu lateral por área, barra do topo no celular) e todas as telas migradas para o
   `PageHeader` e os tons do padrão. Documentado em `docs/sistema/03-padroes-do-front.md`.
2. **Desempenho**: sessão e contexto uma vez por carregamento (`cache` do React); contexto numa
   consulta; cabeçalho numa transação; índices das telas mais usadas; envio do pedido em lote;
   junções em memória por mapa. Medido antes e depois ([research.md](research.md)).
3. **Limpeza e testes**: funções únicas para dinheiro, filtro da URL e texto de formulário; código
   morto fora; testes para os componentes sem teste; régua de cobertura mais alta e com os
   componentes.

Nenhuma dependência nova de produção (o `lucide-react` já estava no `package.json`; o `next/font`
vem com o Next).

## Contexto técnico

| Item | Valor |
|---|---|
| Linguagem / framework | TypeScript `strict`, Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Dependências novas | Nenhuma |
| Banco | PostgreSQL 17; migração `0012_performance` (só índices e uma função) |
| Testes | Vitest (unidade, componentes e integração), Playwright (e2e e axe) |
| Desempenho | ≥ 50% menos consultas por tela; ≥ 40% menos tempo até o primeiro byte com o banco a 5 ms |
| Restrições | Nenhuma regra, texto de regra, permissão ou URL muda; e2e existentes continuam valendo |

## Constituição

| Princípio | Como a 012 cumpre |
|---|---|
| I. Testes primeiro | `test(012)` antes de cada mudança de comportamento: contraste do tema, cor solta, `groupBy`, `formatBrl`, filtro da URL, menu por área e link ativo, componentes novos, consultas com índice, pedido em lote, contexto numa consulta, cabeçalho numa transação. Refatorações puras ficam cobertas pelos testes que já existem, rodados a cada passo |
| II. Domínio puro | `groupBy` e `formatBrl` em `src/domain/shared/`, sem I/O. Conversão de cor e contraste em `src/lib/contrast.ts`, pura |
| III. Livro imutável | Não toca no livro; o envio do pedido continua só inserindo |
| IV. Precisão | `formatBrl` usa `decimal.js`; nenhuma conta de dinheiro muda |
| V. Rastreabilidade | O contexto continua vindo do banco a cada carregamento (sem cache entre pedidos); a função ampliada só devolve os papéis do próprio membro; RLS intocado |
| VI. Docs vivas | `docs/sistema/03-padroes-do-front.md` (novo), `docs/sistema/04-desempenho.md` (novo), arquitetura, TDD (régua) e README dos docs |
| VII. Simplicidade | Sem cache entre usuários, sem biblioteca de componentes nova, sem tempo real. `cache()` do React e índices são o mínimo que resolve o que foi medido |

Sem violação; a tabela de complexidade fica vazia.

## Decisões principais

Detalhes e alternativas em [research.md](research.md).

- **R3** `cache()` do React em `currentSession()` e `currentContext()`.
- **R4** `app_membership_for_user` devolve os papéis; `resolveContext` faz uma consulta.
- **R5** `getShellInfo`: nome do restaurante e contagem do Repor numa transação.
- **R2** Índices de [data-model.md](data-model.md) e teste com `enable_seqscan = off`.
- **R6** `insertOrder` em lote; teste conta as consultas.
- **R7** `groupBy` em todas as junções em memória.
- **R8/R9** Paleta OKLCH com teste de contraste; Fraunces e Inter pelo `next/font`.
- **R10** Teste que barra cor solta; **R11** régua por pasta.

## Estrutura

```text
app/globals.css                       tema (paleta, fontes, sombras, raio), modo escuro, impressão
app/layout.tsx                        fontes do next/font nas variáveis --font-inter e --font-fraunces
app/(app)/layout.tsx                  AppShell + getShellInfo
app/(auth)/layout.tsx                 painel da marca + formulário
app/(cardapio)/layout.tsx             faixa do restaurante
app/**/page.tsx                       PageHeader, TextLink, tons do padrão
src/lib/contrast.ts                   OKLCH → sRGB, luminância e contraste WCAG (+ teste)
src/lib/search-params.ts              firstParam (+ teste)
src/domain/shared/collections.ts      groupBy (+ teste)
src/domain/shared/decimal.ts          formatBrl (+ teste)
src/application/form-input.ts         formText
src/application/shell.ts              getShellInfo
src/application/access/resolve-context.ts   uma consulta
src/actions/_session.ts               cache()
src/components/ui/                    button, badge, alert, card, input, table, text-link, empty-state
src/components/ui/tokens.test.ts      contraste de todos os pares do tema
src/components/ui/no-raw-colors.test.ts     barra cor solta em app/ e src/components/
src/components/layout/                app-shell, nav (áreas, ícones, link ativo), page-header, brand
src/infra/db/migrations/0012_performance.sql, schema/*.ts (índices)
src/infra/db/repositories/            groupBy; insertOrder em lote
tests/integration/performance/        consultas com índice; pedido em lote; contexto; cabeçalho
scripts/perf/                         proxy com atraso, contagem de consultas e tempo até o 1º byte
docs/sistema/03-padroes-do-front.md, 04-desempenho.md
```

## Ordem de entrega (vira `tasks.md`)

1. Base pura: `groupBy`, `formatBrl`, `firstParam`, `formText`, contraste.
2. Desempenho do banco: índices (teste vermelho → migração), contexto numa consulta, cabeçalho numa
   transação, pedido em lote, `groupBy` nos repositórios, `cache()` da sessão.
3. Padrão do front: tema e contraste, componentes, casco e menu, telas.
4. Limpeza: código morto, duplicações.
5. Testes dos componentes sem teste, régua de cobertura.
6. Docs, medição final, e2e.

## Riscos

- **Testes ponta a ponta dependem dos nomes no menu**: o menu continua um `nav` "Menu principal"
  com os mesmos links e na mesma ordem; as áreas são títulos, não links.
- **`cache()` do React fora da renderização**: numa Server Action não há cache e a função roda
  normalmente (mesmo comportamento de hoje).
- **Fontes no build**: o `next/font` baixa as fontes do Google durante o `next build`; a CI e a
  Vercel têm acesso. Sem rede, o build falha (não a tela).
- **Índices novos em produção**: tabelas pequenas hoje; `CREATE INDEX` comum é rápido. Se crescer,
  trocar por `CONCURRENTLY` fora da transação.

## Complexity Tracking

Nenhuma violação.
