# Feature 014 — Abrir e fechar o caixa do dia

**Branch**: `claude/project-thread-vfeeqt` · **Criada**: 2026-11-14 · **Status**: em revisão

**Pedido do dono** (2026-11-12): fechamento do caixa do dia: abrir o caixa com um valor inicial,
registrar sangrias e reforços, conferir o dinheiro no fim do turno e ver um relatório de vendas por
forma de pagamento e por produto, aproveitando os pagamentos da conta da mesa (011).

## Contexto

A [011](../011-fechamento-conta-mesa/spec.md) entregou a conta da mesa: o caixa lança pagamentos
(Dinheiro, Pix, cartões, Outro), fecha a conta e consulta as contas fechadas com o total por forma
de pagamento. Ela deixou fora, de propósito, "abertura e fechamento de caixa (troco inicial,
sangria, conferência do turno)".

Hoje ninguém sabe quanto dinheiro **deveria** estar na gaveta no fim do turno: o troco do começo
não está em lugar nenhum, o dinheiro que sai para o cofre ou para pagar um fornecedor não é
registrado, e a única visão de vendas é a soma dos pagamentos das contas fechadas. Esta feature
cria o **turno do caixa**: abre com o troco, registra o que entra e sai da gaveta, confere o
dinheiro contado com o esperado e mostra o relatório do dia com as vendas por forma de pagamento e
por produto.

## Histórias

### US1 — Abrir o caixa com o troco (P1)

Como caixa, quero abrir o caixa informando quanto tem de troco na gaveta, para o sistema saber de
onde parte a conta do dinheiro.

**Por que P1**: sem a abertura não há turno para conferir; é a base das outras histórias.

**Teste independente**: entrar como caixa, abrir **Caixa**, tocar **Abrir caixa**, informar
R$ 150,00 e ver "Caixa aberto às 11:02 por Ana, troco R$ 150,00"; lançar um pagamento numa conta e
ver que ele entrou neste turno.

**Cenários**

1. Dado que não há caixa aberto, quando abro a tela Caixa, então vejo no topo "Caixa fechado" e o
   botão **Abrir caixa**. As contas abertas continuam aparecendo, mas **Lançar pagamento** fica
   desligado com o motivo "Abra o caixa antes de receber."
2. Quando toco **Abrir caixa**, informo o **troco inicial** (R$ 0,00 ou mais, até 2 casas) e
   confirmo, então o caixa abre com quem abriu e a hora. O campo já vem com o dinheiro contado no
   fechamento do turno anterior, se houve, e o caixa pode mudar.
3. Se o troco informado é diferente do que ficou na gaveta no fechamento anterior, a tela pede uma
   observação ("Ficaram R$ 150,00 na gaveta no fechamento de ontem. Por que o troco é outro?") e o
   valor anterior fica registrado junto.
4. O restaurante tem **um caixa aberto por vez**. Se outra pessoa abriu o caixa um instante antes,
   a abertura é recusada: "O caixa já foi aberto por Bruno às 11:01."
5. Com o caixa aberto, o topo da tela Caixa mostra "Caixa aberto desde 11:02 · Ana" e os botões
   **Sangria**, **Reforço** e **Fechar caixa**.

### US2 — Todo pagamento entra no turno (P1)

Como gerente, quero que cada pagamento recebido fique ligado ao turno em que entrou, para conferir
o dinheiro de cada turno.

**Por que P1**: é o que faz a conferência fechar.

**Teste independente**: com o caixa aberto (troco R$ 150,00), lançar R$ 77,00 em dinheiro
(recebido R$ 100,00, troco R$ 23,00) e R$ 40,00 em Pix; ver no turno "Dinheiro R$ 77,00",
"Pix R$ 40,00" e "Dinheiro esperado na gaveta: R$ 227,00".

**Cenários**

1. Lançar pagamento (011) só funciona com o caixa aberto, e o pagamento fica ligado ao turno
   aberto naquele momento.
2. Em dinheiro, entra na gaveta só o **valor** do pagamento: o recebido entra e o troco sai na
   mesma hora (R$ 100,00 recebidos com R$ 23,00 de troco somam R$ 77,00 na gaveta).
3. **Tirar pagamento** (011) também fica ligado ao turno em que foi tirado. Se o pagamento foi
   lançado num turno já fechado, ele sai do turno **de agora**, aparece como "Pagamento tirado de
   outro turno" com o turno de origem, e o turno antigo continua como foi conferido.
4. Fechar uma conta com total R$ 0,00 (todos os pedidos cancelados) não precisa de caixa aberto,
   porque não entra dinheiro.
5. O garçom continua só vendo a conta; nada muda para ele.

### US3 — Registrar sangria e reforço (P1)

Como caixa, quero registrar o dinheiro que tiro da gaveta (sangria) e o que ponho (reforço), para a
conta do dinheiro bater no fim do turno.

**Teste independente**: com R$ 227,00 esperados na gaveta, registrar uma sangria de R$ 150,00
("Cofre") e um reforço de R$ 50,00 ("Troco do cofre") e ver o esperado em R$ 127,00.

**Cenários**

1. **Sangria**: valor (> 0, até 2 casas) e motivo da lista: **Cofre**, **Pagamento a fornecedor**,
   **Despesa do dia**, **Outro**. Observação opcional (até 140 letras); em **Outro** ela é
   obrigatória.
2. A sangria não pode passar do dinheiro esperado na gaveta: "A gaveta deve ter R$ 127,00. A
   sangria não pode passar disso."
3. **Reforço**: valor (> 0, até 2 casas) e observação opcional (até 140 letras).
4. Cada sangria e reforço guarda quem lançou e quando, e oferece **Imprimir comprovante** (folha
   de 80 mm com valor, motivo, hora, quem lançou e uma linha para assinatura).
5. **Tirar** sangria ou reforço lançado errado (só no turno aberto): pede confirmação e fica
   riscado, com quem tirou e quando; deixa de contar no esperado. Nada é apagado.
6. Toque duplo em "Registrar sangria" ou "Registrar reforço" não lança duas vezes.

### US4 — Fechar o caixa conferindo o dinheiro (P1)

Como caixa, quero contar o dinheiro da gaveta no fim do turno e ver se bate com o que o sistema
espera, para entregar o turno certo ao gerente.

**Por que P1**: é a entrega principal do pedido.

**Teste independente**: com esperado de R$ 127,00, tocar **Fechar caixa**, informar R$ 125,00
contados e a observação "Troco errado na mesa 4", e ver "Falta R$ 2,00" no relatório do turno; o
caixa fica fechado e **Lançar pagamento** volta a pedir a abertura.

**Cenários**

1. **Fechar caixa** pede o **dinheiro contado na gaveta**. Para ajudar, a tela tem uma calculadora
   opcional por cédula e moeda (quantas notas de R$ 200, R$ 100… até moedas de R$ 0,05) que soma e
   preenche o valor; o caixa pode digitar o total direto.
2. **Conferência cega**: o caixa informa o contado **antes** de ver o esperado. Só depois de
   confirmar o contado a tela mostra o esperado e a diferença.
3. Diferença = contado − esperado. Zero: "Bateu". Positiva: "Sobra R$ 3,00". Negativa: "Falta
   R$ 2,00". Com diferença, a observação (1 a 140 letras) é obrigatória.
4. O caixa também informa quanto **fica na gaveta** como troco para o próximo turno (padrão: tudo
   o que foi contado; não pode passar do contado). O resto é a **retirada do fechamento**, que vai
   no relatório para o gerente saber quanto deve chegar ao cofre.
5. Fechar com contas de mesa ainda abertas é permitido (a mesa pode estar comendo na troca de
   turno), com o aviso "3 mesas ainda têm conta aberta. Os pagamentos delas vão entrar no próximo
   turno."
6. Ao fechar, o turno grava o esperado, o contado, a diferença, o que ficou na gaveta, quem fechou
   e quando. Turno fechado não muda mais.
7. Depois de fechar, a tela mostra o **relatório do turno** (US5) com **Imprimir**.
8. O gerente pode fechar o caixa aberto por outra pessoa (o caixa foi embora sem fechar); o
   relatório mostra quem abriu e quem fechou.

### US5 — Relatório do turno (P1)

Como gerente, quero ver o resumo de cada turno, para saber quanto entrou, quanto saiu e se o
dinheiro bateu.

**Teste independente**: abrir o turno do teste da US4 e ver troco inicial R$ 150,00, recebido
por forma (Dinheiro R$ 77,00, Pix R$ 40,00), sangria R$ 150,00, reforço R$ 50,00, esperado
R$ 127,00, contado R$ 125,00, "Falta R$ 2,00" com a observação.

**Cenários**

1. O relatório do turno mostra: quem abriu e quando, quem fechou e quando, troco inicial;
   **recebido por forma de pagamento** (sem os tirados) e o total recebido; taxa de serviço das
   contas fechadas no turno; pagamentos tirados de outro turno; sangrias (com motivo) e reforços;
   **dinheiro esperado**, **contado**, **diferença** e observação; o que ficou na gaveta e a
   retirada do fechamento.
2. A conta do dinheiro aparece passo a passo, para quem confere entender de onde vem o esperado:

   ```text
   Troco inicial                    R$ 150,00
   + Recebido em dinheiro           R$  77,00
   − Pagamentos em dinheiro tirados R$   0,00
   + Reforços                       R$  50,00
   − Sangrias                       R$ 150,00
   = Esperado na gaveta             R$ 127,00
   Contado                          R$ 125,00
   Diferença                        Falta R$ 2,00
   ```

3. Com o caixa aberto, o gerente vê o mesmo relatório **parcial** (sem contado e diferença). O
   caixa não vê o esperado do turno aberto (conferência cega); ele vê o recebido por forma.
4. **Imprimir** gera uma folha de 80 mm ou A4 com o relatório e "Não é documento fiscal".

### US6 — Relatório de vendas do dia por forma de pagamento e por produto (P2)

Como gerente, quero ver o que vendi no dia (ou num período), por forma de pagamento e por produto,
para saber o que mais sai e quanto entrou.

**Teste independente**: num dia com 3 X-Burger a R$ 30,00 (um com + 2 Fatia de queijo a R$ 2,00),
2 Sucos a R$ 9,00 e um X-Burger cancelado, abrir **Vendas** no dia e ver "X-Burger 3 un R$ 94,00",
"Suco 2 un R$ 18,00", o total por forma de pagamento e a lista dos turnos do dia com a diferença de
cada um.

**Cenários**

1. O menu ganha **Vendas** na área Operação. Escolho o período (até 31 dias; padrão hoje), em dias
   do restaurante.
2. **Por forma de pagamento**: total recebido por forma (pagamentos lançados no período, menos os
   tirados no período), total da taxa de serviço e total geral.
3. **Por produto**: cada produto vendido com a quantidade e o valor (preço com os adicionais), do
   que mais vendeu para o que menos vendeu, e a parte de cada um no total. Pedido cancelado não
   conta. Uma tabela à parte mostra os **adicionais** vendidos (quantas vezes e o valor).
4. O total dos produtos é o valor dos pedidos do período, sem a taxa de serviço. A tela explica
   por que ele pode ser diferente do recebido: "Recebido conta o dinheiro que entrou nos turnos;
   vendas contam os pedidos feitos no período. Uma conta aberta à noite e paga depois da meia-noite
   aparece em dias diferentes."
5. **Turnos do período**: cada turno com abertura, fechamento, quem, total recebido e diferença
   ("Bateu", "Sobra", "Falta"), com link para o relatório do turno. Soma das diferenças do período.
6. Se há pedidos do período ainda não entregues, a tela avisa quantos e eles contam nas vendas.
7. **Baixar planilha** (CSV) das duas tabelas, para o contador.

## Casos-limite

- Duas telas tocando **Abrir caixa** ao mesmo tempo: só uma abre; a outra vê quem abriu.
- Duas telas fechando o caixa ao mesmo tempo: só um fechamento vale; o outro vê "O caixa já foi
  fechado por Ana às 23:10."
- Pagamento lançado no mesmo instante do fechamento do caixa: ou entra no turno antes de fechar (e
  o fechamento é recusado com "Entrou um pagamento agora. Confira de novo."), ou é recusado com
  "Abra o caixa antes de receber." Nunca fica fora de turno nem entra em turno fechado.
- Sangria e reforço no mesmo instante de um fechamento: mesma regra.
- Turno que passa da meia-noite: o turno pertence ao dia em que abriu, nos relatórios.
- Caixa aberto há mais de 24 horas: a tela Caixa mostra "O caixa está aberto desde ontem 11:02.
  Feche o caixa para conferir o turno."
- Esperado negativo não acontece: sangria não passa do esperado, e tirar reforço que deixaria o
  esperado negativo é recusado ("Sem esse reforço a gaveta ficaria negativa. Tire uma sangria
  antes."). Pagamento em dinheiro tirado de outro turno pode deixar o esperado negativo; a tela
  mostra o valor negativo em destaque e a conferência segue normal.
- Reabrir uma conta (011) e lançar pagamento de novo: o pagamento novo entra no turno de agora.
- Pagamentos lançados antes desta feature (sem turno) aparecem no relatório de vendas por forma de
  pagamento, mas em nenhum turno.
- Valores: troco inicial ≥ 0; sangria, reforço e contado com até 2 casas; contado ≥ 0.

## Requisitos

- **FR-001** O restaurante tem no máximo **um caixa aberto** (turno). Abrir exige troco inicial
  (≥ 0, 2 casas) e grava quem e quando. Se há turno fechado antes, guarda o que ficou na gaveta no
  fechamento anterior e exige observação quando o troco informado é diferente.
- **FR-002** Lançar pagamento (011, `addPayment`) exige caixa aberto e liga o pagamento ao turno
  aberto. Tirar pagamento liga a remoção ao turno aberto; sem caixa aberto, tirar pagamento é
  recusado ("Abra o caixa antes de tirar um pagamento.").
- **FR-003** Sangria: valor > 0 (2 casas), motivo da lista fechada (Cofre, Pagamento a fornecedor,
  Despesa do dia, Outro) e observação (até 140; obrigatória em Outro); nunca acima do esperado na
  gaveta. Reforço: valor > 0 (2 casas) e observação opcional. Ambos só no turno aberto; não são
  editados nem apagados, são **tirados** com registro; tirar reforço não pode deixar o esperado
  negativo.
- **FR-004** Dinheiro esperado = troco inicial + Σ pagamentos em dinheiro do turno não tirados −
  Σ pagamentos em dinheiro de outros turnos tirados neste turno + Σ reforços não tirados −
  Σ sangrias não tiradas. Tudo em decimal exato, sem arredondamento.
- **FR-005** Fechar caixa: contado (≥ 0, 2 casas), conferência cega (esperado só aparece depois do
  contado confirmado), diferença = contado − esperado, observação obrigatória se diferença ≠ 0,
  valor que fica na gaveta (0 ≤ fica ≤ contado; padrão = contado). Grava esperado, contado,
  diferença, fica, quem e quando; turno fechado não muda mais. O fechamento é recusado se algo
  entrou no turno depois que a tela carregou.
- **FR-006** Relatório do turno conforme US5; o caixa não vê o esperado do turno aberto.
- **FR-007** Relatório de vendas por período (até 31 dias, dias do restaurante): recebido por forma
  (pagamentos pela hora do lançamento e remoções pela hora da remoção), taxa de serviço das contas
  fechadas no período, vendas por produto e por adicional (pedidos não cancelados pelo dia do
  pedido), turnos abertos no período com a diferença. Exporta CSV.
- **FR-008** Permissões (ver
  [09-controles-e-permissoes](../../docs/produto/estoque/09-controles-e-permissoes.md)):

  | Ação | Quem pode |
  |---|---|
  | Abrir caixa, sangria, reforço, tirar sangria e reforço, fechar o próprio turno | Gerente, caixa |
  | Fechar turno aberto por outra pessoa | Gerente |
  | Ver o esperado do turno aberto | Gerente |
  | Relatório de turno fechado (todos os turnos) | Gerente, caixa |
  | Relatório de vendas por período (Vendas) | Gerente |

- **FR-009** Toda escrita (abertura, sangria, reforço, tirada, fechamento) vai para a trilha de
  auditoria com quem e quando, e o turno guarda o seu histórico.
- **FR-010** Isolamento por restaurante: turnos, sangrias, reforços e relatórios nunca cruzam
  restaurantes.
- **FR-011** Textos em português do dia a dia: "caixa", "turno", "troco", "sangria", "reforço",
  "gaveta"; nunca "sessão" ou "movimentação".
- **FR-012** Toque duplo em qualquer botão que grava (abrir, sangria, reforço, fechar) não grava
  duas vezes.

## Entidades

- **Turno do caixa**: aberto em, por quem, troco inicial, troco esperado do fechamento anterior e
  observação da abertura; fechado em, por quem, esperado, contado, diferença, observação, fica na
  gaveta; situação (aberto, fechado).
- **Sangria / reforço** (movimento de gaveta): turno, tipo, valor, motivo (sangria), observação,
  quem e quando; tirado (quem, quando).
- **Pagamento** (011): passa a ter o turno em que entrou; a remoção do pagamento passa a ter o
  turno em que foi tirada.
- **Contagem por cédula** (opcional): só ajuda na tela; o turno guarda o total contado e, se a
  calculadora foi usada, quantas de cada cédula e moeda.

## Critérios de sucesso

- **SC-001** O caixa abre o turno em menos de 15 segundos a partir da tela Caixa.
- **SC-002** O caixa fecha o turno (contar com a calculadora de cédulas já feita, informar e
  confirmar) em menos de 1 minuto.
- **SC-003** 100% dos pagamentos lançados depois desta feature pertencem a exatamente um turno;
  nenhum entra em turno fechado.
- **SC-004** Em todo turno fechado, esperado = a soma da US5, item 2, refeita a partir dos
  lançamentos; turno fechado nunca muda.
- **SC-005** O relatório de vendas de um dia com até 500 pedidos abre em menos de 2 segundos.
- **SC-006** A soma das vendas por produto de um período é igual à soma dos totais dos pedidos não
  cancelados do período, centavo por centavo.

## Premissas

- Um caixa (uma gaveta) por restaurante. Mais de um caixa ao mesmo tempo fica para depois.
- A conferência é só do **dinheiro**. Pix e cartão aparecem no relatório pelo que foi lançado; a
  conferência com o extrato da maquininha ou do banco fica fora (não há integração).
- Turno fechado não reabre. Erro de contagem descoberto depois vira anotação do gerente fora do
  sistema nesta versão; diferença de outro turno aparece como "pagamento tirado de outro turno".
- O dia do turno é o dia do restaurante em que ele abriu.
- Não é documento fiscal (fiscal está fora do escopo do produto).
- A tela do caixa é usada em computador ou tablet, como na 011; o relatório de vendas também
  funciona no celular do gerente.

## Fora do escopo

Mais de um caixa ao mesmo tempo, reabrir turno fechado, conferência de Pix e cartão com extrato,
integração com maquininha e banco, contas a pagar e despesas além da sangria, aprovação da sangria
por outra pessoa, CMV teórico × real (vem na feature de indicadores), nota fiscal.

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-12 | Escopo | Pedido do dono: abrir com valor inicial, sangria e reforço, conferir o dinheiro no fim do turno, relatório por forma de pagamento e por produto |
| 2026-11-14 | Receber sem caixa aberto? | Não. Todo pagamento exige caixa aberto, para a conferência fechar (premissa, sem pergunta; pode ser revista) |
| 2026-11-14 | Quantos caixas? | Um aberto por restaurante (premissa) |
| 2026-11-14 | Conferência cega? | Sim: o caixa informa o contado antes de ver o esperado, como o manual pede para contagens (premissa) |
| 2026-11-14 | Conta aberta segura o fechamento do caixa? | Não: avisa e os pagamentos dela entram no próximo turno (premissa) |
| 2026-11-14 | Quem vê vendas por produto? | Só o gerente; o caixa vê os relatórios de turno (premissa) |
