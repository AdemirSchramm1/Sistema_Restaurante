# Feature 015 — Garçom lança o pedido da mesa pelo cardápio

**Branch**: `claude/project-thread-tzn6wk` · **Criada**: 2026-11-15 · **Status**: em revisão

**Pedido do dono** (2026-11-15): "essa parte é importantíssima pois ela que cuida dos pedidos o
garçom faz o pedido, mas devemos trabalhar assim também o garçom tem um acesso especifico dentro do
sistema que ele entra dentro do cardapio e pode indo fazer os pedidos para a mesa, deve ser
armazenada qual garçom fez os pedidos e também devemos verificar a parte do cardapio".

## Contexto

Hoje só o cliente faz pedido, pelo QR code da mesa ([009](../009-pedidos-qr-mesa/spec.md)), com
adicionais e retiradas por botão ([010](../010-adicionais-retiradas/spec.md)). O pedido abre a
conta da mesa ([011](../011-fechamento-conta-mesa/spec.md)) e cai na cozinha. O papel **Garçom**
já existe, mas só vê os pedidos prontos, marca **Entregue** e lê a conta: ele não consegue lançar
nada. A 011 deixou "pedido lançado pela equipe" fora de propósito.

Isso deixa de fora quem não usa o QR code: o cliente sem celular, sem bateria ou sem vontade de
escanear, a mesa que prefere pedir de viva voz, e o próprio cardápio do cliente quando manda
"Chame um garçom" (acesso vencido, 10 pedidos no acesso, chave "Recebendo pedidos pelo QR code"
desligada, mudança que não tem botão). Hoje o garçom é chamado e não tem o que fazer no sistema.

Esta feature dá ao garçom a tela **Lançar pedido**: ele entra com o seu usuário, escolhe a mesa,
abre o cardápio do restaurante e monta o pedido como o cliente montaria, com os mesmos produtos,
preços, adicionais e retiradas. O pedido vai para a mesma cozinha, entra na mesma conta da mesa e
guarda **qual garçom lançou**. A cozinha, o caixa e a consulta de pedidos mostram de onde veio cada
pedido: "QR code" ou o nome do garçom.

## Revisão do cardápio atual para o uso do garçom

O dono pediu para verificar como o cardápio atende o garçom. O cardápio do cliente (009, 010, 012 e
013) foi feito para uma pessoa, um celular e uma mesa, por 20 minutos. Para o garçom:

| Parte do cardápio | Hoje (cliente pelo QR code) | Serve ao garçom? | O que esta feature faz |
|---|---|---|---|
| Seções, ordem, fotos, descrição, busca | Montados na tela Cardápio (013) | Sim, é o mesmo cardápio | Reaproveita. A busca fica no topo, porque o garçom procura pelo nome que o cliente falou |
| Cartão grande com foto, 1 coluna no celular | Bom para escolher com calma | Lento para quem já sabe o que quer | Modo **Lista** (só nome, preço e "+") além do modo com fotos; o garçom escolhe e o aparelho lembra |
| Tela do prato com adicionais e retiradas | Só botões | Sim | Reaproveita, com os mesmos limites |
| "Precisa de outra mudança? Chame um garçom." | O cliente chama o garçom | O garçom chamado não tem como lançar a mudança | Ver [Decisões](#decisões): observação curta só para a equipe (pendente de confirmação do dono) |
| Produto **Esgotado hoje** | Some do cardápio | O garçom precisa saber que acabou para avisar o cliente | Aparece no fim da seção, apagado, com o selo "Esgotado hoje", sem "+" |
| Produto sem preço ou inativo | Não aparece | Não deve ser vendido | Continua sem aparecer |
| Acesso de 20 minutos e "Faltam N min" | Fecha o cardápio no celular do cliente | Não faz sentido: o garçom usa o cardápio o turno inteiro | Não se aplica. O garçom fica no cardápio enquanto estiver logado |
| Até 10 pedidos por acesso | Freio contra abuso | Não faz sentido para a equipe | Não se aplica |
| Chave "Recebendo pedidos pelo QR code" | Desligada, ninguém pede | O garçom é o plano B justamente quando ela está desligada | Não se aplica ao garçom |
| "Meus pedidos" do celular | Pedidos daquele acesso | O garçom quer os pedidos **da mesa** | Troca por **Pedidos da mesa**: tudo da conta aberta, de qualquer origem, com a situação |
| Carrinho | Um por celular | O garçom atende várias mesas | Um carrinho por mesa, guardado no aparelho até enviar ou limpar |
| Preço que mudou, produto que saiu, sem pedido em dobro | Conferidos no envio | Sim | Mesmas regras |
| Matriz de 9 telas, claro e escuro (013, US6) | Testes de tela do cliente | O garçom usa celular e, às vezes, tablet | A tela do garçom entra na mesma matriz |

## Histórias

### US1 — Garçom lança o pedido da mesa (P1)

Como garçom, quero escolher a mesa, montar o pedido no cardápio e enviar para a cozinha, para
atender quem não pede pelo QR code.

**Por que P1**: é o pedido do dono e a entrega principal.

**Teste independente**: entrar como o garçom João, abrir **Lançar pedido**, tocar "Mesa 12", pôr
2 × X-Burger com + 2 Fatia de queijo e sem cebola, tocar **Enviar pedido**, confirmar e ver "Pedido
5 enviado para a cozinha · Mesa 12 · R$ 68,00"; abrir a Cozinha como chef e ver o pedido 5 da Mesa
12 com "João".

**Cenários**

1. Ao entrar, o garçom cai em **Lançar pedido**, que mostra as mesas ativas em grade, na ordem do
   nome, com busca. Cada mesa mostra se tem conta aberta ("Ocupada · R$ 120,00 · há 35 min") ou
   está livre, e quantos pedidos estão prontos para levar.
2. Tocando a mesa, abre o cardápio do restaurante (seções, ordem, fotos, descrição e preços da
   013) com "Mesa 12" fixo no topo e o botão **Trocar mesa**.
3. O garçom põe produtos no carrinho como o cliente: tela do prato com adicionais e retiradas por
   botão, quantidade, os mesmos limites (até 30 linhas, até 20 de cada, adicionais até o máximo do
   produto).
4. **Enviar pedido** mostra o resumo com a mesa em destaque ("Conferir: Mesa 12") e o total.
   **Confirmar** envia. A resposta é "Pedido 5 enviado para a cozinha", com a mesa e o total, e o
   carrinho daquela mesa esvazia.
5. O pedido entra na **conta aberta da mesa**; se não há conta aberta, ele a abre, como o primeiro
   pedido pelo QR code (011). O histórico da conta mostra "Conta aberta por João (pedido 5)".
6. O número do pedido segue a mesma sequência do dia dos pedidos pelo QR code.
7. O pedido cai na cozinha igual aos outros: Recebido → Em preparo → Pronto → Entregue, com a baixa
   do estoque no **Começar preparo** (011). Nada muda para a cozinha além de mostrar quem lançou.
8. Mesa inativa não aparece na grade. Se ela for inativada com o carrinho montado, o envio é
   recusado: "A Mesa 12 foi inativada. Fale com o gerente."
9. A chave "Recebendo pedidos pelo QR code" desligada **não** impede o garçom; a grade mostra o
   aviso "O QR code está desligado: só a equipe lança pedidos."

### US2 — O sistema guarda quem lançou cada pedido (P1)

Como gerente, quero saber qual garçom lançou cada pedido e quais vieram pelo QR code, para
acompanhar o atendimento e resolver reclamações.

**Por que P1**: é um requisito explícito do dono.

**Teste independente**: com um pedido pelo QR code e dois do João na Mesa 12, abrir **Pedidos**,
filtrar por "Lançado por: João" e ver só os dois; abrir um deles e ver "Lançado por João às
20:14".

**Cenários**

1. Todo pedido guarda a **origem**: "QR code" (cliente) ou "Equipe", e, na origem Equipe, o usuário
   que lançou. Isso é gravado no envio e nunca muda.
2. A **Cozinha** mostra, no cartão do pedido, "João" (ou "QR code") embaixo da mesa, em texto
   menor que a mesa.
3. A tela **Garçom** (prontos para levar) mostra quem lançou, para o garçom achar os seus pedidos
   primeiro, e tem o filtro **Só os meus**.
4. A **conta da mesa** (Caixa e Contas fechadas) mostra a origem em cada pedido.
5. A consulta **Pedidos** ganha o filtro **Lançado por** (QR code, cada pessoa da equipe que já
   lançou pedido) e a coluna "Lançado por". O detalhe do pedido mostra "Lançado por João às 20:14"
   no histórico de situações.
6. No fim da consulta, o resumo do período mostra, por origem, quantos pedidos não cancelados e o
   total deles ("QR code: 42 pedidos, R$ 2.310,00 · João: 18 pedidos, R$ 1.020,00").
7. O nome mostrado é o nome do usuário **no momento da consulta**; o pedido guarda o usuário, não
   uma cópia do nome. Usuário removido da equipe continua aparecendo pelo nome nos pedidos antigos.

### US3 — Garçom acompanha os pedidos da mesa (P1)

Como garçom, quero ver tudo o que a mesa já pediu e em que situação está, para responder ao
cliente e não lançar em dobro.

**Teste independente**: na Mesa 12 com um pedido pelo QR code (Em preparo) e um do João (Pronto),
abrir a mesa no Lançar pedido e ver os dois em **Pedidos da mesa**, com origem, situação e o total
da conta até agora.

**Cenários**

1. Dentro da mesa, **Pedidos da mesa** lista os pedidos da conta aberta, de qualquer origem, do
   mais novo para o mais antigo, com número, hora, origem, linhas com as mudanças, situação e total.
2. Mostra o total da conta até agora, com a taxa de serviço, como o garçom já vê no Caixa (011).
3. Atualiza sozinho a cada 10 segundos, como o cardápio do cliente.
4. Pedido pronto aparece com **Entregue** (o garçom marca dali mesmo, como na tela Garçom).
5. Mesa sem conta aberta mostra "Nenhum pedido aberto nesta mesa."

### US4 — Corrigir pedido lançado errado (P2)

Como garçom, quero cancelar um pedido que acabei de lançar errado (mesa trocada, produto errado),
antes de a cozinha começar, para não precisar chamar o gerente toda vez.

**Por que P2**: hoje só gerente e chef cancelam; sem isso o erro do garçom vira trabalho da
cozinha, mas a feature funciona sem.

**Teste independente**: João lança o pedido 6 na Mesa 12 por engano, abre Pedidos da mesa, toca
**Cancelar**, escolhe "Lançado errado" e vê o pedido riscado; a cozinha vê o pedido sair de
Recebidos.

**Cenários**

1. O garçom pode cancelar **só os pedidos que ele mesmo lançou** e **só enquanto estão Recebidos**
   (a cozinha ainda não começou; o estoque não baixou).
2. O motivo vem da lista do cancelamento (009) com o motivo novo **Lançado errado**; os outros
   motivos continuam.
3. Depois do Começar preparo, o botão some para o garçom e aparece "A cozinha já começou. Peça ao
   chef ou ao gerente para cancelar." O cancelamento com estoque (011) continua só com gerente e
   chef.
4. Se a cozinha toca Começar preparo no mesmo instante, só um vale: ou o pedido é cancelado, ou o
   garçom vê "A cozinha já começou." O estoque nunca baixa de pedido cancelado.
5. Pedido não é editado: para trocar algo, cancela e lança de novo (regra da 009).

### US5 — Lançar rápido no celular, em qualquer tela (P2)

Como garçom, quero achar o produto rápido e usar o sistema no meu celular com uma mão, para não
deixar a mesa esperando.

**Teste independente**: no celular pequeno da matriz de telas, abrir a Mesa 12 no modo **Lista**,
buscar "burg", tocar "+" duas vezes no X-Burger e enviar, sem rolar para o lado e com todo botão de
pelo menos 44 px.

**Cenários**

1. Dois modos: **Fotos** (os cartões do cliente) e **Lista** (uma linha por produto com nome,
   preço e "+"). O aparelho lembra o último modo.
2. A busca fica no topo e acha pelo nome sem diferenciar maiúsculas e acentos ("pure" acha "Purê").
3. "+" na lista põe 1 do produto sem abrir a tela do prato; tocar no nome abre a tela do prato
   (adicionais e retiradas).
4. O carrinho de cada mesa fica guardado no aparelho até enviar ou tocar **Limpar**; trocar de mesa
   e voltar não perde o que foi montado. A grade de mesas marca as que têm carrinho não enviado
   ("Carrinho: 3 itens").
5. Vale a matriz de telas da 013 (9 tamanhos, claro e escuro, dois motores de navegador): nada rola
   para o lado, nenhum texto cortado, botões de pelo menos 44 px, letra em 200% legível, girar o
   aparelho não perde o carrinho.
6. Sem internet, **Enviar pedido** avisa "Sem conexão. O pedido não foi enviado." e o carrinho
   continua. Reenviar depois não duplica.

## Casos-limite

- O cliente envia pelo QR code e o garçom envia na mesma mesa no mesmo instante, sem conta aberta:
  os dois pedidos entram na **mesma** conta nova; nunca abrem duas.
- O caixa fecha a conta enquanto o garçom monta o carrinho: o envio abre uma **conta nova** para a
  mesa (como o QR code depois de fechar), e a resposta avisa "A conta anterior desta mesa foi
  fechada. Este pedido abriu uma conta nova."
- Toque duplo em **Confirmar** ou reenvio depois de queda de rede devolvem o mesmo pedido.
- Preço que mudou, adicional que mudou, produto esgotado, inativado ou sem preço no meio do
  caminho: mesmas mensagens e mesma reconfirmação do cardápio do cliente (009, 010).
- Usuário com mais de um papel (gerente que também atende): vê **Lançar pedido** se algum papel
  permite; o pedido guarda o usuário, não o papel.
- Usuário removido da equipe com sessão aberta: o próximo envio é recusado com "Sem acesso" e o
  carrinho fica no aparelho.
- Dois garçons no mesmo aparelho: cada um entra com o seu usuário; ao sair, os carrinhos não
  enviados daquele aparelho são apagados, para o próximo garçom não enviar em nome do outro.
- O garçom tenta cancelar pedido de outro garçom ou pelo QR code: recusado e registrado como
  tentativa negada.
- A mesa tem 10 pedidos pelo QR code no mesmo acesso: o cliente vê "Chame um garçom"; o garçom
  lança normalmente.

## Requisitos

- **FR-001** Nova ação **lançar pedido para a mesa**, para os papéis Gerente, Garçom e Caixa (o
  caixa lança no balcão para a mesa). Chef e os papéis do estoque não lançam. Sem a permissão, a
  tela cai em "Sem acesso" e a tentativa fica na auditoria.
- **FR-002** O garçom escolhe uma mesa **ativa** do restaurante. O restaurante vem sempre do
  usuário logado, nunca do aparelho.
- **FR-003** O cardápio da equipe mostra os mesmos produtos, seções, ordem, preços, adicionais e
  retiradas do cardápio do cliente; produtos **Esgotado hoje** aparecem apagados com o selo e não
  podem ir ao carrinho; produto sem preço ou inativo não aparece.
- **FR-004** O envio pela equipe segue as conferências do envio do cliente (linhas, limites,
  disponibilidade, preço que mudou, adicional e retirada que saíram), sem acesso de 20 minutos, sem
  o limite de 10 pedidos e sem a chave "Recebendo pedidos pelo QR code".
- **FR-005** O pedido da equipe entra na conta aberta da mesa ou abre uma, com a taxa do restaurante
  do momento (011). Uma mesa nunca tem duas contas abertas, com qualquer mistura de origens.
- **FR-006** Todo pedido guarda a origem (**QR code** ou **Equipe**) e, na origem Equipe, o usuário
  que lançou. Pedido da origem Equipe sempre tem usuário; pedido pelo QR code nunca tem. Isso não
  muda depois do envio. O primeiro registro do histórico de situações (Recebido) guarda o mesmo
  usuário.
- **FR-007** A abertura de conta por pedido da equipe registra no histórico da conta quem abriu.
- **FR-008** Cozinha, Garçom (com "Só os meus"), conta da mesa, Contas fechadas e consulta Pedidos
  mostram a origem; a consulta filtra por origem e por quem lançou e resume quantidade e total por
  origem no período (pedidos não cancelados).
- **FR-009** **Pedidos da mesa**: os pedidos da conta aberta, de todas as origens, com situação e
  total da conta, atualizando a cada 10 segundos; **Entregue** nos prontos.
- **FR-010** Cancelamento pelo garçom: só pedido que ele lançou, só em Recebido, com motivo da lista
  (novo motivo **Lançado errado**). Os demais cancelamentos seguem a 009 e a 011.
- **FR-011** Sem pedido em dobro: o mesmo envio (toque duplo, reenvio) devolve o mesmo pedido.
- **FR-012** Carrinho por mesa guardado no aparelho, apagado ao enviar, ao tocar **Limpar** e ao
  sair do usuário.
- **FR-013** A tela do garçom passa na matriz de telas da 013 (9 tamanhos, claro e escuro, dois
  motores), com os mesmos critérios do cardápio do cliente.
- **FR-014** Toda escrita da equipe (envio, cancelamento, abertura de conta) vai para a trilha de
  auditoria com quem e quando; tentativa sem permissão fica registrada como negada.
- **FR-015** Isolamento por restaurante: mesas, cardápio, pedidos e filtros nunca cruzam
  restaurantes.
- **FR-016** O cardápio do cliente pelo QR code não muda. As mensagens "Chame um garçom" passam a
  ter resposta: o garçom lança pelo sistema.
- **FR-017** Textos em português do dia a dia: "Lançar pedido", "Pedidos da mesa", "Lançado por",
  "QR code"; nunca "origem EQUIPE" ou "usuário" na tela do garçom.
- **FR-018** *(depende da decisão pendente)* Na tela do prato, só para a equipe, o campo
  **Observação para a cozinha** (até 140 letras, uma por linha do pedido). Aparece em destaque na
  cozinha, no Garçom, na conta e na consulta; não muda preço nem estoque; o cardápio do cliente
  continua sem campo de texto.

## Entidades

- **Pedido** (009): ganha a **origem** (QR code ou Equipe) e **quem lançou** (usuário da equipe,
  só na origem Equipe). Pedido da equipe não tem acesso ao cardápio; pedido pelo QR code continua
  com o acesso de origem.
- **Histórico de situações do pedido** (009): o registro do envio guarda quem lançou.
- **Histórico da conta** (011): a abertura guarda quem lançou o pedido que abriu a conta.
- **Motivo de cancelamento** (009): ganha **Lançado errado**.
- **Carrinho do garçom**: fica só no aparelho, um por mesa; não vai para o banco.

## Critérios de sucesso

- **SC-001** Um garçom lança um pedido de 3 produtos (um com adicional e retirada) em menos de 45
  segundos, a partir da grade de mesas.
- **SC-002** 100% dos pedidos enviados depois desta feature têm origem; 100% dos pedidos da equipe
  têm quem lançou.
- **SC-003** Nenhuma mesa fica com duas contas abertas, com pedidos do QR code e da equipe chegando
  ao mesmo tempo (teste com envios simultâneos).
- **SC-004** O pedido do garçom aparece na cozinha em até 10 segundos, igual ao do QR code.
- **SC-005** Na consulta de um dia, a soma dos totais por origem é igual ao total dos pedidos não
  cancelados do dia, centavo por centavo.
- **SC-006** A tela do garçom passa em todos os tamanhos e modos da matriz de telas.

## Premissas

- **Acesso do garçom**: cada garçom tem o seu usuário, convidado pelo gerente na tela Equipe (001),
  com o papel Garçom, e entra com e-mail e senha, no próprio celular ou num aparelho do restaurante.
  Entrar rápido por código (PIN) num tablet compartilhado fica para depois.
- **Balcão**: o caixa também lança, mas sempre para uma mesa. Quem quer um "balcão" cria uma mesa
  chamada "Balcão" (sem QR code impresso). Pedido para viagem e delivery ficam fora.
- O garçom não muda preço, não dá desconto e não tira item da conta.
- A taxa de serviço continua da conta, não do garçom. Comissão por garçom fica fora.
- Pedidos de antes desta feature são todos do QR code.
- A 014 (caixa do dia) não muda: os pedidos da equipe entram nas contas e nos relatórios de vendas
  como qualquer pedido.

## Fora do escopo

Entrar por PIN em aparelho compartilhado, comissão e ranking de garçons, transferir pedido entre
mesas e juntar mesas, pedido para viagem e delivery, desconto e cortesia, editar pedido enviado,
dividir pedido por pessoa da mesa, impressão de comanda na cozinha, funcionar sem internet.

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-15 | Escopo | Pedido do dono: o garçom tem acesso próprio, entra no cardápio e lança pedidos para a mesa; o sistema guarda quem lançou; revisar o cardápio para esse uso |
| 2026-11-15 | Como o garçom entra? | Com o próprio usuário (papel Garçom), como a equipe já entra. PIN fica para depois (premissa) |
| 2026-11-15 | Quem lança além do garçom? | Gerente e caixa também; chef não (premissa) |
| 2026-11-15 | Garçom cancela? | Só o que ele lançou e só antes do preparo, com o motivo "Lançado errado" (premissa) |
| 2026-11-15 | Esgotado aparece para o garçom? | Sim, apagado e com selo, para ele avisar o cliente (premissa) |
| 2026-11-15 | Observação livre no pedido do garçom? | **Pendente do dono.** A 010 decidiu "só botões" para o cliente. Recomendação: o garçom (só a equipe) pode escrever uma observação de até 140 letras por linha ("ponto da carne mal passado"), que aparece em destaque na cozinha e **não** muda preço nem estoque. Se o dono preferir manter só botões, sai do FR-003 e da tela do prato |
