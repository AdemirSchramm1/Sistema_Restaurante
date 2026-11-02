# Feature 008 — Painel de custo dos produtos

**Branch**: `claude/project-thread-tx99is` · **Criada**: 2026-11-02 · **Status**: em revisão

## Contexto

A [003](../003-produtos/spec.md) já calcula quanto custa cada produto pelo custo médio dos itens
(a [004](../004-entradas-perdas-saldo/spec.md) atualiza esse custo a cada compra). Falta responder
a pergunta do dono: **quanto do preço de cada prato vai em ingredientes, e quais pratos estão
caros demais?** Regras em [04-fichas-tecnicas](../../docs/produto/estoque/04-fichas-tecnicas.md)
("% CMV da ficha = custo por porção ÷ preço de venda × 100") e
[10-indicadores](../../docs/produto/estoque/10-indicadores.md) (faixa de 25% a 35%; acima de 40% a
margem está em risco).

A baixa por pedido (005) ainda não existe, então não há quantidade vendida nem CMV teórico do
período. Este painel mostra o custo **de uma unidade** de cada produto vendido, hoje.

A tela precisa ser entendida de primeira e ser leve: barras em HTML e CSS (como na 006), sem
biblioteca de gráficos e sem JavaScript no navegador.

## Histórias

### US1 — Dizer o preço de venda do produto (P1)

Como gerente ou chef, quero informar por quanto vendo cada produto.

1. Na página de um produto **vendido ao cliente**, o quadro "Preço de venda" tem o campo
   "Vendo por (R$)" e o botão "Salvar preço". Ex.: 28,00.
2. Preço precisa ser maior que zero, com até 2 casas (`INVALID_PRICE`). Em branco = sem preço.
3. Preparo não tem preço (é usado dentro de outros produtos); o quadro não aparece.
4. Com preço e custo, o quadro mostra: custo, quanto do preço vai em ingredientes (%), a faixa
   (dentro da faixa, atenção ou alto) e quanto sobra por venda (preço − custo).
5. Mudar o preço vai para o histórico do produto e não cria versão nova (versão é só para o que
   vai no produto).

### US2 — Ver o custo de todos os produtos numa tela (P1)

1. O menu ganha **"Custos"**. A página "Custo dos produtos" lista os produtos vendidos ativos.
2. No topo, um resumo em frases curtas: quantos produtos estão com custo alto, em atenção, sem
   preço e sem custo.
3. Cada produto mostra: nome (link), custo, preço, **custo no preço** (%) com barra e selo da
   faixa, quanto sobra por venda e **o que mais pesa** (a linha mais cara e quanto ela é do
   custo). Ex.: "Carne moída · 71% do custo".
4. A barra mostra a % do preço (0% a 100%; acima de 100% fica cheia). Uma marca nos 35% mostra
   onde termina a faixa comum.
5. Ordem: maior % primeiro (os que mais preocupam no topo); depois os sem preço; depois os sem
   custo. Empate em ordem alfabética.
6. Sem preço: "Sem preço" com o link "Definir preço" (vai ao produto). Sem custo: "Sem custo ainda"
   e qual item falta comprar.
7. Sem produtos vendidos: "Nenhum produto vendido cadastrado" com link para "Novo produto".

### US3 — Ver em quais produtos um item entra (P2)

Como dono, quando o preço de um item muda, quero ver quais pratos ele afeta.

1. Na página do item, o quadro "Usado nos produtos" lista os produtos ativos que usam o item,
   direto ou dentro de um preparo, com o custo de cada um e a % do preço (quando houver preço).
2. Item que não entra em nenhum produto diz "Este item ainda não entra em nenhum produto."

## Requisitos

- **FR-001** O produto ganha `sale_price` (`numeric(12,2)`, opcional). Maior que zero; só em
  produto vendido (check no banco). Mudança usa a trava otimista do produto (`STALE_RECORD`) e vai
  para a auditoria (campo "Preço de venda").
- **FR-002** Permissão: quem cadastra produto (`recipe.write`: gerente e chef) define o preço.
  Todos os papéis veem o painel. Tentativa negada vai para a auditoria.
- **FR-003** Custo no preço = custo ÷ preço × 100, exato; a tela mostra 1 casa. Sobra = preço −
  custo (pode ser negativa: "Prejuízo de R$ …").
- **FR-004** Faixas (manual, 10-indicadores): até 35% **dentro da faixa**; acima de 35% até 40%
  **atenção**; acima de 40% **alto**. A faixa vai em texto, não só em cor.
- **FR-005** O que mais pesa = a linha do produto com maior custo (item ou preparo), e a % dela no
  custo total. Só quando o produto tem custo.
- **FR-006** O custo é o mesmo da 003 (`recipeCost`, custo médio atual, versão mais nova). Nada é
  gravado: o painel calcula na hora.
- **FR-007** "Usado nos produtos": produto ativo cuja versão mais nova usa o item numa linha ou
  num preparo (em qualquer nível).
- **FR-008** Isolamento por restaurante (RLS). Textos sem "CMV" e "ficha técnica" soltos.

## Fora do escopo

CMV teórico do período e variância (precisam das vendas da 005), preço sugerido por meta de %,
markup, custo de embalagem de delivery, histórico do custo ao longo do tempo, exportar.

## Critérios de sucesso

- **SC-001** Em uma tela, o dono vê quais pratos estão caros demais e por quê (o que mais pesa).
- **SC-002** O painel abre em menos de 1 segundo com 200 produtos e 500 itens.
