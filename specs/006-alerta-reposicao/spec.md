# Feature 006 — Alerta de reposição e gráficos do estoque

**Branch**: `claude/project-thread-fb5wm0` · **Criada**: 2026-11-02 · **Status**: em revisão

## Contexto

Com a [004](../004-entradas-perdas-saldo/spec.md) o sistema sabe quanto tem de cada item, mas
ninguém é avisado quando um item está acabando. Esta feature cria o **aviso de reposição**
(regras em [08-ciclo-operacional](../../docs/produto/estoque/08-ciclo-operacional.md#planejamento))
e, a pedido do dono, uma página de **gráficos** com o que mais saiu, o que menos saiu e por quê.

A baixa por pedido (005) ainda não existe. Até ela chegar, as **saídas** são só as perdas e os
acertos para menos; os gráficos e a sugestão do sistema já funcionam e ficam mais úteis quando os
pedidos começarem a baixar o estoque.

O dono pediu que os gráficos sejam leves: contas feitas no banco, desenho com barras simples
(HTML e CSS), sem biblioteca de gráficos.

## Histórias

### US1 — Dizer quando avisar (P1)

Como gerente, chef ou comprador, quero dizer em quanto cada item precisa ser comprado de novo.

1. Na página do item, no quadro "Aviso de reposição", preencho:
   - **Avisar quando chegar em** (ponto de pedido), na medida do item. Ex.: 10 kg.
   - **Comprar até** (estoque desejado depois da compra), opcional. Ex.: 30 kg.
2. "Comprar até" precisa ser maior que "Avisar quando chegar em" (`INVALID_REORDER_LEVELS`).
3. Deixar "Avisar quando chegar em" em branco desliga o aviso do item.
4. Se o item já teve saídas, o quadro mostra a **sugestão do sistema** (conta do manual) com o
   botão "Usar sugestão", que preenche os dois campos. Sem saídas, explica que a sugestão aparece
   quando houver consumo.

### US2 — Ver o que precisa comprar (P1)

1. O menu mostra **"Repor"** com o número de itens que chegaram no ponto (ex.: "Repor (3)").
2. A página "Repor" lista os itens ativos com saldo **menor ou igual** ao "Avisar quando chegar em",
   os que acabaram primeiro: item, quanto tem, quando avisar, **quanto comprar** e o fornecedor
   preferido (nome, telefone, prazo de entrega).
3. Quanto comprar = Comprar até − (saldo − consumo durante o prazo de entrega), arredondado para
   cima na embalagem (do fornecedor preferido, senão a do item). Ex.: "4 Caixas (80 kg)".
   Sem "Comprar até", a coluna diz "Defina 'Comprar até' no item".
4. A lista de itens mostra o selo **"Repor"** nos itens que estão no ponto.

### US3 — Ver os gráficos do estoque (P1)

1. No menu "Gráficos", escolho o período: **7, 30 ou 90 dias** (padrão 30).
2. Vejo, em barras simples:
   - **Resumo**: quanto entrou (compras, R$), quanto saiu (R$), quanto foi perda (R$) e quantos
     itens estão para repor.
   - **Itens que mais saíram** (10 primeiros), pelo valor em R$, com a quantidade ao lado.
   - **Itens que menos saíram** (10), incluindo os que têm estoque e não saíram nada ("parado").
   - **Saídas por motivo** (Queimou, Venceu, Sumiu…), em R$.
   - **Entradas e saídas por semana**, em R$.
3. A ordem é pelo valor (R$) porque quilo, litro e unidade não se comparam entre si.
4. Sem movimento no período, cada gráfico diz "Nada no período".

## Requisitos

- **FR-001** O item ganha `reorder_point` e `par_level` (opcionais, `numeric(14,4)`, na medida do
  item). Ponto ≥ 0; "Comprar até" só com ponto e maior que ele. Mudança vai para a auditoria e usa
  a trava otimista do item (`STALE_RECORD`).
- **FR-002** Permissão `item.reorder` = gerente, chef e comprador. Todos que veem o estoque veem o
  aviso e os gráficos. Tentativa negada vai para a auditoria.
- **FR-003** Item no ponto: ativo, com ponto definido e saldo ≤ ponto.
- **FR-004** **Saída** = movimentação com quantidade negativa que não é estorno e não foi estornada
  (hoje: perdas e acertos para menos; depois, baixas por pedido). O valor é o custo gravado na
  movimentação. A data é a do fato (`occurred_at`).
- **FR-005** Sugestão (manual, 08): CMD = saídas dos últimos 30 dias ÷ 30; LT = prazo do fornecedor
  preferido (sem prazo: 1 dia); ciclo C = 7 ÷ número de dias de entrega do preferido (sem dias:
  7); margem 20%. ES = CMD × C × margem; PP = CMD × LT + ES; Par = CMD × C + ES. Arredondada para
  cima em 2 casas só na tela. Sem consumo, não há sugestão.
- **FR-006** Quanto comprar = máx(0, Par − (saldo − CMD × LT)); não há pedido em trânsito (não
  existe pedido de compra). Na embalagem: arredonda para cima.
- **FR-007** Gráficos: contas agregadas no banco (uma consulta por gráfico), desenho em HTML e CSS,
  sem JavaScript no navegador e sem biblioteca nova. Isolamento por restaurante (RLS).

## Fora do escopo

Aviso por e-mail ou WhatsApp, pedido de compra ao fornecedor, par por dia da semana, curva ABC,
gráfico de CMV (espera a 005 e a 008), exportar gráficos.

## Critérios de sucesso

- **SC-001** Em uma tela, o dono vê o que precisa comprar e de quem.
- **SC-002** A página de gráficos abre em menos de 1 segundo com 500 itens e 10 mil movimentações.
