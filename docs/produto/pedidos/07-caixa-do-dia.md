# 7. Caixa do dia

O caixa abre o turno com o troco, registra o dinheiro que sai e entra na gaveta, conta o dinheiro
no fim e vê se bateu. O gerente vê o relatório de cada turno e as vendas do período. Spec
[014](../../../specs/014-fechamento-caixa/spec.md).

## Quem pode

| O que | Quem |
|---|---|
| Ver se o caixa está aberto (topo da tela Caixa) | Gerente, caixa, garçom |
| Abrir o caixa, sangria, reforço, tirar sangria ou reforço | Gerente, caixa (`cash.operate`) |
| Contar e fechar o turno que a própria pessoa abriu | Gerente, caixa |
| Fechar o turno aberto por outra pessoa | Gerente (`cash.close_any`) |
| Ver o dinheiro esperado do turno aberto | Gerente (`cash.expected`) |
| Turnos e relatório de cada turno | Gerente, caixa (`cash.history`) |
| Vendas (por forma de pagamento e por produto) e a planilha | Gerente (`sales.report`) |

## Abrir o caixa

O topo da tela **Caixa** mostra "Caixa fechado" e **Abrir caixa**. O caixa informa o **troco
inicial** (R$ 0,00 ou mais). O campo já vem com o que ficou na gaveta no último fechamento; se o
caixa muda o valor, a tela pede o porquê ("Ficaram R$ 150,00 na gaveta no último fechamento. Por
que o troco é outro?").

O restaurante tem **um caixa aberto por vez**. Se outra pessoa abriu um instante antes, a tela diz
"O caixa já foi aberto por Bruno às 11:01." Tocar duas vezes em **Abrir caixa** abre um turno só.

Com o caixa aberto, o topo mostra "Caixa aberto desde 11:02 · Ana" e os botões **Sangria**,
**Reforço** e **Fechar caixa**. Aberto há mais de 24 horas, avisa: "O caixa está aberto desde
ontem 11:02. Feche o caixa para conferir o turno."

## Receber

**Lançar pagamento** e **Tirar** pagamento (conta da mesa, [capítulo 5](05-conta-da-mesa.md)) só
funcionam com o caixa aberto. Sem caixa, os botões ficam desligados com "Abra o caixa antes de
receber." Cada pagamento fica no turno aberto naquela hora.

- Em dinheiro, entra na gaveta só o valor do pagamento: R$ 100,00 recebidos com R$ 23,00 de troco
  somam R$ 77,00.
- Pagamento tirado num turno seguinte sai do turno **de agora** e aparece no relatório como
  "Pagamentos tirados de outro turno". O turno antigo continua como foi conferido.
- Fechar uma conta de R$ 0,00 (tudo cancelado) não pede caixa aberto.

## Sangria e reforço

- **Sangria** é dinheiro que sai da gaveta: valor e motivo (**Cofre**, **Pagamento a fornecedor**,
  **Despesa do dia** ou **Outro**). Em Outro, a observação é obrigatória. A sangria não pode passar
  do dinheiro que a gaveta deve ter: "A gaveta deve ter R$ 127,00. A sangria não pode passar disso."
- **Reforço** é dinheiro que entra na gaveta: valor e observação opcional.
- Depois de gravar, a tela oferece **Imprimir comprovante** (folha de 80 mm com valor, motivo, hora,
  quem lançou e a linha de assinatura).
- Lançou errado? **Tirar** pede confirmação; o lançamento fica riscado, com quem tirou e quando, e
  deixa de contar. Tirar um reforço que deixaria a gaveta negativa é recusado.

## Contar e fechar

**Fechar caixa** abre a contagem. O caixa conta **sem ver o esperado**: informa o dinheiro da gaveta
(digitando o total ou pela calculadora de cédulas e moedas, de R$ 200 a R$ 0,05) e toca **Confirmar
contagem**. Só então a tela mostra o esperado e o resultado:

- **Bateu**, **Sobra R$ 3,00** ou **Falta R$ 2,00**. Com sobra ou falta, a observação é obrigatória.
- **Fica na gaveta**: vem com o contado; o resto é a **retirada do fechamento**, que deve chegar ao
  cofre.
- **Contar de novo** grava outra contagem. O relatório mostra todas ("1ª contagem R$ 120,00 · 2ª
  contagem R$ 125,00"); o fechamento usa a última.
- Se entrou pagamento, sangria ou reforço depois da contagem, o fechamento pede outra: "Entrou
  dinheiro no turno depois da contagem. Conte de novo."
- Mesas com conta aberta não seguram o fechamento: "3 mesas ainda têm conta aberta. Os pagamentos
  delas vão entrar no próximo turno."

Turno fechado não muda mais. Depois de fechar, a tela mostra o relatório do turno com **Imprimir**.

## Relatório do turno

Menu **Turnos** (gerente e caixa): a lista por período, com o selo Bateu, Sobra ou Falta. Cada
turno mostra quem abriu e fechou, o troco inicial, o recebido por forma de pagamento, a taxa de
serviço das contas fechadas no turno, as sangrias e os reforços e a conta do dinheiro passo a
passo:

```text
Troco inicial                                      R$ 150,00
+ Recebido em dinheiro                             R$  77,00
− Pagamentos em dinheiro tirados de outro turno    R$   0,00
+ Reforços                                         R$  50,00
− Sangrias                                         R$ 150,00
= Esperado na gaveta                               R$ 127,00
Contado                                            R$ 125,00
Diferença                                          Falta R$ 2,00
```

Com o caixa aberto, o relatório é parcial (sem contado e diferença) e o caixa não vê o esperado
antes de contar. A versão para imprimir diz "Não é documento fiscal".

## Vendas

Menu **Vendas** (só o gerente). Período de até 31 dias, padrão hoje.

- **Recebido por forma de pagamento**: a soma dos turnos abertos no período, com a taxa de serviço
  das contas fechadas no período.
- **Vendas por produto**: quantidade, valor (com os adicionais) e a parte de cada um no total, do
  que mais vendeu para o que menos vendeu. Pedido cancelado não conta. Os **adicionais** vendidos
  aparecem numa tabela à parte.
- Vendas e recebido podem ser diferentes: "Recebido conta o dinheiro que entrou nos turnos; vendas
  contam os pedidos feitos no período."
- Pedidos ainda não entregues contam nas vendas, com aviso.
- **Turnos do período** com a diferença de cada um e a soma.
- **Baixar planilha** gera um CSV que o Excel em português abre em colunas, com vírgula decimal.

## Fora desta versão

Mais de um caixa ao mesmo tempo, reabrir turno fechado, conferência de Pix e cartão com o extrato,
integração com maquininha e banco, aprovação da sangria por outra pessoa e nota fiscal.
