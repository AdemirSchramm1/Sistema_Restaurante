# 2. Cardápio do cliente

Aberto pelo QR code da mesa, sem login. Spec [009, US2 e US3](../../../specs/009-pedidos-qr-mesa/spec.md).

## O que aparece

- Nome do restaurante e "Mesa N".
- Produtos vendidos, ativos, com preço de venda e não **esgotados hoje**, em ordem alfabética,
  com busca por nome. Preparos e produtos sem preço não aparecem.
- Na tela do prato, só botões: adicionais com preço ("+ Fatia de queijo R$ 3,00", "Grátis") e
  retiradas ("Sem cebola"). Não há campo de texto: "Precisa de outra mudança? Chame um garçom."
  ([04 — Adicionar e tirar](04-adicionar-e-tirar.md)).
- **Meus pedidos**: os pedidos enviados deste celular, com a situação de cada um (Recebido, Em
  preparo, Pronto, Entregue, Cancelado). Atualiza sozinho a cada 10 segundos.

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
