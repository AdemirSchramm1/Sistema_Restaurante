# 6. Movimentações: para onde foi cada grama

> Fonte: Manual de Referência, seção 4.

Separar as saídas é o que torna o estoque gerencial. Se tudo que sai vira "consumo", a diferença
entre o **teórico** (vendas × fichas) e o **real** (EI + compras − EF) vira caixa-preta, e fica
impossível distinguir erro de ficha, desperdício e furto.

- **Perda (waste):** perda conhecida e registrada.
- **Variância:** diferença não explicada, descoberta na contagem.

## Os treze tipos

| # | Movimentação | Documento / referência | Dados específicos | Efeito no saldo |
|---|---|---|---|---|
| 1 | Entrada por compra | NF-e (chave/XML), pedido | Lote, validade, temperatura medida, conferente | + |
| 2 | Entrada por bonificação ou troca | Nota ou observação | Custo zero ou de reposição | + |
| 3 | Devolução ao fornecedor | NF de devolução, ficha de devolução | Motivo: temperatura, validade, avaria, fora do padrão | − |
| 4 | Requisição / transferência interna (almoxarifado → praça ou bar) | Requisição | Solicitante, aprovador, origem, destino | − origem, + destino |
| 5 | Transferência entre unidades / cozinha central | Guia e NF quando houver | Status: solicitada → expedida → em trânsito → recebida; divergência | − origem, + trânsito, + destino |
| 6 | Produção | Ordem de produção | Rendimento previsto × real, lote interno, validade da etiqueta | − ingredientes, + sub-receita |
| 7 | Venda com ficha técnica | Pedido ou cupom do PDV | Baixa teórica, incluindo adicionais e retiradas | − |
| 8 | Venda de item de revenda | Cupom | Baixa direta | − |
| 9 | Perda ou quebra | Registro de perda; NF CFOP 5.927 quando exigida | Motivo, responsável, turno | − |
| 10 | Consumo interno / refeição de funcionários | Lançamento no PDV | Quem consumiu | − |
| 11 | Cortesia | Mesa ou pedido | Quem autorizou | − |
| 12 | Degustação, marketing ou doação | Registro | Finalidade | − |
| 13 | Ajuste de inventário (sobra ou falta) | Contagem de referência | Justificativa e aprovador | ± |

## Campos mínimos de todo registro

ID; tipo; data e hora **do fato** e **do lançamento**; usuário que lançou e que aprovou; item;
quantidade e unidade (convertida para a unidade de estoque); lote e validade (quando controlados);
custo unitário e total no momento; local de origem e destino; **motivo em lista fechada** com campo
de observação; documento de referência; centro de custo.

> Motivos em texto livre não geram indicadores. O texto livre é só observação.

## Motivos de perda (lista fechada inicial)

Três famílias (Altametrics), com motivos:

- **Perda de preparo:** apara acima do FC, erro de preparo, queimado, devolvido pelo cliente.
- **Deterioração:** vencido, estragado, temperatura fora da faixa, praga.
- **Erro operacional:** queda/quebra, pedido errado, porcionamento excessivo, outros.

## Regras

- O registro de perda é feito **na hora**: o quê, quanto, por quê e quem. "Se o cozinheiro não
  lança a proteína queimada, o sistema superestima o lucro."
- Movimentação lançada **não é editada nem apagada**. Correção = movimentação de estorno vinculada à
  original.
- Saída que deixaria saldo negativo: permitida apenas para vendas (o PDV não pode parar), gerando
  alerta para investigação. Demais saídas são bloqueadas. *(Decisão a confirmar na spec.)*
- Ajuste de inventário exige aprovador diferente de quem lançou (ver [controles](09-controles-e-permissoes.md)).

## Critérios de aceite (para a spec)

- Toda movimentação tem tipo e motivo de listas fechadas.
- Saldo de um item em um local = soma das movimentações daquele item naquele local.
- Valor da saída = quantidade × custo médio no momento da saída.
- Entrada de compra recalcula o custo médio; saídas não alteram o custo médio.
