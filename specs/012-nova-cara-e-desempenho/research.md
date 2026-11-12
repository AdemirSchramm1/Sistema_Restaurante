# Pesquisa e decisões — 012

## R1 Linha de base

Medido em 2026-11-11 com `pnpm build && pnpm start`, banco PostgreSQL 17 local (Docker) e um
restaurante recém-criado (gerente logado). Scripts em [`scripts/perf/`](../../scripts/perf/) e
método em [docs/sistema/04-desempenho.md](../../docs/sistema/04-desempenho.md).

**Consultas por carregamento de tela** (`log_statement = all`, 3 carregamentos iguais):

| Tela | Consultas |
|---|---|
| `/estoque/itens` | 44 |
| `/estoque/repor` | 38 |
| `/pedidos/cozinha` | 35 |
| `/equipe` | 35 |
| `/caixa` | 34 |

**Tempo até o primeiro byte** (mediana de 15 pedidos, depois de 2 de aquecimento):

| Tela | Banco local (~0,1 ms) | Banco a 5 ms (ida e volta) |
|---|---|---|
| `/estoque/itens` | 23,8 ms | 111,9 ms |
| `/caixa` | 21,1 ms | 109,2 ms |
| `/pedidos/cozinha` | 21,1 ms | 109,0 ms |
| `/estoque/repor` | 21,3 ms | 106,7 ms |
| `/equipe` | 20,9 ms | 109,5 ms |

Com o banco perto, o tempo é pequeno; com o banco a 5 ms (o caso real, Vercel → Neon), **cada ida e
volta custa 5 ms e o tempo da tela passa a ser o número de consultas**. Por isso a meta é cortar
idas ao banco, não micro-otimizar o código.

### Para onde vão as consultas

O log de uma carga de `/estoque/itens` mostra o mesmo trabalho repetido:

- O layout da equipe, o layout do estoque e a página chamam `requireContext()` cada um, e o layout
  ainda chama `currentUser()`: **4 leituras da sessão** (sessão + usuário = 2 consultas cada) e
  **3 montagens do contexto**.
- Cada montagem do contexto faz `app_membership_for_user` e depois uma transação só para ler os
  papéis: `begin`, `set_config`, membro, papéis, `commit` = **6 consultas**.
- O cabeçalho abre duas transações (nome do restaurante; número do Repor): **8 consultas**.

## R2 Consultas que leem a tabela inteira

Método: a suíte de integração inteira rodou num PostgreSQL com `auto_explain` (todos os planos) e
`enable_seqscan = off`. Com a leitura sequencial desligada, o planejador só a usa quando **não há
índice possível**. Tirando as consultas dos próprios testes, das migrações e das tabelas de
catálogo global (`units`, `movement_reasons`), sobraram:

| Tabela | Consulta (tela) | Por quê |
|---|---|---|
| `order_line_removals` | retiradas das linhas (cozinha, garçom, conta, pedidos, consumo) | só há índices parciais (`where item_id is not null` / `sub_recipe_id is not null`), que não servem para `order_line_id in (...)` |
| `recipe_removables` | retiradas oferecidas (cardápio do cliente, produto) | mesmo motivo |
| `recipes` | `kind = 'DISH'` (cardápio, produtos) | o único índice é parcial (`where active`) |
| `dining_tables` | lista de mesas | idem |
| `item_subgroups` | árvore de grupos, primeiro subgrupo | só `(group_id, code)` |
| `suppliers` | lista de fornecedores com inativos | só o parcial `where active` |
| `addons` | lista de adicionais | idem |

Leitura sequencial numa tabela de **todos os restaurantes** cresce com o número de clientes do SaaS
(o RLS filtra depois de ler). `order_line_removals` cresce com cada pedido.

**Decisão**: migração `0012_performance` com os índices de [data-model.md](data-model.md) e um
teste de integração que roda as consultas dessas telas com `enable_seqscan = off` e `auto_explain`
no nível `notice` e falha se aparecer "Seq Scan" numa tabela do restaurante.

## R3 Resolver a sessão uma vez por carregamento

**Decisão**: `cache()` do React em `currentSession()` e `currentContext()` (`src/actions/_session.ts`).
No App Router, layouts e página do mesmo carregamento compartilham o cache; fora da renderização
(Server Action) a função roda normalmente.

Alternativas: passar o contexto do layout para a página (o App Router não permite);
`cookieCache` do Better Auth (rejeitado: uma sessão revogada continuaria valendo até o cookie
vencer).

## R4 Contexto numa consulta só

**Decisão**: a função `app_membership_for_user(uuid)` (já `SECURITY DEFINER`, já devolve o
restaurante e se o membro está ativo) passa a devolver também os papéis (`text[]`). O
`resolveContext` deixa de abrir a transação do restaurante só para ler os papéis: de 6 consultas
para 1. Não abre dado novo: os papéis são do próprio membro da sessão.

## R5 Cabeçalho numa transação

**Decisão**: caso de uso `getShellInfo` devolve o nome do restaurante e, para quem vê o estoque, o
número do Repor, na mesma transação. Quem não vê o estoque não conta (nem gera tentativa negada).

## R6 Envio do pedido em lote

Hoje `insertOrder` faz, por linha: inserir a linha, ler os adicionais, inserir os adicionais e
inserir as retiradas. Um pedido de 5 linhas com opções faz ~20 idas ao banco, a 5 ms cada, no
"Confirmar" do cliente.

**Decisão**: inserir todas as linhas num `insert` só, ler os adicionais de todas as linhas de uma
vez e inserir adicionais e retiradas de todas as linhas em um `insert` cada. O teste conta as
consultas: pedido de 1 linha e de 3 linhas fazem o mesmo número.

## R7 Junções em memória

`orders.load`, `tabs.listOpen`, `menu.catalog`, `orderChoices.forOrder`, grupos, fornecedores,
fichas e membros juntam listas com `filter` dentro de `map` (custo linhas × pedidos). Na tela
Pedidos (até 31 dias) isso passa de milhões de comparações.

**Decisão**: `groupBy` no domínio compartilhado (`src/domain/shared/collections.ts`), que monta um
`Map` em uma passada; cada junção vira uma leitura no mapa.

## R8 Paleta e contraste

**Decisão**: cores em OKLCH nas variáveis de tema de `app/globals.css`:

| Papel | Nome | Claro | Uso |
|---|---|---|---|
| `primary` | Páprica | `oklch(0.53 0.17 40)` | ação principal, link, destaque |
| `success` | Manjericão | `oklch(0.48 0.11 150)` | deu certo, pago, pronto |
| `warning` | Açafrão | `oklch(0.8 0.15 80)` | atenção, Repor, recebido |
| `destructive` | Beterraba | `oklch(0.5 0.19 15)` | erro, apagar, cancelar |
| `info` | Mirtilo | `oklch(0.5 0.1 250)` | informação |
| `background` | Creme | `oklch(0.985 0.008 85)` | fundo |
| `foreground` | Café | `oklch(0.25 0.025 50)` | texto |
| `sidebar` | Lousa | `oklch(0.24 0.025 45)` | menu lateral (lousa de cardápio) |

Páprica e beterraba ficam a 25° de distância no círculo de cores e com claridade diferente, para o
botão principal não parecer um botão de apagar. O teste de contraste converte OKLCH para sRGB e
calcula o contraste WCAG de cada par de texto e fundo nos dois modos.

## R9 Fontes

**Decisão**: `next/font/google` com **Fraunces** (títulos: serifada, lembra cardápio) e **Inter**
(texto: números tabulares para valores e tabelas). `next/font` baixa os arquivos no build e serve
pelo próprio domínio, com `display: swap` e fonte de reserva ajustada (sem salto de layout e sem
chamada ao Google quando a tela abre).

## R10 Barrar cor solta

**Decisão**: teste de unidade que lê `app/` e `src/components/` e falha se encontrar classe de cor
crua do Tailwind (`bg-amber-100`, `text-red-800`, `text-white`…). Mais rápido que uma regra do
ESLint carregando a configuração inteira e roda na mesma CI.

## R11 Régua de cobertura

Medido hoje: domínio com 99,7% das linhas, 94,7% dos desvios e 98,5% das funções (régua: 90% das
linhas); componentes com 88,6% das linhas e 75,7% dos desvios (sem régua).

**Decisão**: régua por pasta no Vitest. Domínio: 95% das linhas, 90% dos desvios e 95% das funções.
Componentes: 90% das linhas e 80% dos desvios, depois dos testes novos.
