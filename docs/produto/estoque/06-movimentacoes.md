# 6. Movimentações: para onde foi cada grama

> **Escopo simplificado (novembro de 2026).** Lote, validade, temperatura, NF-e e ajuste de
> inventário ficam fora. Não há contagem: a diferença entre o sistema e a prateleira é corrigida
> por um **acerto** pedido por quem lança e **aprovado por outro gerente**. Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).
>
> **Primeira versão (feature 004).** Existem: entrada por compra (valor total pago), perda com
> motivo da lista abaixo, acerto com aprovação e estorno. Os demais tipos da tabela vêm depois
> (venda na 005). Menu **Lançamentos**; saldo na lista de itens e na página do item.

> Fonte: Manual de Referência, seção 4.

Separar as saídas é o que torna o estoque gerencial. Se tudo que sai vira "consumo", a diferença
entre o **teórico** (vendas × fichas) e o **real** (EI + compras − EF) vira caixa-preta, e fica
impossível distinguir erro de ficha, desperdício e furto.

- **Perda (waste):** perda conhecida e registrada.
- **Variância:** diferença não explicada, corrigida com acerto manual.

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
| 13 | Acerto manual (sobra ou falta) | – | Motivo e quem acertou | ± |

## Campos mínimos de todo registro

ID; tipo; data e hora **do fato** e **do lançamento**; usuário que lançou e que aprovou; item;
quantidade na medida do item (embalagens convertidas);
custo unitário e total no momento; local de origem e destino; **motivo em lista fechada** com campo
de observação; documento de referência; centro de custo.

> Motivos em texto livre não geram indicadores. O texto livre é só observação.

## Motivos de perda (lista fechada inicial)

Três famílias (Altametrics), com motivos:

- **Perda de preparo:** apara acima do FC, erro de preparo, queimado, devolvido pelo cliente.
- **Deterioração:** vencido, estragado, praga.
- **Erro operacional:** queda/quebra, pedido errado, porcionamento excessivo, outros.

## Regras

- O registro de perda é feito **na hora**: o quê, quanto, por quê e quem. "Se o cozinheiro não
  lança a proteína queimada, o sistema superestima o lucro."
- Movimentação lançada **não é editada nem apagada**. Correção = movimentação de estorno vinculada à
  original.
- Saída que deixaria saldo negativo é bloqueada (perda, acerto, estorno). Para vendas, a decisão
  fica para a feature 005 (proposta: permitir com alerta, o pedido não pode parar).
- Acerto: qualquer pessoa que lança pode pedir, sempre com motivo; só um gerente que não seja quem
  pediu aprova. O saldo muda só na aprovação.
- Motivos implementados (lista fechada): perda de preparo (limpeza acima do normal, erro no
  preparo, queimou, cliente devolveu), estragou (venceu, estragou, praga), erro na operação (caiu
  ou quebrou, pedido feito errado, porção maior que a do produto, outro). Acerto: conferi na
  prateleira, lançamento esquecido, sumiu (possível furto), outro. Estorno: lançado errado,
  lançado em dobro, outro.

## Critérios de aceite (para a spec)

- Toda movimentação tem tipo e motivo de listas fechadas.
- Saldo de um item = soma das movimentações daquele item (não há locais).
- Valor da saída = quantidade × custo médio no momento da saída.
- Entrada de compra recalcula o custo médio; saídas não alteram o custo médio.
