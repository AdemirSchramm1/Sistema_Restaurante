# 3. Cozinha e garçom

Spec [009, US4, US5 e US6](../../../specs/009-pedidos-qr-mesa/spec.md). A baixa do estoque e o
cancelamento depois do preparo vêm da [011](../../../specs/011-fechamento-conta-mesa/spec.md).

## Situações do pedido

```text
Recebido ──► Em preparo ──► Pronto ──► Entregue
    │            │            │
    └────────────┴────────────┴──► Cancelado (com motivo)
```

- Só para frente, um passo por vez. Entregue e Cancelado são finais.
- Cada mudança grava quem e quando. Pedido e linhas não mudam nem são apagados depois do envio;
  erro se corrige cancelando.
- Duas telas mudando o mesmo pedido: a segunda vê "Este pedido mudou em outra tela." e a tela
  atualiza.

## Tela da Cozinha

- Três colunas: **Recebidos**, **Em preparo**, **Prontos**, o mais antigo primeiro.
- Cada pedido mostra "Mesa N" em destaque, quem lançou ("João" ou "QR code", spec 015), o número,
  há quantos minutos chegou e as linhas com as mudanças embaixo do prato ("+ 2 Fatia de queijo",
  "**SEM** cebola") e a observação da equipe em destaque ("Obs.: mal passado").
- Pedido novo aparece sozinho em até 10 segundos (a tela atualiza a cada 5), marcado **Novo**.
- **Atrasado**: recebido ou em preparo há mais de 20 minutos (borda e texto, não só cor).
- Botões **Começar preparo** e **Pronto**. **Começar preparo** baixa do estoque o que o pedido usa
  (ver abaixo).
- **Cancelar** pede o motivo: cliente desistiu, acabou o produto, pedido indevido, lançado errado
  (015) ou outro (com texto de até 140 letras). Depois do preparo, pergunta também pelos ingredientes (ver abaixo).
- **Esgotado hoje**: lista dos produtos do cardápio com o interruptor. Esgotado sai do cardápio do
  cliente até o fim do dia e volta sozinho no dia seguinte. Também na página do produto.

## Baixa do estoque (feature 011)

Quando a cozinha toca **Começar preparo**, os ingredientes saem da prateleira: o sistema lança, na
mesma hora, uma saída por venda para cada item do consumo do pedido (a ficha da versão do envio,
sem o que foi tirado, mais os adicionais, tudo × quantidade; ver
[04-adicionar-e-tirar](04-adicionar-e-tirar.md#consumo-para-a-baixa-automática-feature-005)).

- Pedido só recebido não mexe no estoque. Cada pedido baixa uma vez só, mesmo com toque duplo ou
  duas telas.
- A baixa nunca segura o pedido: se o saldo fica negativo, o item avisa (ver
  [06-movimentacoes](../estoque/06-movimentacoes.md#venda-pelo-pedido-feature-011)).
- Exemplo da spec: 2 × X-Burger com + 2 Fatia de queijo e sem cebola baixa pão 2 un, carne 0,3 kg
  e queijo 0,14 kg; a cebola não baixa. Em **Lançamentos** aparece "Venda" com "Pedido 1, Mesa 12".

## Cancelar depois do preparo (feature 011)

| Situação do pedido | O que o cancelamento faz no estoque |
|---|---|
| Recebido | Nada: o estoque ainda não baixou |
| Em preparo ou Pronto | Pergunta **"Os ingredientes já foram usados?"** (padrão: Sim) |

- **Sim, vão para a perda**: a venda é estornada e o mesmo consumo sai como **perda** com motivo
  "Pedido cancelado". O saldo não muda; a saída passa a contar como perda.
- **Não, voltam para o estoque**: a venda é estornada e o saldo volta ao de antes do preparo.
- Nada é apagado: venda, estorno e perda ficam em **Lançamentos**, com quem e quando.
- O pedido cancelado sai do total da conta da mesa.

## Tela do Garçom

- Só os pedidos **Prontos**, o que ficou pronto primeiro em cima, com "Mesa N" bem grande.
- Cada pronto mostra quem lançou e a observação; o filtro **Só os meus** deixa só os pedidos que
  a pessoa lançou (spec 015).
- **Entregue** tira o pedido da tela.

O garçom também lança pedidos e cancela o próprio pedido ainda em Recebido: ver
[08 — Lançar pedido](08-lancar-pedido.md).

## Consulta de pedidos

Tela **Pedidos**: lista por período (até 31 dias; padrão hoje), mesa, situação e **Lançado por**
(QR code ou a pessoa da equipe), com número, dia, hora, mesa, quem lançou, situação e total. No fim,
o resumo **Por quem lançou**: pedidos não cancelados, total e cancelados por motivo de cada origem. Abrir um pedido mostra as linhas com preços, adicionais, retiradas e
o histórico de situações com quem mudou e quando.
