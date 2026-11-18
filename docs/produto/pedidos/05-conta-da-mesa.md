# 5. Conta da mesa e caixa

Spec [011 — Fechar a conta da mesa e baixar o estoque](../../../specs/011-fechamento-conta-mesa/spec.md).
Decisões do dono: o estoque baixa quando a cozinha começa o preparo; a conta se divide em partes
iguais ou por valor livre; a taxa de serviço é configurável (padrão ligada, 10%).

```text
1º pedido da mesa ──► conta aberta ──► mais pedidos entram nela ──► pagamentos ──► Fechar conta
                                                                                       │
                                                         mesa livre: o próximo pedido abre outra conta
```

## A conta abre sozinha

- Não há botão "abrir mesa". A conta abre no primeiro pedido enviado pela mesa sem conta aberta,
  pelo QR code ou lançado pela equipe ([capítulo 8](08-lancar-pedido.md)); o histórico guarda quem
  lançou esse pedido.
- Cada mesa tem no máximo **uma conta aberta**. Todo pedido da mesa, de qualquer celular, entra
  nela até ela fechar. A conta mostra quem lançou cada pedido e a observação para a cozinha.
- A conta guarda a taxa de serviço do restaurante no momento em que abriu.

## Tela Caixa

Menu **Caixa**. Lista as mesas com conta aberta e atualiza sozinha a cada 10 segundos:

- "Mesa 12", há quanto tempo a conta está aberta ("há 35 min") e o total até agora;
- quanto falta ("Falta R$ 49,86"), **Pago** ou **Pago a mais**;
- quantos pedidos ainda não chegaram à mesa ("1 pedido ainda não foi entregue").

Depois de fechar uma conta, o caixa volta para esta tela com o aviso "Conta da Mesa 12 fechada. A
mesa está livre para o próximo cliente." O gerente também configura aqui a **taxa de serviço do
restaurante** e abre as **Contas fechadas**.

## A conta da mesa

Tocando na mesa:

| Parte | O que mostra |
|---|---|
| Pedidos | Cada pedido com as linhas, "+ 2 Fatia de queijo", "**SEM** cebola", preço e a situação. Pedido cancelado aparece riscado com o motivo e não entra no total |
| Total da conta | Subtotal, "Serviço 10%", Total, Pago e Falta |
| Receber | Lançar pagamento e "Dividir a conta" |
| Pagamentos | Os lançados, inclusive os tirados (riscados, com quem tirou e quando) |
| Histórico da conta | Abriu, pagamento lançado e tirado, taxa tirada e posta de volta, fechou, reabriu |

Contas, com o exemplo da spec (2 × X-Burger com + 2 Fatia de queijo, sem cebola):

```text
subtotal = soma dos pedidos não cancelados      R$ 68,00
serviço  = subtotal × 10%, em centavos          R$  6,80   (meio centavo arredonda para cima)
total    = subtotal + serviço                   R$ 74,80
pago     = soma dos pagamentos não tirados
falta    = total − pago
```

Pedido ainda não entregue (Recebido, Em preparo, Pronto) entra no total, mas segura o fechamento.

## Taxa de serviço

- **Do restaurante** (só gerente, tela Caixa): de 0% a 20%, com até 2 casas ("12,5"). Vazio desliga a
  taxa. Todo restaurante começa com 10%. Mudar vale para as contas que abrirem depois; conta aberta
  ou fechada fica com a taxa que tinha.
- **Da conta** (gerente e caixa): **Tirar taxa de serviço** pede confirmação ("Tirar a taxa de
  serviço de R$ 6,80 desta conta?") e vai para o histórico com quem e quando. **Pôr taxa de volta**
  desfaz.
- Se já foi pago mais do que a conta sem a taxa, o sistema não deixa tirar: "Já foram pagos R$ 74,80
  e, sem a taxa, a conta fica em R$ 68,00. Tire um pagamento antes de tirar a taxa."

## Pagamento

Formas (lista fechada): **Dinheiro**, **Pix**, **Cartão de débito**, **Cartão de crédito** e
**Outro**. O sistema só registra o que o caixa já recebeu: não há ligação com maquininha nem banco.

- O **valor** já vem com o que falta. Ele é o que entra na conta: maior que zero, com até 2 casas e
  **nunca acima do que falta**, em qualquer forma ("O valor passa do que falta pagar (R$ 24,93).").
- Em **dinheiro**, o caixa pode digitar o **recebido**; a tela mostra o troco ("Troco: R$ 25,07")
  e o pagamento guarda valor, recebido e troco. Recebido menor que o valor é recusado.
- A conta aceita vários pagamentos, de formas diferentes.
- Toque duplo em "Lançar pagamento" não lança duas vezes; duas telas pagando a mesma conta nunca
  passam do total.
- **Tirar** (pagamento lançado errado): pede confirmação. O pagamento não some: fica riscado, com
  quem tirou e quando, e deixa de contar no pago.

## Dividir a conta

"Dividir a conta" é só uma ajuda para o valor; não grava nada.

- **Partes iguais**: de 2 a 20 pessoas, sobre o que **falta**. Os centavos que sobram vão para a
  primeira parte (R$ 74,80 ÷ 3 = R$ 24,94 + R$ 24,93 + R$ 24,93). "Pagar parte 1 de 3" põe o valor
  no pagamento; cada parte é paga em qualquer forma.
- Mudar o número de pessoas refaz as partes sobre o que falta.
- **Valor livre**: a qualquer momento o caixa digita outro valor no pagamento (um paga R$ 50,00 e o
  resto divide).

## Fechar conta

**Fechar conta** só fica liberado com **falta R$ 0,00** e **todos os pedidos entregues ou
cancelados**. Enquanto não, o botão fica desligado com o motivo: "Ainda falta pagar R$ 12,00." ou "A
mesa tem pedidos que ainda não foram entregues."

Fechar:

- grava quem fechou e quando, e os valores da conta;
- **libera a mesa**: a conta sai do Caixa e os cardápios abertos naquela mesa fecham na hora (quem
  estava com o cardápio aberto vê "Esta conta foi fechada. Escaneie o QR code da mesa para pedir de
  novo.");
- o próximo pedido da mesa abre uma conta nova, vazia.

Casos especiais:

- Conta com todos os pedidos cancelados: total R$ 0,00; fecha sem pagamento.
- Pedido que chega no mesmo instante do fechamento: ou entra na conta antes (e o fechamento é
  recusado: "A conta mudou. Confira de novo."), ou abre a conta nova. Nunca fica fora de conta.
- **Pago a mais**: acontece se um pedido é cancelado depois de pago. A conta mostra "Pago a mais" e
  não fecha: "Tire um pagamento e lance de novo com o valor certo."
- Mesa inativada com conta aberta: a conta continua no Caixa até fechar.

## Imprimir conta

"Imprimir conta" abre uma folha simples, que cabe na impressora térmica de 80 mm ou numa folha A4,
com o nome do restaurante, a mesa, a data e a hora, as linhas dos pedidos não cancelados, subtotal,
serviço, total (e pago e falta, se já houve pagamento) e **"Não é documento fiscal"**.

## Contas fechadas

Menu **Contas** (ou "Contas fechadas" no Caixa). Gerente e caixa.

- Período de até 31 dias (padrão hoje) e mesa. O dia da conta é o dia do restaurante em que ela
  fechou.
- Lista com o dia, a mesa, a hora em que abriu e fechou, quem fechou, a taxa e o total; a mais
  recente primeiro. Abrir uma conta mostra os pedidos, os pagamentos (inclusive os tirados) e o
  histórico.
- **Resumo do período**: quanto entrou por forma de pagamento (sem os pagamentos tirados), o total de
  taxa de serviço e o total das contas.

## Reabrir conta

Só o **gerente**, na conta fechada, com motivo (1 a 140 letras). Serve para corrigir um pagamento
lançado errado.

- A conta volta para o Caixa com os pagamentos que tinha e sai das contas fechadas.
- O histórico guarda o motivo, quem reabriu e os valores de antes (subtotal, taxa, total, quem
  fechou e quando).
- Se a mesa já abriu outra conta, a reabertura é recusada: "A mesa já tem outra conta aberta.
  Feche-a antes."

## Quem pode

| Ação | Quem pode |
|---|---|
| Ver o Caixa e a conta aberta; imprimir a conta aberta | Gerente, caixa, garçom |
| Lançar e tirar pagamento; tirar e pôr a taxa da conta; fechar conta | Gerente, caixa |
| Contas fechadas (a lista, cada conta fechada e o resumo por forma de pagamento) | Gerente, caixa |
| Reabrir conta | Gerente |
| Taxa de serviço do restaurante | Gerente |

O papel **Caixa** entra direto no Caixa. O garçom vê o Caixa para levar o total à mesa (ou chega
pela **Ver conta** da mesa, com **Voltar à Mesa 12**), mas não recebe nem abre conta fechada. Detalhes e nomes das permissões em
[09-controles-e-permissoes](../estoque/09-controles-e-permissoes.md#conta-da-mesa-feature-011).
Toda escrita (pagamento, pagamento tirado, taxa, fechamento, reabertura) vai para a trilha de
auditoria com quem e quando.

## Ligação com o estoque

O estoque baixa sozinho quando a cozinha toca **Começar preparo**, não no fechamento da conta. Ver
[06-movimentacoes](../estoque/06-movimentacoes.md#venda-pelo-pedido-feature-011) e
[03 — Cozinha e garçom](03-cozinha-e-garcom.md#cancelar-depois-do-preparo-feature-011).

## Fora desta versão

Desconto e cortesia, couvert, dividir por itens, transferir pedido entre mesas e juntar mesas,
pagamento pelo celular do cliente, maquininha e Pix automático, nota fiscal, pedido lançado pela
equipe e delivery. Abrir e fechar o caixa (troco, sangria, reforço, contagem) é o
[capítulo 7](07-caixa-do-dia.md): desde a spec 014, lançar e tirar pagamento exigem o caixa aberto.

## Fechar a conta e o tablet da mesa (spec 016)

Fechar a conta encerra os acessos dos **celulares** da mesa (QR code), mas **não desliga o tablet
fixo na mesa**: em até 10 segundos ele volta às boas-vindas sem nada da conta fechada, e o próximo
pedido dele abre uma conta nova. Um pedido do tablet enviado no instante do fechamento cai na conta
que fechou (se chegou antes) ou numa conta nova, nunca fora de conta.
