# 2. Cardápio do cliente

Aberto pelo QR code da mesa, sem login. Spec [009, US2 e US3](../../../specs/009-pedidos-qr-mesa/spec.md).

## O que aparece

- Nome do restaurante e "Mesa N".
- Produtos vendidos, ativos, com preço de venda e não **esgotados hoje**, **por seção e na ordem que
  o gerente ou o chef escolheu** ([06 — Editar o cardápio](06-editar-o-cardapio.md)), com busca por
  nome. Preparos e produtos sem preço não aparecem. Seção sem produto não aparece; "Outros" (produto
  sem seção) vem no fim; sem nenhuma seção, não há títulos.
- Uma **barra de seções** presa no topo leva a cada seção. Com muitas seções, ela rola para o lado
  só dentro dela.
- Cada produto é um **cartão** com a foto (se houver, sempre em 4:3), o nome inteiro, a descrição em
  até 3 linhas e o preço. Produto sem foto não deixa espaço vazio.
- Tocar na foto ou no nome abre a **tela do prato**, com a foto maior e a descrição inteira, com as
  quebras de linha.
- Na tela do prato, só botões: adicionais com preço ("+ Fatia de queijo R$ 3,00", "Grátis") e
  retiradas ("Sem cebola"). Não há campo de texto: "Precisa de outra mudança? Chame um garçom."
  ([04 — Adicionar e tirar](04-adicionar-e-tirar.md)).
- **Meus pedidos**: os pedidos enviados deste celular, com a situação de cada um (Recebido, Em
  preparo, Pronto, Entregue, Cancelado). Atualiza sozinho a cada 10 segundos.

## Em qualquer tela

O cardápio tem de ficar certo do celular pequeno ao tablet deitado (spec 013, US6):

- 1 coluna de cartões no celular, 2 no celular deitado e no tablet em pé, 3 no tablet deitado e no
  computador.
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
