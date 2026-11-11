# 6. Movimentações: para onde foi cada grama

> **Escopo simplificado (novembro de 2026).** Lote, validade, temperatura, NF-e e ajuste de
> inventário ficam fora. Não há contagem: a diferença entre o sistema e a prateleira é corrigida
> por um **acerto** pedido por quem lança e **aprovado por outro gerente**. Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).
>
> **Primeira versão (feature 004).** Existem: entrada por compra (valor total pago), perda com
> motivo da lista abaixo, acerto com aprovação e estorno. Menu **Lançamentos**; saldo na lista de
> itens e na página do item.
>
> **Venda pelo pedido (feature 011, entrega a 005).** O pedido baixa o estoque sozinho quando a
> cozinha começa o preparo (tipo 7 da tabela). Ver [abaixo](#venda-pelo-pedido-feature-011). Os
> demais tipos da tabela continuam fora.
>
> **Fornecedor na compra (feature 007).** A compra pode dizer de qual fornecedor foi e ser lançada
> na embalagem dele ("2 Caixas do fornecedor de 18 kg" = 36 kg). Fornecedor bloqueado não aparece.

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
- Saída que deixaria saldo negativo é bloqueada (perda, acerto, estorno). A exceção é o pedido
  (feature 011): a venda e a perda "Pedido cancelado" nunca são bloqueadas, porque o pedido não pode
  parar; o item avisa o saldo negativo.
- Acerto: qualquer pessoa que lança pode pedir, sempre com motivo; só um gerente que não seja quem
  pediu aprova. O saldo muda só na aprovação.
- Motivos implementados (lista fechada): perda de preparo (limpeza acima do normal, erro no
  preparo, queimou, cliente devolveu), estragou (venceu, estragou, praga), erro na operação (caiu
  ou quebrou, pedido feito errado, porção maior que a do produto, outro). Acerto: conferi na
  prateleira, lançamento esquecido, sumiu (possível furto), outro. Estorno: lançado errado,
  lançado em dobro, outro.
- Motivos lançados só pelo sistema (feature 011), que não aparecem no formulário: perda **"Pedido
  cancelado"** (família erro na operação) e estorno **"Pedido cancelado"**.

## Venda pelo pedido (feature 011)

Entrega a 005 do [roadmap](00-visao-geral.md#roadmap). Spec
[011, US4 e US5](../../../specs/011-fechamento-conta-mesa/spec.md).

- **Quando**: a cozinha toca **Começar preparo** (é quando os ingredientes saem da prateleira).
  Pedido só recebido não mexe no estoque. Cada pedido baixa uma vez só.
- **Quanto**: o consumo do pedido ([feature 010](../pedidos/04-adicionar-e-tirar.md#consumo-para-a-baixa-automática-feature-005)):
  a ficha da versão do envio, sem o que foi tirado, mais os adicionais × vezes, tudo × quantidade;
  preparos baixam seus ingredientes pelo rendimento. Mudar o produto depois não muda a baixa.
- **Como aparece**: uma saída **Venda** por item, na medida do item (até 4 casas; o que arredonda
  para zero não sai), com "Pedido 7, Mesa 12" de referência, a hora do fato e quem tocou "Começar
  preparo".
- **Custo**: o custo médio do momento. A venda não muda o custo médio. Item nunca comprado sai com
  custo zero e a linha mostra **"Sem custo"**.
- **Saldo negativo**: a venda nunca é bloqueada, nem por item inativo. Se o saldo fica negativo, o
  item mostra o saldo em destaque com o aviso "O estoque está menor que o que o sistema esperava.
  Lance a compra que faltou ou peça um acerto." Em **Repor**, saldo negativo conta como zero.
- **Corrigir**: venda não se lança nem se estorna à mão ("Esta saída veio de um pedido. Para
  desfazer, cancele o pedido na cozinha.").
- **Pedido cancelado depois do preparo**: a cozinha diz se os ingredientes já foram usados.
  - **Sim**: estorno da venda + **perda "Pedido cancelado"** com a mesma quantidade e custo. O saldo
    não muda; a saída passa a contar como perda.
  - **Não**: só o estorno; o saldo volta.
  - Os dois ficam ligados ao pedido, com quem e quando. Nada é editado nem apagado.
- **Gráficos** (feature 006): "o que mais saiu" conta as vendas, e "por motivo" mostra **Venda**
  separada das perdas.

## Critérios de aceite (para a spec)

- Toda movimentação tem tipo e motivo de listas fechadas.
- Saldo de um item = soma das movimentações daquele item (não há locais).
- Valor da saída = quantidade × custo médio no momento da saída.
- Entrada de compra recalcula o custo médio; saídas não alteram o custo médio.
