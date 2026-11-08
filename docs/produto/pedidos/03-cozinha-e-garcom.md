# 3. Cozinha e garçom

Spec [009, US4, US5 e US6](../../../specs/009-pedidos-qr-mesa/spec.md).

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
- Cada pedido mostra "Mesa N" em destaque, o número, há quantos minutos chegou e as linhas com as
  mudanças embaixo do prato ("+ 2 Fatia de queijo", "**SEM** cebola").
- Pedido novo aparece sozinho em até 10 segundos (a tela atualiza a cada 5), marcado **Novo**.
- **Atrasado**: recebido ou em preparo há mais de 20 minutos (borda e texto, não só cor).
- Botões **Começar preparo** e **Pronto**.
- **Cancelar** pede o motivo: cliente desistiu, acabou o produto, pedido indevido ou outro (com
  texto de até 140 letras).
- **Esgotado hoje**: lista dos produtos do cardápio com o interruptor. Esgotado sai do cardápio do
  cliente até o fim do dia e volta sozinho no dia seguinte. Também na página do produto.

## Tela do Garçom

- Só os pedidos **Prontos**, o que ficou pronto primeiro em cima, com "Mesa N" bem grande.
- **Entregue** tira o pedido da tela.

## Consulta de pedidos

Tela **Pedidos**: lista por período (até 31 dias; padrão hoje), mesa e situação, com número, dia,
hora, mesa, situação e total. Abrir um pedido mostra as linhas com preços, adicionais, retiradas e
o histórico de situações com quem mudou e quando.
