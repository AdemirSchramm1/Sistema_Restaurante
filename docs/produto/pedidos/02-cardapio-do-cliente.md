# 2. Cardápio do cliente

Aberto pelo QR code da mesa, sem login, ou pelo tablet fixo na mesa
([09 — Tablet da mesa](09-tablet-da-mesa.md)). Spec [009, US2 e US3](../../../specs/009-pedidos-qr-mesa/spec.md)
e [016](../../../specs/016-cardapio-tablet-mesa/spec.md).

## O que aparece

- **Topo com a cara do restaurante** (016): a foto de capa com uma camada escura, o logo, o nome e
  "Mesa N" em branco embaixo. 120 px de altura no celular e 160 px do tablet em diante; ao rolar ele
  sai e fica só a barra de seções. Sem capa, a cor principal; sem logo, só o nome. O gerente põe o
  logo e a capa na tela Cardápio ([06](06-editar-o-cardapio.md#aparência)).
- Produtos vendidos, ativos, com preço de venda e não **esgotados hoje**, **por seção e na ordem que
  o gerente ou o chef escolheu** ([06 — Editar o cardápio](06-editar-o-cardapio.md)), com busca por
  nome. Preparos e produtos sem preço não aparecem. Seção sem produto não aparece; "Outros" (produto
  sem seção) vem no fim; sem nenhuma seção, não há títulos.
- Uma **barra de seções** presa no topo leva a cada seção. Com muitas seções, ela rola para o lado
  só dentro dela.
- Cada produto é um **cartão** com a foto (se houver, sempre em 4:3), o nome em até 2 linhas, a
  descrição e o preço. No celular o cartão é uma linha (foto pequena ao lado); do tablet em diante,
  um cartão com a foto em cima. Produto sem foto não deixa espaço vazio.
- **"+" direto** (016): o botão "+" do cartão põe o prato no carrinho sem abrir a tela do prato.
  Prato com adicionais ou retiradas abre a tela do prato, para escolher.
- Tocar na foto ou no nome abre a **tela do prato**, com a foto maior e a descrição inteira, com as
  quebras de linha.
- Na tela do prato, só botões: adicionais com preço ("+ Fatia de queijo R$ 3,00", "Grátis") e
  retiradas ("Sem cebola"). Não há campo de texto: "Precisa de outra mudança? Chame um garçom."
  ([04 — Adicionar e tirar](04-adicionar-e-tirar.md)).
- **Carrinho sempre à vista** (016): a partir de 1024 px ele fica numa coluna ao lado, com o total e
  **Enviar pedido** sem rolar. Abaixo disso, uma barra no pé ("Ver pedido · 2 itens · R$ 18,00")
  abre o carrinho por cima do cardápio. A linha que mudou pisca por um instante e o leitor de tela
  ouve "Suco no carrinho. Total R$ 9,00".
- **Meus pedidos**: os pedidos enviados deste celular, com a situação de cada um (Recebido, Em
  preparo, Pronto, Entregue, Cancelado). Atualiza sozinho a cada 10 segundos.

## Em qualquer tela

O cardápio tem de ficar certo do celular pequeno ao tablet deitado (spec 013, US6):

- Linhas no celular (até 599 px); 3 cartões por linha de 600 px em diante (tablet em pé e celular
  deitado grande), ao lado do carrinho de 1024 px em diante, e 4 de 1280 px em diante (016).
- Nada rola para o lado, nenhum texto é cortado e todo botão tem pelo menos 44 px de toque.
- Com a letra do aparelho em 200%, tudo continua legível e sem sobreposição.
- Girar o aparelho não perde o carrinho nem o lugar da leitura.
- As fotos carregam só quando chegam perto da tela, no menor tamanho que serve ao aparelho.
- Modo claro e modo escuro.

A tela **Lançar pedido** da equipe (spec 015) usa o mesmo cardápio, com os modos Fotos e Lista,
os esgotados no fim e o campo de observação para a cozinha, que o cliente não tem.

Cada item dessa lista é um teste automático que roda em 9 tamanhos de tela, nos dois modos de cor e
em dois motores de navegador ([testes de tela](../../sistema/05-testes-de-tela.md)).

## Acesso de 20 minutos

Vale para o celular pelo QR code. O tablet da mesa não tem prazo nem limite de pedidos
([09](09-tablet-da-mesa.md)).

- Cada leitura do QR code abre um acesso ao cardápio que fecha **20 minutos depois da leitura**.
  Usar o cardápio não aumenta o tempo. Decisão do dono: evitar cardápios abertos para sempre em
  celulares que já saíram do restaurante.
- A tela mostra "Faltam N min". Faltando 2 minutos, com algo no carrinho: "Faltam 2 minutos. Envie
  o pedido para não perder o que escolheu."
- Acabou o tempo: "Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar.", com a
  lista do que não foi enviado. Escanear de novo abre outro acesso de 20 minutos; os pedidos já
  enviados continuam na cozinha.
- Quem conta o tempo é o servidor. O envio vale até 15 segundos depois do fim (rede lenta).
- Nova leitura no mesmo celular encerra o acesso anterior.
- Até 10 pedidos por acesso; depois: "Chame um garçom para continuar pedindo."

## Enviar o pedido

1. O cliente põe os produtos no carrinho (até 30 linhas, até 20 de cada).
2. **Enviar pedido** mostra o resumo, com o total.
3. **Confirmar** envia. A resposta é "Pedido enviado para a cozinha", com o número do pedido e o
   total.

Regras do envio:

- **Sem pedido em dobro**: toque duplo ou reenvio depois de uma queda de rede devolvem o mesmo
  pedido.
- **Preço que mudou**: se o preço de um produto ou adicional mudou desde que o cardápio abriu, o
  pedido não é enviado. O resumo mostra "O preço de Fatia de queijo mudou para R$ 3,50." com o total
  novo, e o cliente confirma de novo.
- **Produto que saiu**: esgotado, inativado ou sem preço no meio do caminho é tirado do carrinho
  com aviso ("X-Burger não está mais disponível").
- O preço fica gravado no pedido: mudar o preço depois não muda pedido enviado.

## Número do pedido

Sequencial por restaurante e por dia (no fuso do restaurante), começando em 1, para a cozinha e o
garçom chamarem.

## Privacidade e segurança

- Nenhum dado pessoal do cliente. O pedido guarda a mesa e o acesso de origem.
- O cardápio só mostra dados do restaurante dono da mesa; o restaurante nunca vem do celular.
