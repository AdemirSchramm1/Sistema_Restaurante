# Desempenho

> Criado na spec 012. Números e decisões em
> [specs/012-nova-cara-e-desempenho/research.md](../../specs/012-nova-cara-e-desempenho/research.md).

## O que pesa

Em produção o app roda na Vercel e o banco no Neon. Cada ida e volta ao banco custa alguns
milissegundos (medimos com 5 ms), então **o tempo de uma tela é, quase todo, o número de idas ao
banco feitas em série**. Código mais esperto no servidor muda pouco; consulta a menos muda muito.
Antes de otimizar, meça (abaixo).

## Regras do código

1. **Sessão e contexto uma vez por carregamento.** `currentSession()` e `currentContext()`
   (`src/actions/_session.ts`) usam o `cache()` do React: layouts e página do mesmo carregamento
   leem a sessão uma vez só. Chame `requireContext()` à vontade.
2. **Contexto numa consulta.** `app_membership_for_user` devolve restaurante, situação do membro e
   papéis de uma vez (`tests/integration/access/context.test.ts`).
3. **Uma transação por caso de uso.** O cabeçalho (`getShellInfo`) lê o nome do restaurante e a
   contagem do Repor na mesma transação (`tests/integration/shell.test.ts`). Caso de uso novo não
   abre uma transação para cada leitura.
4. **Leituras independentes em paralelo.** Na página, use `Promise.all` para casos de uso que não
   dependem um do outro (caixa: contas e taxa; cardápio: pratos e pedidos da mesa; detalhe do item:
   árvore, histórico, lançamentos, fornecedores…). Primeiro o que decide o 404, depois o resto junto.
5. **Gravar em lote.** O envio do pedido grava linhas, adicionais e retiradas com um `insert` cada,
   qualquer que seja o tamanho do pedido (`tests/integration/performance/submit-order.test.ts` conta
   as consultas).
6. **Junção em memória por mapa.** Para juntar listas (linhas por pedido, subgrupos por grupo…), use
   `groupBy` (`src/domain/shared/collections.ts`), nunca `filter` dentro de `map`.
7. **Toda consulta de tela usa índice.** `tests/integration/performance/indexes.test.ts` roda as
   consultas das telas com `enable_seqscan = off` e `auto_explain`, e falha se aparecer leitura da
   tabela inteira numa tabela do restaurante. Tela nova com consulta nova: inclua no teste; se ficar
   vermelho, crie o índice na migração.

## Como medir

Precisa do Docker com o banco do projeto (`pnpm db:up`) e de um build de produção.

```bash
# 1. Log de todas as consultas no banco local (desligar no fim com "alter system reset log_statement")
docker exec sistema_restaurante-db-1 psql -U postgres \
  -c "alter system set log_statement = 'all'" -c "select pg_reload_conf()"

# 2. App de produção
pnpm build && pnpm start &

# 3. Um restaurante novo e o cookie do gerente
node scripts/perf/session-cookie.mjs > /tmp/cookie.txt

# 4. Consultas por tela (3 carregamentos de cada)
node scripts/perf/statements.mjs /tmp/cookie.txt /estoque/itens /estoque/repor /pedidos/cozinha /equipe /caixa

# 5. Tempo até o primeiro byte com o banco a 5 ms (ida e volta)
node scripts/perf/latency-proxy.mjs 5440 5432 2.5 &
DATABASE_URL=postgres://app_login:app_login@localhost:5440/restaurante pnpm start &   # no lugar do passo 2
scripts/perf/ttfb.sh /tmp/cookie.txt /estoque/itens /caixa /pedidos/cozinha /estoque/repor /equipe
```

- `statements.mjs` lê o log do contêiner (`DB_CONTAINER` muda o nome) e conta as linhas
  `statement`/`execute` de cada carregamento.
- `ttfb.sh` faz 2 pedidos de aquecimento e dá a mediana de 15.
- `latency-proxy.mjs` atrasa cada pacote nos dois sentidos; 2,5 ms em cada sentido = 5 ms de ida e
  volta, como Vercel → Neon na mesma região.

## Resultado da 012

Restaurante recém-criado, gerente logado, mesmo computador antes e depois.

| Tela | Consultas antes | Depois | 1º byte com o banco a 5 ms, antes | Depois |
|---|---|---|---|---|
| `/estoque/itens` | 44 | 18 | 111,9 ms | 58,2 ms |
| `/estoque/repor` | 38 | 12 | 106,7 ms | 53,5 ms |
| `/pedidos/cozinha` | 35 | 17 | 109,0 ms | 55,8 ms |
| `/equipe` | 35 | 17 | 109,5 ms | 55,7 ms |
| `/caixa` | 34 | 16 | 109,2 ms | 55,6 ms |

Detalhes, banco local e o que sobrou em [research.md](../../specs/012-nova-cara-e-desempenho/research.md#r12-depois).
