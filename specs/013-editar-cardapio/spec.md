# Feature 013 — Gerente e chef editam o cardápio (foto, descrição, seções e ordem)

**Branch**: `claude/project-thread-licz2z` · **Criada**: 2026-11-13 · **Status**: em revisão

**Pedido do dono**: "Agora preciso que você faça com que o gerente/chefe possam mexer no cardápio
para adicionar produtos com foto e descrição, algo que fosse bem editável. Essa parte é muito
importante: o TDD, pois assim garantimos que o cardápio seja o mais perfeito em cada tela, visto que
existem muitos telefones e tablets diferentes. Por isso abuse do TDD: cada linha de código só deve
ser gerada se passar no TDD."

## Contexto

O cliente já pede pelo celular ([009](../009-pedidos-qr-mesa/spec.md),
[010](../010-adicionais-retiradas/spec.md)) e o cardápio ganhou cartões na
[012](../012-nova-cara-e-desempenho/spec.md). Mas o cardápio hoje é só uma lista em ordem
alfabética com nome e preço: o produto ([003](../003-produtos/spec.md)) não tem foto, nem
descrição, nem seção (Entradas, Pratos, Bebidas…), e a ordem não pode ser escolhida. Quem cuida do
cardápio não tem uma tela para isso: o preço fica no painel de custos
([008](../008-painel-custo-produtos/spec.md)) e o "Esgotado hoje" na cozinha.

Esta feature cria a tela **Cardápio** da equipe, onde gerente e chef montam o que o cliente vê:
foto, descrição, preço, seção e ordem de cada produto, com uma pré-visualização do cardápio no
tamanho de celular e de tablet. O cardápio do cliente passa a mostrar seções, fotos e descrições.

O dono pediu, como ponto mais importante, que o cardápio fique certo **em cada tela**, porque os
clientes usam celulares e tablets de todos os tamanhos, e que a feature seja construída com TDD
rigoroso. Isso está na seção [Regras de TDD desta feature](#regras-de-tdd-desta-feature), que vale
para o plano, as tarefas e a implementação. Hoje os testes ponta a ponta usam um único celular
(Pixel 7) e um computador; esta feature passa a exigir uma matriz de tamanhos.

## Histórias

### US1 — Pôr foto e descrição no produto (P1)

Como gerente ou chef, quero pôr uma foto e uma descrição em cada produto do cardápio, para o
cliente saber o que está pedindo e ter vontade de pedir.

**Por que P1**: é o pedido principal do dono.

**Teste independente**: entrar como chef, abrir **Cardápio**, escolher "X-Burger", enviar uma foto
e escrever "Pão brioche, 150 g de carne, queijo prato e molho da casa"; abrir o cardápio pelo QR
code no celular e ver o cartão do X-Burger com a foto e a descrição.

**Cenários**

1. Dado o menu como gerente ou chef, então vejo **Cardápio** na área Operação. Os outros papéis
   não veem a tela e, se abrirem o endereço, caem em "Sem acesso".
2. Dado um produto vendido, quando escolho uma foto do aparelho (no celular e no tablet também
   posso **tirar a foto na hora** com a câmera), então vejo a foto como ela vai aparecer no cartão,
   já no recorte do cartão, antes de salvar.
3. Dado uma foto JPG, PNG ou WebP de até 10 MB, quando salvo, então ela aparece no produto. Foto
   maior: "A foto pode ter até 10 MB". Outro tipo de arquivo: "Use uma foto JPG, PNG ou WebP".
   Foto menor que 600 px no lado menor: "Essa foto é pequena e vai ficar borrada no cardápio. Use
   uma foto de pelo menos 600 px".
4. Dado uma foto tirada com o celular deitado ou de lado, quando ela aparece, então está em pé
   (a orientação da câmera é respeitada).
5. Dado um produto com foto, quando toco **Trocar foto** ou **Tirar foto**, então a foto antiga sai
   do cardápio. Tirar foto pede confirmação.
6. Dado o campo **Descrição**, quando escrevo até 300 caracteres, então ela é salva sem espaços
   sobrando no começo e no fim. O campo mostra quantos caracteres faltam. Mais que 300: "A
   descrição pode ter até 300 caracteres". Descrição vazia é permitida.
7. Dado uma descrição com quebras de linha, então o cardápio mostra as quebras; marcação (HTML,
   links) aparece como texto, nunca como código.
8. Dado que a foto ainda está subindo, quando a conexão cai, então aparece "Não foi possível enviar
   a foto. Tente de novo." e o que já estava salvo no produto continua igual.

### US2 — Organizar o cardápio em seções (P1)

Como gerente ou chef, quero separar o cardápio em seções (Entradas, Pratos, Bebidas, Sobremesas),
para o cliente achar o que quer sem rolar a lista inteira.

**Teste independente**: criar as seções "Entradas", "Lanches" e "Bebidas", pôr o X-Burger em
"Lanches" e a Coca-Cola em "Bebidas" e ver o cardápio do cliente separado por essas seções, nessa
ordem.

**Cenários**

1. Dado a tela Cardápio, quando crio a seção "Lanches", então ela aparece no fim da lista de
   seções. Nome obrigatório, até 40 caracteres, sem repetir no restaurante (sem diferenciar
   maiúsculas e acentos): "Já existe a seção Lanches".
2. Posso renomear a seção; o nome novo aparece no cardápio do cliente.
3. Posso mudar a ordem das seções com **Subir** e **Descer**.
4. Cada produto vendido fica em no máximo uma seção. Produto sem seção aparece no cardápio do
   cliente no fim, em **Outros**. Quando nenhum produto tem seção, o cardápio não mostra títulos de
   seção (fica como hoje).
5. Seção sem nenhum produto que o cliente possa pedir não aparece para o cliente.
6. Dado uma seção com produtos, quando apago a seção, então peço confirmação dizendo quantos
   produtos ela tem ("Os 4 produtos de Lanches vão para Outros") e os produtos passam para "Outros".

### US3 — Escolher a ordem dos produtos (P1)

Como gerente ou chef, quero escolher a ordem dos produtos dentro de cada seção, para pôr na frente
o prato da casa e o que dá mais lucro.

**Teste independente**: em "Lanches", subir o "X-Salada" para o primeiro lugar e ver o cardápio do
cliente com o X-Salada antes do X-Burger.

**Cenários**

1. Dentro de cada seção, cada produto tem **Subir** e **Descer**, que funcionam com toque, mouse e
   teclado. O primeiro não tem "Subir" ativo e o último não tem "Descer" ativo.
2. Produto novo numa seção entra no fim dela.
3. Ao mudar um produto de seção, ele entra no fim da seção nova.
4. Mudar a ordem não muda o preço, as versões do produto nem os pedidos já enviados.
5. O resultado da busca do cardápio do cliente segue a ordem do cardápio (seção e posição), não
   mais a ordem alfabética.

### US4 — Editar o produto do cardápio num lugar só (P1)

Como gerente ou chef, quero mudar preço, foto, descrição, seção e "Esgotado hoje" do produto na
mesma tela, e cadastrar um produto novo dali, para não precisar passar por três telas.

**Teste independente**: na tela Cardápio, criar o produto "Suco de laranja" com o item "Laranja"
300 g, preço R$ 9,00, seção "Bebidas", foto e descrição, e vê-lo no cardápio do cliente.

**Cenários**

1. A tela Cardápio lista as seções com seus produtos, na ordem do cliente. Cada produto mostra a
   foto pequena (ou um espaço com "Sem foto"), nome, preço e selos: "Sem preço", "Inativo",
   "Esgotado hoje", "Sem foto". Produto sem preço ou inativo fica na lista da equipe com o selo,
   mas não aparece para o cliente (regra da 009).
2. Ao abrir um produto, edito na mesma tela: foto, descrição, preço de venda, seção e "Esgotado
   hoje". O preço segue as regras da 008 (maior que zero, duas casas, só gerente e chef) e o
   "Esgotado hoje" as da 009.
3. Nome e ingredientes do produto continuam na tela do produto (003, que cria versão); a tela
   Cardápio tem o link **Editar nome e ingredientes**.
4. **Novo produto** na tela Cardápio abre o cadastro de produto vendido da 003 (nome e pelo menos
   um item, para o estoque continuar baixando) com, no mesmo formulário, preço, seção, descrição e
   foto. Ao salvar, volto para a tela Cardápio com o produto no fim da seção escolhida.
5. Cada mudança é salva sozinha (sem um botão "Publicar" geral) e aparece para o cliente na
   próxima atualização do cardápio dele (até 10 s, que é o ciclo que o cardápio já tem). A tela
   confirma "Salvo" só quando o servidor confirma (padrão da 012).
6. Mudar o preço por aqui tem o mesmo efeito da 008: pedido no carrinho com preço antigo pede nova
   confirmação ao cliente ("O preço de X-Burger mudou para R$ 32,00").
7. Toda mudança (foto posta, trocada ou tirada, descrição, preço, seção, ordem, seção criada,
   renomeada ou apagada) vai para a trilha de auditoria com quem e quando. Tentativa sem permissão
   fica registrada como negada.

### US5 — Ver como o cliente vê, em celular e tablet (P1)

Como gerente ou chef, quero ver o cardápio exatamente como o cliente vai ver, em tamanho de celular
e de tablet, antes de deixar a mesa ler o QR code.

**Teste independente**: na tela Cardápio, tocar **Ver como o cliente**, alternar entre "Celular" e
"Tablet" e ver as seções, fotos, descrições e preços como no cardápio pelo QR code.

**Cenários**

1. **Ver como o cliente** abre o cardápio do cliente no modo pré-visualização, com a faixa
   "Pré-visualização: pedidos não são enviados". Não abre acesso de 20 minutos, não conta pedido e
   não tem botão de enviar.
2. A pré-visualização tem os botões **Celular** (390 px de largura), **Tablet em pé** (768 px) e
   **Tablet deitado** (1024 px). No computador, mostra o cardápio dentro de uma moldura com essa
   largura; no próprio celular, mostra em tela cheia.
3. A pré-visualização mostra o que o cliente veria agora: só produtos ativos, com preço e não
   esgotados hoje.

### US6 — Cardápio do cliente certo em qualquer celular e tablet (P1)

Como cliente, quero ver o cardápio bonito e fácil de usar no meu aparelho, seja um celular pequeno
ou um tablet grande, em pé ou deitado.

**Por que P1**: o dono destacou este ponto como o mais importante da feature.

**Teste independente**: abrir o mesmo cardápio (com produtos com e sem foto, nome longo e descrição
longa) em cada tamanho da [matriz de telas](#matriz-de-telas) e conferir os cenários abaixo em
todos.

**Cenários**

1. O cardápio mostra a barra de seções no topo; tocar numa seção leva até ela, e a barra continua
   visível ao rolar. Com muitas seções, a barra rola para o lado **dentro dela**, sem fazer a
   página rolar para o lado.
2. Os produtos aparecem em cartões: 1 coluna em celular, 2 colunas em tablet em pé e 3 em tablet
   deitado e computador. O cartão mostra foto, nome, descrição (até 3 linhas, com "…") e preço em
   destaque. Tocar no cartão abre a tela do prato com a foto maior e a descrição inteira.
3. A foto mantém a proporção (nunca esticada nem achatada), ocupa o mesmo recorte em todos os
   cartões e tem texto alternativo com o nome do produto. Produto sem foto mostra o cartão sem
   espaço vazio e sem ícone de imagem quebrada.
4. Nome longo ("Hambúrguer artesanal de costela com cheddar inglês e cebola caramelizada") quebra
   em várias linhas sem cortar letras, sem sair do cartão e sem empurrar o preço para fora da tela.
5. Botões e áreas de toque têm pelo menos 44 × 44 px e nunca ficam um sobre o outro.
6. Nenhuma largura da matriz tem rolagem para o lado na página.
7. Com a letra do aparelho em 200%, o texto continua legível, sem sobrepor e sem cortar.
8. Girar o aparelho (em pé ↔ deitado) com o carrinho cheio não perde o carrinho nem a posição.
9. Modo claro e modo escuro do aparelho mantêm o contraste da 012 (texto 4,5:1), inclusive o texto
   sobre a foto, se houver.
10. As fotos que estão fora da tela só carregam quando o cliente chega perto delas, e cada foto vem
    no tamanho certo para a tela (celular não baixa a foto do tamanho de computador).
11. Busca, adicionais, retiradas, carrinho, "Meus pedidos" e o tempo do acesso continuam como na
    009 e na 010 em todas as larguras.

## Matriz de telas

Os tamanhos abaixo representam os aparelhos dos clientes e da equipe. **Todo teste de tela desta
feature roda em todas as linhas marcadas para a tela que testa**.

| Nome | Largura × altura (px) | Representa | Cardápio do cliente | Tela Cardápio da equipe |
|---|---|---|---|---|
| Celular pequeno | 320 × 568 | Celulares antigos e compactos | sim | sim |
| Celular Android | 360 × 800 | Android mais comum | sim | sim |
| Celular iPhone | 390 × 844 | iPhone atual | sim | sim |
| Celular grande | 430 × 932 | Celulares grandes | sim | — |
| Celular deitado | 844 × 390 | Celular girado | sim | — |
| Tablet em pé | 768 × 1024 | iPad e tablets Android | sim | sim |
| Tablet grande em pé | 820 × 1180 | Tablets maiores | sim | — |
| Tablet deitado | 1024 × 768 | Tablet girado, tablet da cozinha | sim | sim |
| Computador | 1280 × 800 | Escritório | sim | sim |

Os testes rodam pelo menos em um motor de navegador do tipo Chrome (Android) e um do tipo Safari
(iPhone e iPad).

## Regras de TDD desta feature

O dono pediu: "cada linha de código só deve ser gerada se passar no TDD". A constituição já exige
teste antes (princípio I); esta feature aperta a regra e o plano, as tarefas e a implementação
**herdam** estas regras sem exceção.

- **TDD-001 Teste antes de cada linha.** Nenhuma linha de código de produção (regra, consulta,
  tela, estilo de layout, texto de interface) é escrita sem um teste que falhe por falta dela. O
  ciclo é: escrever o teste → ver falhar pela asserção (não por erro de importação) → escrever o
  mínimo para passar → refatorar com tudo verde.
- **TDD-002 Vermelho registrado.** Cada passo deixa rastro no histórico: o commit do teste
  vermelho vem antes do commit do código (mensagem "(vermelho)", como na 012), ou os dois vão no
  mesmo commit com o teste citado na mensagem. A revisão do PR confere a ordem.
- **TDD-003 Layout também é testado.** Cada cenário da US6 vira teste automático que roda em
  **cada largura** da [matriz de telas](#matriz-de-telas): sem rolagem para o lado; nenhum texto
  cortado ou fora do cartão; nenhum elemento tocável menor que 44 × 44 px ou sobreposto a outro;
  foto com a proporção certa; número de colunas por largura; barra de seções visível ao rolar.
- **TDD-004 Comparação visual.** Para cada largura da matriz, nos modos claro e escuro, há uma
  imagem de referência do cardápio do cliente e da tela Cardápio, com dados fixos (produto com e
  sem foto, nome e descrição longos). Qualquer mudança de pixel fora da tolerância definida no
  plano faz o teste falhar; atualizar a referência exige a imagem nova revisada no PR.
- **TDD-005 Acessibilidade em todas as larguras.** A verificação automática de acessibilidade
  (WCAG 2.1 AA, já usada na 012) roda no cardápio do cliente e na tela Cardápio em todas as
  larguras da matriz, sem nenhuma falha grave.
- **TDD-006 Regras como teste de unidade.** Cada regra desta spec (limites da foto e da
  descrição, nome de seção único, ordem ao subir e descer, produto que vai para "Outros", seção que
  some sem produtos, quem pode editar) tem pelo menos um teste nomeado pela regra, no nível mais
  rápido possível.
- **TDD-007 Banco de verdade.** Permissões, isolamento entre restaurantes, trilha de auditoria e
  ordem gravada são testados com o banco real (princípio da 001), nunca com banco falso.
- **TDD-008 Nenhuma linha sem teste.** Todo código novo desta feature tem 100% das linhas e dos
  desvios cobertos pelos testes; o plano define também um teste de mutação no código novo de
  regra, para provar que os testes falham quando a regra muda.
- **TDD-009 Nada é desligado.** Nenhum teste é pulado, apagado ou afrouxado para a CI ficar verde,
  e nenhuma imagem de referência é atualizada só para "passar".
- **TDD-010 Bug vira teste.** Qualquer problema de tela achado na revisão ou depois (num aparelho
  que não está na matriz, por exemplo) começa por um teste que reproduz o problema; se for um
  tamanho novo, ele entra na matriz.

## Casos-limite

- Restaurante sem nenhuma foto: o cardápio fica como hoje, em cartões sem foto, sem espaços vazios.
- Produto vendido que vira inativo, perde o preço ou fica esgotado: some do cliente, mas mantém
  foto, descrição, seção e posição para quando voltar.
- Dois membros da equipe mudam a ordem ao mesmo tempo: a ordem final é a da última mudança salva e
  a tela de cada um se atualiza; nenhum produto some nem aparece duas vezes.
- Foto de 10 MB numa rede lenta: a tela mostra o progresso e o resto da tela continua usável.
- Foto com fundo claro no modo escuro, ou foto escura no modo claro: o texto nunca fica sobre a foto
  sem um fundo que garanta o contraste.
- Produto que é preparo (usado dentro de outro): não aparece na tela Cardápio.
- Cliente com o cardápio aberto quando a foto ou a ordem muda: na próxima atualização vê o novo,
  sem perder o carrinho.
- A foto do cardápio é pública como o próprio cardápio, mas o endereço dela não permite descobrir
  fotos de outros produtos ou de outros restaurantes.
- Imprimir o cardápio está fora desta feature; imprimir a conta e os QR codes continua igual.

## Requisitos

- **FR-001** Nova permissão para editar o cardápio (foto, descrição, seção, ordem, seções), dada a
  **gerente e chef**. O preço continua com a permissão da 008 e o "Esgotado hoje" com a da 009, que
  já são de gerente e chef.
- **FR-002** O produto vendido guarda: foto (opcional), descrição (opcional, até 300 caracteres,
  texto simples), seção (opcional) e posição na seção.
- **FR-003** Foto: JPG, PNG ou WebP, até 10 MB, lado menor de pelo menos 600 px. O sistema guarda
  a foto em versões de tamanhos diferentes para celular, tablet e computador, respeita a orientação
  da câmera e retira os dados escondidos da foto (como a localização de onde foi tirada).
- **FR-004** Seção: nome obrigatório, até 40 caracteres, único no restaurante sem diferenciar
  maiúsculas e acentos, com posição. Apagar uma seção manda os produtos dela para "Outros".
- **FR-005** Ordem do cliente: seções na ordem escolhida, "Outros" no fim; dentro de cada seção,
  produtos na posição escolhida. Subir e descer trocam um produto (ou seção) com o vizinho.
- **FR-006** O cardápio do cliente mostra seções, fotos e descrições conforme a US6, mantendo
  todas as regras da 009, 010 e 011 (o que aparece, acesso de 20 minutos, envio, preço que mudou).
- **FR-007** A pré-visualização mostra o cardápio do cliente sem abrir acesso, sem enviar pedido e
  sem gravar nada.
- **FR-008** Todo dado do cardápio pertence a um restaurante; nenhuma consulta, foto ou endereço
  cruza restaurantes.
- **FR-009** Toda escrita da tela Cardápio vai para a trilha de auditoria com quem, quando e o que
  mudou; tentativa sem permissão fica registrada como negada.
- **FR-010** As telas novas seguem os padrões da 012 (componentes, paleta, contraste, fontes,
  menu) e entram no menu em Operação, só para quem tem a permissão.
- **FR-011** As regras de TDD-001 a TDD-010 valem para todo o código desta feature.
- **FR-012** `docs/produto/pedidos/` ganha o documento da edição do cardápio e o
  `02-cardapio-do-cliente.md` é atualizado; `09-controles-e-permissoes.md` ganha a permissão nova;
  `docs/sistema/` registra a matriz de telas e como rodar os testes por tamanho.

## Critérios de sucesso

- **SC-001** Um chef cadastra foto e descrição de um produto existente em menos de 1 minuto, pelo
  celular ou pelo tablet.
- **SC-002** 100% dos cenários da US6 passam em 100% das larguras da matriz, nos modos claro e
  escuro, nos dois motores de navegador.
- **SC-003** Zero falhas graves de acessibilidade no cardápio do cliente e na tela Cardápio, em
  todas as larguras.
- **SC-004** Com 40 produtos com foto, a primeira tela do cardápio aparece em até 2 segundos numa
  conexão de celular 4G lenta simulada, e o primeiro carregamento baixa no máximo 1 MB de fotos.
- **SC-005** 100% das linhas e dos desvios do código novo cobertos por teste; nenhum teste pulado.
- **SC-006** Todos os testes existentes (009, 010, 011, 012) continuam verdes sem mudar o que
  verificam.
- **SC-007** Uma mudança feita na tela Cardápio aparece no cardápio de um cliente já aberto em até
  10 segundos.

## Premissas

- **Quem edita**: gerente e chef, como o dono pediu ("gerente/chefe"). O papel no sistema é "Chef".
- **Sem publicação em lote**: cada mudança vale na hora; a pré-visualização serve para conferir
  antes de deixar as mesas lerem o QR code. Rascunho do cardápio inteiro fica fora (ver Decisões).
- **Produto novo continua com ingredientes**: "adicionar produto" pela tela Cardápio usa o cadastro
  da 003, que exige pelo menos um item, para a baixa do estoque (011) continuar certa.
- **Uma foto por produto**. Várias fotos (galeria) ficam fora.
- **Fotos guardadas num serviço de arquivos** próprio para imagens, escolhido no plano; o banco
  guarda só a referência. As fotos não passam pela versão do produto: trocar a foto não cria versão.
- O cardápio do cliente continua se atualizando a cada 10 segundos (009); não há tempo real.
- A matriz de telas cobre os tamanhos mais comuns em 2026; aparelhos fora dela que mostrarem
  problema entram na matriz (TDD-010).

## Fora do escopo

Várias fotos por produto, vídeo, edição da foto dentro do sistema (cortar, filtros), alérgenos e
informação nutricional (fora do produto por decisão do dono, constituição), cardápios diferentes
por horário ou dia, tradução do cardápio, imprimir o cardápio, destaque pago ou promoções, rascunho
e publicação do cardápio inteiro, fechamento do caixa do dia (feature seguinte).

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-13 | Número da feature | 013. O fechamento do caixa do dia, pedido em 12/11 e ainda não começado, passa a ser a 014 |
| 2026-11-13 | Quem edita o cardápio? | Gerente e chef (pedido do dono) |
| 2026-11-13 | Publicar na hora ou rascunho? | Na hora, com pré-visualização (premissa; o dono pode pedir rascunho depois) |
| 2026-11-13 | Produto novo sem ingredientes? | Não: continua exigindo pelo menos um item (regra da 003), para o estoque baixar certo |
| 2026-11-13 | Como provar que o cardápio fica certo em cada aparelho? | Matriz de 9 tamanhos, testes de layout, comparação visual e acessibilidade em cada um (TDD-003 a TDD-005) |
