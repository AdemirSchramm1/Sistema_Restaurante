# Feature 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

**Branch**: `claude/project-thread-vfeeqt` · **Criada**: 2026-11-16 · **Status**: em revisão

**Pedido do dono**: "vamos verificar o cardápio/garçom fazer pedido, peguei essa imagem do google
pois demonstra como deve ficar o cardápio lembrando que os clientes utilizarão ou tablets ou
celulares, também vale ressaltar que alguns restaurantes podem optar por um tablet fixo na mesa
dessa maneira deve existir uma feature onde podemos só colocar a URL do cardápio e o tablet fica
aberto pra sempre nessa tela"

A imagem de referência mostra um cardápio de delivery em computador, tablet e celular: topo com o
logo e uma foto do restaurante, seções em abas, grade de cartões com foto, nome, descrição e preço,
e o **carrinho sempre aberto ao lado**, com o que foi escolhido em cada item e o total.

## Contexto

O cardápio do cliente existe desde a [009](../009-pedidos-qr-mesa/spec.md) e ganhou seções, fotos e
descrições na [013](../013-editar-cardapio/spec.md), com testes em 9 tamanhos de tela. O pedido
pelo garçom ([015](../015-pedido-pelo-garcom/spec.md), ainda sem código) usa o mesmo cardápio.

Comparação com a imagem, a partir das imagens de referência dos testes da 013:

| Parte | Hoje | Na imagem | Esta feature |
|---|---|---|---|
| Topo | "Mesa 12" e o nome do restaurante em texto | Logo e foto do restaurante | Logo e foto de capa, escolhidos pelo gerente (US1) |
| Seções | Abas que rolam para o lado | Abas em até duas linhas | Tablet e computador mostram todas as abas em até duas linhas; celular continua rolando (US2) |
| Cartões no celular | Um cartão grande por tela, foto em cima | Linha com foto pequena ao lado | Cartão em linha, 4 a 5 pratos por tela (US2) |
| Cartões no tablet e computador | 2 ou 3 colunas largas | 4 colunas compactas | 3 colunas no tablet em pé e no deitado (com o carrinho ao lado), 4 no computador (US2) |
| Carrinho | Escondido até tocar nele | Sempre aberto ao lado, com o que foi escolhido | Ao lado no tablet deitado e no computador; barra fixa embaixo no celular e no tablet em pé (US3) |
| Acesso | Só pelo QR code, 20 minutos por leitura | – | Link fixo do tablet da mesa, que não expira (US4 e US5) |
| Entrega, retirada, tempo de entrega, redes sociais | – | Sim | Fora: o sistema é para o salão |
| Preço "de/por" (promoção) | – | Sim | Fora desta versão |

## Histórias

### US1 — O cardápio mostra o logo e a foto do restaurante (P1)

Como gerente, quero pôr o logo e uma foto do restaurante no topo do cardápio, para o cliente
reconhecer a casa e o cardápio ter a nossa cara.

**Teste independente**: o gerente envia um logo e uma foto do salão na tela Cardápio; abrir o
cardápio pelo QR code no celular e no tablet e ver a foto no topo com o logo, o nome do restaurante
e "Mesa 12".

**Cenários**

1. A tela Cardápio (013) ganha o quadro **Aparência**, só para o gerente: **logo** e **foto de
   capa**, com as mesmas regras de foto da 013 (JPG, PNG ou WebP, até 10 MB, orientação da câmera
   respeitada). Logo de pelo menos 200 px no lado menor; capa de pelo menos 1200 px de largura.
2. O logo aparece quadrado, com os cantos arredondados; imagem que não é quadrada é recortada no
   centro e a tela mostra o recorte antes de salvar.
3. A capa aparece no topo do cardápio com uma camada escura por cima, para o nome do restaurante e
   "Mesa 12" ficarem legíveis em claro e escuro (contraste mínimo 4,5:1 conferido em teste).
4. Altura do topo: 120 px no celular, 160 px no tablet e no computador. Ao rolar, o topo sai e fica
   só a barra de seções presa.
5. Sem capa, o topo usa a cor principal do sistema. Sem logo, só o nome.
6. **Trocar** e **Tirar** logo e capa, com confirmação para tirar.

### US2 — Mais pratos por tela, em qualquer aparelho (P1)

Como cliente, quero ver vários pratos de uma vez, no celular ou no tablet, para escolher sem rolar
muito.

**Teste independente**: com 12 pratos na seção Lanches, abrir o cardápio no celular de 390 px e ver
pelo menos 4 pratos inteiros sem rolar depois do topo; no tablet deitado, ver 2 linhas de 3 cartões
com o carrinho ao lado.

**Cenários**

1. **Celular** (até 599 px): cada prato é uma linha com a foto à esquerda (4:3, 112 px de largura),
   e à direita o nome (até 2 linhas), a descrição (até 2 linhas), o preço e o botão **+** (44 ×
   44 px). Prato sem foto ocupa a linha inteira com o texto.
2. **Celular deitado e tablet em pé** (600 a 1023 px): grade de 3 colunas de cartões compactos (foto
   em cima, nome, até 2 linhas de descrição, preço e **+**).
3. **Tablet deitado** (1024 a 1279 px): grade de 3 colunas e o carrinho ao lado (US3).
4. **Computador** (1280 px ou mais): grade de 4 colunas e o carrinho ao lado.
5. **Abas de seções**: no tablet e no computador aparecem todas, em até 2 linhas; com mais seções do
   que cabe em 2 linhas, a barra rola para o lado. No celular, uma linha que rola. A aba da seção
   que está na tela fica marcada e a barra fica presa no topo ao rolar.
6. Tocar no cartão (foto ou nome) abre a tela do prato, como hoje. Tocar no **+** de um prato sem
   adicionais nem retiradas põe 1 no carrinho direto e mostra "X-Burger no carrinho"; com adicionais
   ou retiradas, abre a tela do prato.
7. Todas as regras de tela da 013 continuam valendo em cada largura: nada rola para o lado, nenhum
   texto cortado, toque mínimo 44 px, letra em 200%, girar sem perder carrinho nem lugar, fotos
   carregando só perto da tela, claro e escuro.

### US3 — Carrinho sempre à vista (P1)

Como cliente, quero ver o que já escolhi e o total o tempo todo, para pedir sem me perder.

**Teste independente**: no tablet deitado, pôr 1 X-Burger com + 2 Fatia de queijo e sem cebola e
1 Suco; ver no carrinho ao lado as duas linhas, "+ 2 Fatia de queijo", "**SEM** cebola", os preços,
o total R$ 43,00 e **Enviar pedido**.

**Cenários**

1. **Tablet deitado e computador**: o carrinho é uma coluna fixa à direita (320 px), com o título
   "Seu pedido", as linhas (quantidade, nome, adicionais e retiradas escolhidos, preço), **−** e
   **+** por linha, **Tirar**, o total e **Enviar pedido** sempre visível no pé da coluna. Vazio:
   "Escolha os pratos e eles aparecem aqui."
2. **Celular e tablet em pé**: barra fixa no pé da tela "Ver pedido · 3 itens · R$ 98,00" que abre
   o carrinho por cima do cardápio. A barra não cobre o último cartão (a página reserva o espaço).
3. Ao pôr um prato, a linha do carrinho pisca e o total muda; quem usa leitor de tela ouve
   "X-Burger no carrinho. Total R$ 43,00".
4. **Meus pedidos** fica no mesmo lugar: aba "Pedidos enviados" no carrinho, com a situação de cada
   um, atualizando sozinha a cada 10 segundos.
5. O envio, o resumo, o "sem pedido em dobro", o preço que mudou e o produto que saiu continuam como
   na 009 e na 010.

### US4 — Ligar um tablet fixo na mesa (P1)

Como gerente, quero colocar um tablet na mesa com o cardápio aberto para sempre, só abrindo um link
nele, para o cliente pedir sem escanear nada.

**Teste independente**: na tela Mesas, tocar **Tablet da mesa** na Mesa 12, copiar o link, abrir no
tablet e ver o cardápio da Mesa 12 sem "Faltam N min"; 3 horas depois, o cardápio ainda está aberto
e um pedido enviado cai na conta da Mesa 12.

**Cenários**

1. Cada mesa ganha um **link do tablet**, diferente do QR code, mostrado no cartão da mesa em
   **Tablet da mesa** (só gerente): o link para copiar, um QR code para abrir no tablet sem digitar,
   e a situação ("Nenhum tablet ligado", "Tablet ligado desde 16/11 20:05").
2. O primeiro aparelho que abre o link vira o **tablet daquela mesa**. Abrir o mesmo link em outro
   aparelho mostra "Este link já está ligado em outro tablet. Peça ao gerente para liberar." e não
   mostra o cardápio.
3. **Liberar** (trocar de tablet, tablet quebrado): pede confirmação, desliga o tablet ligado na hora
   (ele mostra "Este tablet foi desligado. Peça ao gerente.") e o link volta a aceitar o próximo
   aparelho que o abrir.
4. **Trocar link** (o link vazou): pede confirmação, desliga o tablet e o link antigo para de
   funcionar ("Link inválido. Chame um garçom."). O link novo aparece na hora.
5. O tablet da mesa **não tem limite de tempo** nem de pedidos por acesso. Continua valendo a chave
   "Recebendo pedidos" e a mesa inativa ("Esta mesa não está recebendo pedidos. Chame um garçom.").
6. O QR code da mesa continua funcionando como hoje (20 minutos por leitura); mesa com tablet pode
   ter os dois.
7. Todo pedido do tablet entra na conta da mesa, como o do QR code, e a cozinha vê "Mesa 12 ·
   tablet".
8. A tela Mesas mostra quantas mesas têm tablet ligado e, por mesa, a última vez que o tablet
   falou com o sistema ("visto há 2 min"; acima de 10 min, em destaque: "Sem sinal há 25 min").
9. Ligar, liberar e trocar link vão para a trilha de auditoria com quem e quando; o código do link
   não aparece no histórico.

### US5 — O tablet fica pronto para o próximo cliente (P1)

Como gerente, quero que o tablet volte sozinho ao começo e não mostre o pedido do cliente anterior,
para não precisar de alguém mexendo nele.

**Teste independente**: no tablet da Mesa 12, pôr dois pratos no carrinho e deixar parado 3
minutos; ver "Ainda está aí?" e, 30 segundos depois, o cardápio limpo no começo. Fechar a conta da
Mesa 12 no caixa e ver o tablet voltar à tela de boas-vindas sem os pedidos anteriores.

**Cenários**

1. **Tela de boas-vindas**: a capa e o logo em tela cheia, "Mesa 12" e o botão grande **Ver o
   cardápio**. É onde o tablet fica quando ninguém está usando.
2. **Parado**: sem toque por 3 minutos com o carrinho vazio, volta às boas-vindas. Com algo no
   carrinho, mostra "Ainda está aí? Seu pedido não foi enviado." com **Continuar** e, sem resposta
   em 30 segundos, limpa o carrinho e volta às boas-vindas.
3. **Depois de enviar**: "Pedido enviado para a cozinha" por 10 segundos e volta ao cardápio, com o
   carrinho vazio e o pedido em "Pedidos enviados".
4. **Pedidos enviados** no tablet mostra só os pedidos da **conta aberta** da mesa (de qualquer
   origem: tablet, QR code ou garçom). Quando o caixa fecha a conta, o tablet volta às boas-vindas
   em até 10 segundos e não mostra mais nada da conta fechada.
5. **Tela sempre acesa**: enquanto o cardápio do tablet está aberto, ele pede ao aparelho para não
   apagar a tela (onde o navegador permite) e oferece **Tela cheia**.
6. **Sem internet**: o pedido não fica guardado para envio posterior; o tablet mostra "Sem
   conexão com o restaurante. Chame um garçom." e volta ao cardápio sozinho
   quando a conexão volta, com o carrinho como estava.
7. **Recarregar a página** ou o tablet reiniciar: volta para as boas-vindas da mesma mesa, sem
   precisar do gerente.
8. Um texto de ajuda na tela **Tablet da mesa** explica como travar o tablet no navegador
   (Android: "Fixar app"; iPad: "Acesso Guiado"), porque uma página não consegue impedir o cliente
   de sair do navegador.

## Casos-limite

- Link do tablet aberto em dois aparelhos ao mesmo tempo, antes de algum estar ligado: só um liga; o
  outro vê a mensagem de link em uso.
- Tablet ligado e mesa inativada: o tablet mostra "Esta mesa não está recebendo pedidos. Chame um
  garçom." e volta sozinho quando a mesa é reativada.
- Mesa renomeada: o tablet mostra o nome novo em até 10 segundos.
- Navegador do tablet apagou os dados (limpeza, modo anônimo): o tablet deixa de ser reconhecido e
  mostra a mensagem de link em uso; o gerente usa **Liberar** e abre o link de novo.
- Pedido enviado do tablet no mesmo instante em que o caixa fecha a conta: mesma regra da 011
  (entra na conta antes do fechamento ou abre uma conta nova; nunca fica fora de conta).
- Cliente que leva o celular com o link do tablet copiado: o link só funciona no aparelho ligado.
- Logo ou capa trocados: o cardápio aberto mostra a imagem nova na próxima atualização (até 10
  segundos), sem recarregar.
- Muitas seções (mais de 2 linhas no tablet): a barra rola para o lado, sem cortar o nome de nenhuma.
- Nome de prato longo no cartão em linha do celular: quebra em 2 linhas e termina em "…"; a tela do
  prato mostra o nome inteiro.

## Requisitos

- **FR-001** Logo e capa do restaurante: só o gerente envia, troca e tira, com as regras de foto da
  013; o logo tem pelo menos 200 px no lado menor e a capa pelo menos 1200 px de largura. Aparecem
  no topo do cardápio do cliente, do tablet e na pré-visualização "Ver como o cliente".
- **FR-002** Layout por largura: até 599 px, cartões em linha; 600 a 1023 px, 3 colunas e barra do
  carrinho no pé; 1024 a 1279 px, 3 colunas e carrinho ao lado; 1280 px ou mais, 4 colunas e
  carrinho ao lado. Abas em até 2 linhas a partir de 600 px.
- **FR-003** O carrinho mostra, por linha, a quantidade, o nome, os adicionais com as vezes, as
  retiradas, o preço da linha e os botões **−**, **+** e **Tirar**; o total e **Enviar pedido**
  ficam sempre visíveis sem rolar.
- **FR-004** Cada mesa tem um link de tablet com código aleatório, diferente do QR code, que não
  dá para adivinhar a partir de outro. O link fica ligado a um único aparelho (o primeiro que o
  abre) até o gerente **Liberar** ou **Trocar link**.
- **FR-005** O tablet ligado abre o cardápio da mesa sem limite de tempo e sem limite de pedidos por
  acesso; continuam valendo a chave "Recebendo pedidos", a mesa inativa e todas as regras de envio
  da 009 e da 010.
- **FR-006** O tablet volta às boas-vindas depois de 3 minutos parado (com "Ainda está aí?" por 30
  segundos quando há algo no carrinho), depois de enviar (10 segundos de confirmação) e quando a
  conta da mesa fecha.
- **FR-007** O tablet mostra só os pedidos da conta aberta da mesa e nada de contas fechadas.
- **FR-008** O pedido guarda a origem: QR code, tablet ou garçom (015). A cozinha e a consulta de
  pedidos mostram a origem.
- **FR-009** Permissões: logo e capa, link do tablet, liberar e trocar link são só do gerente
  (decidido no plano, R13: o tablet usa `table.manage`, que já é só do gerente; logo e capa
  usam a permissão nova `menu.appearance`, só do gerente).
- **FR-010** Auditoria de logo, capa, ligar, liberar e trocar link, com quem e quando; o código do
  link nunca vai para o histórico.
- **FR-011** O tablet conta como acesso ao cardápio só daquele restaurante e daquela mesa; nenhum
  dado de outra mesa ou restaurante chega ao tablet.
- **FR-012** Testes de tela: as regras de layout da 013 (US6) e a comparação de imagem valem para o
  cardápio novo, a tela de boas-vindas, o carrinho ao lado e a barra do carrinho, nos 9 tamanhos,
  claro e escuro, Chromium e WebKit. As imagens de referência da 013 são refeitas nesta feature,
  com o motivo registrado no PR.
- **FR-013** Cada linha de código nasce de um teste que falha antes, como nas regras de TDD da 013
  (TDD-001 a TDD-010), que esta feature herda.

## Entidades

- **Aparência do restaurante**: logo e capa (fotos com as variantes de tamanho da 013).
- **Tablet da mesa**: mesa, código do link, aparelho ligado (identificação guardada no aparelho),
  ligado em, visto por último em, liberado ou trocado (quem, quando).
- **Pedido** (009): ganha a origem (QR code, tablet, garçom).

## Critérios de sucesso

- **SC-001** No celular de 390 px, pelo menos 4 pratos inteiros aparecem na tela depois do topo
  (hoje são 1 a 2).
- **SC-002** No tablet deitado, o cliente vê o total e **Enviar pedido** sem rolar, com qualquer
  quantidade de itens no carrinho.
- **SC-003** O gerente liga um tablet numa mesa em menos de 1 minuto, só abrindo o link.
- **SC-004** Um tablet ligado continua com o cardápio aberto por 12 horas seguidas sem ninguém mexer
  e envia um pedido no fim desse tempo.
- **SC-005** 100% das vezes que a conta da mesa fecha, o tablet daquela mesa deixa de mostrar os
  pedidos dela em até 10 segundos.
- **SC-006** Todas as telas novas passam as regras de tela da 013 nos 9 tamanhos, nos dois modos e
  nos dois motores.

## Premissas

- O tablet é um aparelho comum (Android ou iPad) com navegador; não há aplicativo para instalar.
  Travar o tablet no navegador é feito pelo próprio aparelho (Fixar app, Acesso Guiado).
- "Ligar ao primeiro aparelho que abre o link" é a proteção contra link copiado: quem tem o link não
  consegue pedir de casa. Alternativa considerada: pedir o login do gerente no tablet uma vez; ficou
  de fora porque o dono pediu "só colocar a URL".
- Os tempos de 3 minutos parado, 30 segundos de "Ainda está aí?" e 10 segundos de confirmação são
  os mesmos para todos os restaurantes nesta versão.
- O visual (cores, fontes, componentes) segue o padrão da 012; a imagem do dono serve para a
  organização da tela, não para copiar as cores ou a marca de outro sistema.
- A pré-visualização "Ver como o cliente" da 013 passa a mostrar o layout novo, inclusive como o
  tablet da mesa.

## Fora do escopo

Entrega e retirada no balcão com endereço, tempo de entrega, links de redes sociais, preço
promocional "de/por", banner de promoção, pagamento no tablet, chamar o garçom pelo tablet (pode vir
numa feature própria), idioma estrangeiro, avaliação do pedido, aplicativo nativo.

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-16 | Visual de referência | Imagem enviada pelo dono: topo com logo e foto, abas, grade de cartões, carrinho ao lado |
| 2026-11-16 | Tablet fixo na mesa | Pedido do dono: link fixo da mesa que fica aberto para sempre |
| 2026-11-16 | Como proteger o link do tablet? | O link vale só no primeiro aparelho que o abre, até o gerente liberar (premissa, sem pergunta) |
| 2026-11-16 | Delivery, redes sociais, preço de/por | Fora desta versão: o sistema é para o salão (premissa) |
| 2026-11-16 | O tablet limpa sozinho? | Sim: 3 minutos parado, depois de enviar e quando a conta fecha (premissa) |
