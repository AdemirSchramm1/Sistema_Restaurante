# Feature 011 — Fechar a conta da mesa e baixar o estoque pelos pedidos

**Branch**: `claude/project-thread-s5zyo4` · **Criada**: 2026-11-11 · **Status**: em revisão

**Pedido do dono**: "Então vamos melhorar o que já existe, depois passamos para outras partes:
fechamento da conta da mesa (caixa: ver o total, dividir, registrar o pagamento e liberar a mesa),
e junto dar baixa no estoque pelos itens vendidos usando as fichas técnicas."

## Contexto

Os clientes já pedem pelo QR code e a cozinha e o garçom já levam o prato
([009](../009-pedidos-qr-mesa/spec.md)); cada linha do pedido já guarda a versão do produto, os
adicionais e as retiradas, e o sistema já sabe calcular quanto de cada item a linha usa
([010](../010-adicionais-retiradas/spec.md), "consumo da linha"). Falta:

1. **A conta da mesa.** Hoje os pedidos de uma mesa são soltos: ninguém vê quanto a mesa deve no
   total, não há onde registrar o pagamento e a mesa nunca "fecha".
2. **A baixa do estoque.** O estoque só diminui por perda e acerto. Esta feature entrega a
   [005 — Baixa automática por pedido](../../docs/produto/estoque/00-visao-geral.md#roadmap) do
   roadmap: cada pedido tira do estoque o que a ficha técnica diz que ele usou.

As duas partes vêm juntas porque fecham o ciclo do pedido: o cliente pede, a cozinha faz (o estoque
baixa), o garçom entrega e o caixa recebe e libera a mesa.

## Histórias

### US1 — Ver a conta da mesa com o total (P1)

Como caixa, quero ver quanto cada mesa deve, com tudo o que foi pedido, para cobrar o cliente.

**Por que P1**: sem o total não dá para cobrar; é a base das outras histórias.

**Teste independente**: com a mesa 12 tendo dois pedidos entregues (2 × X-Burger com + 2 Fatia de
queijo a R$ 34,00 e 1 Suco a R$ 9,00), abrir "Caixa", escolher a mesa 12 e ver as linhas, o
subtotal R$ 77,00, a taxa de serviço e o total.

**Cenários**

1. O menu ganha **"Caixa"**. A tela lista as mesas com **conta aberta**: nome da mesa, total até
   agora, há quanto tempo a conta está aberta e quantos pedidos ainda não foram entregues.
2. A conta da mesa abre sozinha no primeiro pedido enviado depois que a mesa foi liberada (ou no
   primeiro pedido da mesa). Não há botão "abrir mesa".
3. Todos os pedidos enviados pela mesa enquanto a conta está aberta, de qualquer celular, entram
   nessa conta.
4. Abrindo a conta, vejo as linhas de todos os pedidos (quantidade, produto, "+ 2 Fatia de queijo",
   "**SEM** cebola", preço), o **subtotal**, a **taxa de serviço** ("Serviço 10%"), o
   **total**, quanto já foi **pago** e quanto **falta**.
5. Pedido cancelado aparece riscado com o motivo e não entra no total.
6. Pedido ainda não entregue (Recebido, Em preparo, Pronto) entra no total, marcado com a situação,
   e a tela avisa "2 pedidos ainda não foram entregues".
7. A tela atualiza sozinha: um pedido novo da mesa aparece na conta em até 10 segundos.
8. **Tirar taxa de serviço** (o cliente não quer pagar): pede confirmação, a taxa vira R$ 0,00
   nessa conta e o histórico da conta registra quem tirou e quando. **Pôr taxa de volta** desfaz.
9. **Imprimir conta**: folha simples com o nome do restaurante, a mesa, as linhas, subtotal, taxa,
   total e "Não é documento fiscal".

### US2 — Registrar o pagamento e liberar a mesa (P1)

Como caixa, quero registrar como o cliente pagou e liberar a mesa para o próximo cliente.

**Por que P1**: é a entrega principal pedida pelo dono.

**Teste independente**: na conta de R$ 77,00 (sem taxa), registrar R$ 77,00 em Pix, tocar
"Fechar conta" e ver a mesa sumir da lista do caixa; o próximo pedido pelo QR code da mesa 12 abre
uma conta nova, vazia.

**Cenários**

1. **Registrar pagamento**: escolho a forma (Dinheiro, Pix, Cartão de débito, Cartão de crédito,
   Outro) e o valor. O valor já vem preenchido com o que falta.
2. Em dinheiro, posso digitar o valor recebido acima do que falta; a tela mostra o **troco**
   ("Troco: R$ 23,00") e registra como pago só o que faltava.
3. Nas outras formas, o valor não pode passar do que falta: "O valor passa do que falta pagar
   (R$ 40,00)."
4. A conta pode ter vários pagamentos, de formas diferentes. "Falta" diminui a cada um.
5. **Tirar pagamento** (lançado errado) antes de fechar: pede confirmação e vai para o histórico
   da conta; o pagamento não some, fica marcado como tirado, com quem e quando.
6. **Fechar conta** só fica disponível quando falta R$ 0,00 **e** todos os pedidos da mesa estão
   entregues ou cancelados. Se não: "Ainda falta pagar R$ 12,00" ou "A mesa tem pedidos que ainda
   não foram entregues".
7. Fechar a conta **libera a mesa**: a conta sai da lista do caixa, os cardápios abertos naquela
   mesa fecham na hora (quem estava com o cardápio aberto vê "Esta conta foi fechada. Escaneie o
   QR code da mesa para pedir de novo.") e o próximo pedido da mesa abre conta nova.
8. Conta fechada fica na consulta de contas (US4) com os pagamentos, quem fechou e quando.

### US3 — Dividir a conta (P1)

Como caixa, quero dividir a conta entre as pessoas da mesa, cada uma pagando a sua parte.

**Por que P1**: pedido explícito do dono; mesa com várias pessoas é o caso comum.

**Teste independente**: conta de R$ 100,00, dividir por 3, registrar três pagamentos (R$ 33,34 no
cartão, R$ 33,33 em Pix, R$ 33,33 em dinheiro) e fechar.

**Cenários** (Q2 decidida: partes iguais e valor livre)

1. **Dividir por pessoas**: informo quantas pessoas (2 a 20). A tela mostra o valor de cada parte;
   os centavos que sobram vão para a primeira parte (R$ 100,00 ÷ 3 = R$ 33,34 + R$ 33,33 +
   R$ 33,33). Cada parte vira um botão "Pagar parte 1 de 3" que preenche o valor do pagamento.
2. Dividir é só uma ajuda para o valor: cada parte é paga com um pagamento normal (US2), em
   qualquer forma.
3. Se um pagamento foi registrado antes de dividir, a divisão é feita sobre o que **falta**.
4. Mudar o número de pessoas no meio refaz as partes sobre o que falta.
5. A qualquer momento posso registrar um valor livre (ex.: um paga R$ 50,00 e o resto divide).

### US4 — O estoque baixa sozinho pelos pedidos (P1)

Como dono, quero que o estoque diminua conforme a cozinha faz os pratos, pela ficha técnica, para
saber o que tenho sem contar a prateleira.

**Por que P1**: segunda metade do pedido do dono e prioridade 2 do manual ("baixa automática a
cada pedido").

**Teste independente**: com X-Burger (pão 1 un, carne 150 g, queijo 30 g, cebola 20 g) e saldo de
queijo 1 kg, enviar 2 × X-Burger com + 2 Fatia de queijo (20 g) e sem cebola, a cozinha tocar
"Começar preparo" e ver na página do queijo uma saída "Venda — pedido 7, Mesa 12" de 0,14 kg e o
saldo 0,86 kg; o pão baixa 2 un, a carne 0,3 kg e a cebola não baixa.

**Cenários** (Q1 decidida: baixa ao começar o preparo)

1. A baixa acontece quando a cozinha toca **"Começar preparo"** (é quando os ingredientes saem da
   prateleira). Pedido só recebido não mexe no estoque.
2. A quantidade de cada item é o consumo do pedido da 010: a ficha da versão do envio, sem o que
   foi retirado, mais os adicionais × vezes, tudo × quantidade; preparos baixam seus ingredientes
   pelo rendimento.
3. Cada item do pedido vira uma **saída por venda** no livro de movimentações, com o pedido e a mesa
   como referência, a hora do fato, quem tocou "Começar preparo" e o custo médio do item naquele
   momento. A saída não muda o custo médio.
4. A saída por venda **nunca é bloqueada** por falta de saldo: o pedido não pode parar. Se o saldo
   fica negativo, o item mostra o saldo negativo em destaque ("−0,20 kg: o estoque está menor que
   o que o sistema esperava. Lance a compra que faltou ou peça um acerto.") e aparece em "Repor".
5. Item sem custo ainda (nunca comprado) baixa a quantidade com custo zero, e a saída mostra "Sem
   custo".
6. Mudar a ficha técnica depois do pedido não muda a baixa: vale a versão gravada no envio.
7. Na página do item, "Lançamentos" mostra as saídas por venda com o número do pedido e a mesa; os
   gráficos de "o que mais saiu" (006) passam a contar as vendas, separadas das perdas.

### US5 — Pedido cancelado devolve ou vira perda (P2)

Como chef, quero que cancelar um pedido deixe o estoque certo: se nada foi usado, nada sai; se foi
usado, sai como perda.

**Cenários**

1. Cancelar pedido **Recebido** (antes do preparo): nada a fazer no estoque.
2. Cancelar pedido **Em preparo** ou **Pronto**: o cancelamento pergunta "Os ingredientes já foram
   usados?" (padrão: Sim).
   - **Sim**: a saída por venda é estornada e o mesmo consumo é lançado como **perda** com motivo
     "Pedido cancelado", vinculada ao pedido. O saldo não muda; a saída passa a contar como perda.
   - **Não**: a saída por venda é estornada e o estoque volta.
3. Nada é apagado: estorno e perda ficam no livro, com quem e quando.

### US6 — Consultar contas e o que entrou no dia (P2)

Como gerente, quero ver as contas fechadas e quanto entrou por forma de pagamento.

**Cenários**

1. A tela **"Contas"** lista as contas por período (até 31 dias; padrão hoje) e mesa, com mesa,
   abertura, fechamento, total, taxa de serviço e quem fechou.
2. Abrir uma conta mostra os pedidos, os pagamentos (inclusive os tirados) e o histórico.
3. Um resumo do período mostra o total recebido por forma de pagamento e o total de taxa de
   serviço.
4. **Reabrir conta** (só gerente, com motivo): a conta volta para a lista do caixa com os
   pagamentos que tinha; serve para corrigir pagamento lançado errado. Se a mesa já tem outra conta
   aberta, a reabertura é recusada: "A mesa 12 já tem outra conta aberta. Feche-a antes."

## Casos-limite

- Pedido enviado no mesmo instante em que o caixa fecha a conta: ou entra na conta antes de fechar
  (e o fechamento é recusado porque o total mudou: "A conta mudou. Confira de novo."), ou abre a
  conta nova. Nunca fica fora de conta, nunca entra em conta fechada.
- Duas telas registrando pagamento na mesma conta: o segundo pagamento que passaria do total é
  recusado ("O valor passa do que falta pagar").
- Toque duplo em "Registrar pagamento" ou "Fechar conta" não duplica.
- Conta com todos os pedidos cancelados: total R$ 0,00; "Fechar conta" libera a mesa sem pagamento.
- Mesa inativada com conta aberta: a conta continua no caixa até fechar.
- Valor do pagamento: maior que zero, com 2 casas, em decimal exato.
- Pedido que pula etapas não existe (009): todo pedido entregue passou por "Em preparo", então todo
  pedido entregue baixou o estoque uma vez só.
- Tocar "Começar preparo" duas vezes ou em duas telas não baixa duas vezes.
- Produto cuja versão do envio usa um item hoje inativo: baixa normalmente (a quantidade sai do
  item, inativo ou não).
- Divisão com centavos: a soma das partes é sempre igual ao que falta.

## Requisitos

- **FR-001** Cada mesa tem no máximo uma **conta aberta**. A conta abre com o primeiro pedido
  enviado sem conta aberta na mesa e recebe todos os pedidos da mesa até fechar.
- **FR-002** Subtotal da conta = soma dos totais dos pedidos não cancelados. Taxa de serviço =
  subtotal × porcentagem do restaurante, ou zero se a taxa está desligada no restaurante ou foi
  tirada nessa conta. Total = subtotal + taxa. Pago = soma dos pagamentos não tirados. Falta = total −
  pago. Tudo em decimal exato, arredondado a centavos só na taxa (meio centavo para cima).
- **FR-003** Pagamento: forma (lista fechada: Dinheiro, Pix, Cartão de débito, Cartão de crédito,
  Outro), valor (> 0), quem registrou e quando. Em dinheiro guarda também o recebido e o troco.
  O pago nunca passa do total. Pagamento não é editado nem apagado; é **tirado** com registro.
- **FR-004** Fechar conta exige falta = 0 e nenhum pedido em Recebido, Em preparo ou Pronto. Fechar
  grava quem e quando, encerra os acessos ao cardápio abertos na mesa e libera a mesa.
- **FR-005** Dividir por N pessoas (2 a 20) calcula partes que somam exatamente o que falta, com os
  centavos restantes na primeira parte. Dividir não grava nada; só sugere valores de pagamento.
- **FR-006** Ao passar um pedido para Em preparo, o sistema lança, na mesma operação, uma saída por
  venda por item do consumo do pedido (010), com quantidade na medida do item, custo médio do
  momento, referência ao pedido e à mesa e o usuário que mudou a situação. Uma vez por pedido.
- **FR-007** Saída por venda é permitida mesmo deixando o saldo negativo (exceção à regra da 004),
  com aviso no item. Compra, perda, acerto e estorno continuam bloqueados para saldo negativo.
- **FR-008** Cancelar pedido depois do preparo pergunta se os ingredientes foram usados: Sim →
  estorno da venda + perda "Pedido cancelado" com o mesmo consumo; Não → estorno da venda.
  Movimentações nunca são editadas nem apagadas.
- **FR-009** Reabrir conta: só gerente, com motivo (texto de 1 a 140 letras); recusada se a mesa
  já tem outra conta aberta.
- **FR-010** Permissões (ver [09-controles-e-permissoes](../../docs/produto/estoque/09-controles-e-permissoes.md)):

  | Ação | Quem pode |
  |---|---|
  | Ver o caixa e as contas abertas; imprimir conta | Gerente, caixa, garçom |
  | Registrar e tirar pagamento; fechar conta | Gerente, caixa |
  | Consultar contas fechadas e o resumo por forma de pagamento | Gerente, caixa |
  | Reabrir conta | Gerente |
  | Configurar a taxa de serviço | Gerente |

  Entra o papel novo **Caixa**, que vê só "Caixa", "Contas" e "Pedidos". A baixa por venda é feita
  por quem já pode mudar a situação na cozinha (gerente, chef); não há permissão nova para ela.
- **FR-011** Toda escrita (pagamento, pagamento tirado, fechamento, reabertura, taxa, baixa por
  venda, estorno e perda do cancelamento) vai para a trilha de auditoria com quem e quando.
- **FR-012** Isolamento por restaurante: contas, pagamentos e baixas nunca cruzam restaurantes.
- **FR-013** Textos da tela em português do dia a dia, sem "sessão", "movimentação" ou "ficha
  técnica" para o caixa.
- **FR-014** Taxa de serviço: o gerente liga ou desliga e define a porcentagem (0 a 20%, até 2
  casas; padrão ligada em 10%) na tela Caixa. Mudar a configuração vale para as contas abertas a
  partir daí; conta fechada guarda a taxa que teve. O caixa pode tirar e pôr de volta a taxa de uma
  conta aberta, com registro de quem e quando.

## Entidades

- **Conta da mesa**: mesa, aberta em, fechada em, quem fechou, situação (aberta, fechada),
  subtotal, taxa, total; reaberturas com motivo.
- **Pagamento**: conta, forma, valor, recebido e troco (dinheiro), quem e quando, tirado (quem,
  quando).
- **Pedido** (009): passa a pertencer a uma conta.
- **Saída por venda** (movimentação, tipo 7 do manual): item, quantidade, custo médio do momento,
  pedido e mesa de referência, quem e quando.
- **Perda "Pedido cancelado"**: motivo novo na lista fechada de perdas, vinculada ao pedido.
- **Configuração do restaurante**: taxa de serviço ligada ou desligada e a porcentagem (padrão
  ligada, 10%).

## Critérios de sucesso

- **SC-001** O caixa fecha uma conta paga de uma vez em menos de 30 segundos, a partir da tela
  "Caixa".
- **SC-002** O caixa divide uma conta por 4 e registra os quatro pagamentos em menos de 1 minuto.
- **SC-003** 100% dos pedidos enviados pertencem a exatamente uma conta; nenhum pedido fica fora de
  conta ou entra em conta fechada.
- **SC-004** 100% dos pedidos que passaram pelo preparo têm a baixa no estoque, exatamente uma vez,
  com as quantidades do consumo da 010.
- **SC-005** Nenhuma conta fecha com valor pago diferente do total.
- **SC-006** O saldo de cada item é sempre a soma das movimentações, incluindo vendas, estornos e
  perdas de cancelamento.

## Premissas

- O caixa é uma tela do sistema (computador ou tablet) com login; não há integração com
  maquininha de cartão nem com o banco: o caixa registra o que já recebeu.
- Não é documento fiscal (fiscal está fora do escopo do produto).
- O garçom continua só levando os pratos; ele pode ver a conta para levar o total à mesa, mas não
  recebe pagamento no sistema.
- Não há abertura e fechamento de caixa (troco inicial, sangria, conferência do turno) nesta versão.
- A baixa usa o consumo já calculado pela 010 e o livro imutável da 004; o custo da saída é o custo
  médio do momento.

## Fora do escopo

Desconto e cortesia na conta, couvert, dividir por itens (cada um paga o que consumiu), transferir pedido entre mesas e juntar mesas, pagamento
pelo celular do cliente, integração com maquininha e Pix automático, nota fiscal (NFC-e), abertura
e fechamento de caixa, pedido lançado pela equipe (balcão, telefone), delivery, CMV teórico do
período (vem numa feature de indicadores, agora que as vendas existem).


## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-11 | Conta e baixa do estoque na mesma feature? | Sim, pedido do dono; a 011 entrega a 005 do roadmap |
| 2026-11-11 | Q1 — Quando o estoque baixa? | Quando a cozinha toca "Começar preparo" (não no envio nem no fechamento da conta) |
| 2026-11-11 | Q2 — Como dividir a conta? | Partes iguais por pessoas e valor livre por pagamento; divisão por itens fica para depois |
| 2026-11-11 | Q3 — Taxa de serviço? | Sim, configurável pelo gerente (padrão ligada, 10%); o caixa pode tirar de uma conta, com registro |
