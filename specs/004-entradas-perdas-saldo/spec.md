# Feature 004 — Compras, perdas e saldo (livro de movimentações)

**Branch**: `claude/project-thread-8lg7o1` · **Criada**: 2026-11-02 · **Status**: em implementação

## Contexto

Depois da [003](../003-produtos/spec.md) os produtos sabem quanto de cada item usam, mas os itens
ainda não têm saldo nem custo ("Sem custo ainda"). Esta feature cria o **livro de movimentações**
(só inserção, princípio III da constituição): a compra entra, a perda sai com motivo e o saldo é
sempre a soma do livro. A compra recalcula o custo médio, que alimenta o custo dos produtos.

Regras de negócio: [06-movimentacoes](../../docs/produto/estoque/06-movimentacoes.md),
[02-cadastro-de-itens](../../docs/produto/estoque/02-cadastro-de-itens.md#custo-do-item) e
[09-controles-e-permissoes](../../docs/produto/estoque/09-controles-e-permissoes.md).
Como o código garante o livro: [03-movimentacoes-e-saldo](../../docs/sistema/estoque/03-movimentacoes-e-saldo.md).

## Histórias

### US1 — Lançar uma compra (P1)

Como quem recebe a mercadoria, quero lançar o que chegou e quanto paguei, para o saldo e o custo
ficarem certos.

1. No menu "Lançamentos", escolho "Entrada (compra)", o item, a quantidade e o valor pago.
2. Se o item tem embalagem ("1 Caixa = 20 kg"), posso lançar em caixas (3 caixas = 60 kg) ou na
   medida do item. A tela mostra "Vai entrar: 60 kg".
3. Informo o **valor total pago** (R$ 240,00); o sistema calcula o custo por medida (R$ 4,00/kg).
4. O custo médio do item é recalculado: 10 kg a R$ 3,00 + 60 kg a R$ 4,00 = R$ 3,857…/kg (a tela
   mostra R$ 3,86). O último custo vira R$ 4,00.
5. Data da compra: hoje por padrão; pode ser outra data passada (nunca futura).
6. Observação livre opcional (ex.: de quem comprou).
7. A primeira movimentação trava a medida do item (já previsto na 001).

### US2 — Lançar uma perda com motivo (P1)

1. Escolho "Perda", o item, a quantidade (na medida do item ou numa menor da mesma família) e o
   motivo de uma lista fechada, agrupada em: perda de preparo, deterioração, erro operacional.
2. Observação livre opcional. O motivo é obrigatório.
3. A perda sai pelo custo médio do momento e não muda o custo médio.
4. Perda maior que o saldo é recusada: "Só há 2 kg de Tomate em estoque".

### US3 — Acertar o saldo quando a prateleira não bate, com aprovação (P2)

Decisão do dono (2026-11-02): **acerto com aprovação** de outra pessoa.

1. Quem lança compras ou perdas (gerente, chef, estoquista, comprador) escolhe "Pedir acerto", o
   item, informa **quanto tem de verdade** e o motivo (lista fechada), com observação opcional.
2. O pedido guarda o saldo do sistema naquele momento e a diferença (ex.: sistema 10 kg,
   prateleira 8 kg → faltam 2 kg). Sem diferença, aparece "O saldo já é esse". O saldo **não muda**
   ainda.
3. A página Lançamentos mostra os "Acertos esperando aprovação". Um **gerente que não seja quem
   pediu** aprova ou recusa (com motivo da recusa opcional).
4. Ao aprovar, o sistema lança a diferença do pedido como `ADJUSTMENT` pelo custo médio, com quem
   pediu e quem aprovou. Se a falta for maior que o saldo atual, a aprovação é recusada
   (`INSUFFICIENT_STOCK`): peça um acerto novo.
5. Quem pediu não aprova o próprio acerto (`SELF_APPROVAL`), mesmo sendo gerente. Num restaurante
   com um só gerente, os acertos pedidos por ele precisam de outro gerente; os da equipe ele aprova.
6. Pedido aprovado ou recusado não muda mais; pedido pendente pode ser cancelado por quem pediu.

### US4 — Ver o saldo e o que aconteceu com o item (P1)

1. A lista de itens mostra o saldo de cada item na sua medida.
2. A página do item mostra saldo, custo médio, último custo e as últimas movimentações (data, tipo,
   quantidade, custo, motivo, quem lançou).
3. A página "Lançamentos" lista as últimas movimentações do restaurante, com filtro por tipo.
4. Com custo médio, o custo dos produtos (003) aparece sozinho.

### US5 — Corrigir um lançamento errado (P1)

1. Numa movimentação, o gerente clica "Estornar" e informa o motivo do estorno.
2. O sistema lança uma movimentação inversa ligada à original. A original nunca muda nem some.
3. Cada movimentação só pode ser estornada uma vez; estorno não se estorna (lança-se de novo).
4. Estorno de compra recalcula o custo médio tirando a compra; se o saldo que sobra for zero, o
   custo médio continua o que era.
5. Estorno que deixaria o saldo negativo é recusado (ex.: a compra já foi consumida).

## Requisitos

- **FR-001** Tipos nesta feature: `PURCHASE`, `LOSS`, `ADJUSTMENT`, `REVERSAL`. Os demais tipos de
  [03-movimentacoes-e-saldo](../../docs/sistema/estoque/03-movimentacoes-e-saldo.md) vêm depois
  (venda na 005).
- **FR-002** Toda movimentação guarda: tipo, item, quantidade com sinal na medida do item, quantidade
  e medida como foram digitadas, custo unitário e total no momento, motivo (perda, acerto, estorno),
  observação, data do fato, data do lançamento, quem lançou, estorno ligado.
- **FR-003** Saldo = soma do livro por item. A tabela de saldo é projeção atualizada na mesma
  transação, reconstruível do livro.
- **FR-004** Custo médio ponderado só muda com compra (e estorno de compra). Saldo zero ou negativo
  antes da compra: custo médio = custo da compra.
- **FR-005** Saídas (perda, acerto para menos, estorno) nunca deixam saldo negativo nesta feature
  (`INSUFFICIENT_STOCK`). A exceção para vendas fica para a 005.
- **FR-006** Permissões: compra = gerente, estoquista, comprador; perda = gerente, chef,
  estoquista; pedir acerto = gerente, chef, estoquista, comprador; aprovar acerto e estornar =
  gerente, e quem aprova não pode ser quem pediu. Tentativa negada vai para a auditoria.
- **FR-007** Lançamento repetido (mesma chave do formulário) não duplica (`idempotency_key`).
- **FR-008** Dinheiro e quantidade em decimal exato. Arredondamento só ao gravar: custo unitário da
  movimentação com 4 casas, total com 2, custo médio do item com 8 (para o estorno de compra
  voltar à média de antes sem erro acumulado). A tela mostra 2 casas.
- **FR-009** Motivos em lista fechada por tipo, com família; texto livre só na observação.
- **FR-010** Item inativo não recebe lançamento novo (estorno de lançamento antigo continua possível).

## Fora do escopo

Fornecedores (007), nota fiscal, lote e validade, devolução, transferência, bonificação, consumo
de funcionários, cortesia, baixa por pedido (005), alerta de reposição (006).

## Critérios de sucesso

- **SC-001** Lançar uma compra em menos de 30 segundos.
- **SC-002** Em qualquer sequência de lançamentos, saldo = soma do livro (teste de propriedade).
