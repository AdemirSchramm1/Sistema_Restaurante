# 8. Lançar pedido (garçom)

O garçom, o caixa e o gerente lançam pedidos para a mesa pelo celular ou tablet, com o próprio
login, quando o cliente não usa o QR code. O pedido vai para a mesma cozinha e para a mesma conta
da mesa, e o sistema guarda quem lançou. Spec [015](../../../specs/015-pedido-pelo-garcom/spec.md).

## Quem pode

| O que | Quem |
|---|---|
| Lançar pedido, ver Pedidos da mesa, Pedir de novo | Gerente, caixa, garçom (`order.place`) |
| Cancelar o próprio pedido ainda em Recebido | Gerente, caixa, garçom (`order.cancel_own`) |
| Cancelar qualquer pedido, em qualquer etapa | Gerente, chef (`order.cancel`, [capítulo 3](03-cozinha-e-garcom.md)) |

O chef não lança pedido. Quem abre `/pedidos/lancar` sem a permissão vê "Sem acesso", e a tentativa
fica na auditoria.

## Escolher a mesa

O garçom entra direto em **Lançar pedido** (o caixa continua entrando no Caixa). A tela mostra as
mesas ativas com busca pelo nome:

- "Livre" ou "Ocupada · R$ 120,00 · há 35 min" (total da conta aberta, com a taxa de serviço);
- "2 prontos": pedidos da mesa esperando o garçom levar;
- "Carrinho: 3 itens": carrinho montado neste aparelho e ainda não enviado.

Com "Recebendo pedidos pelo QR code" desligado, a tela avisa "O QR code está desligado: só a equipe
lança pedidos." A equipe lança normalmente. A tela se atualiza a cada 10 segundos.

## A mesa

O topo fica fixo com "Mesa 12" e **Trocar mesa**. Duas abas: **Cardápio** e **Pedidos da mesa**.

- **Cardápio**: busca sem acento ("pure" acha "Purê"), modo **Fotos** (cartões) ou **Lista**
  (linhas com "−  2  +"); o aparelho lembra o modo. Produto esgotado hoje aparece no fim da seção,
  com a foto apagada e o selo "Esgotado hoje", sem botão.
- Tocar no nome abre a **tela do prato** do [capítulo 4](04-adicionar-e-tirar.md), com a
  **Observação para a cozinha** (até 140 letras, contador "0/140"). Só a equipe tem esse campo.
- A barra fixa no pé mostra "Carrinho · 3 itens · R$ 98,00".

## Enviar

No carrinho: **Limpar** ou **Enviar pedido**. Antes de gravar, o resumo **Conferir: Mesa 12** mostra
as linhas e o total; **Confirmar** envia. Tocar duas vezes lança um pedido só. Deu certo: "Pedido 5
enviado para a cozinha · Mesa 12 · R$ 68,00" e o carrinho esvazia.

**Pedido parecido.** Se nos últimos 5 minutos alguém lançou na mesa um produto que está no carrinho,
o resumo avisa ("Maria lançou 2 Chope nesta mesa há 1 min." ou "Pelo QR code pediram 1 Suco nesta
mesa agora há pouco.") e o botão vira **Lançar mesmo assim**.

**Recusas.** O carrinho continua e pode mudar: preço mudou (o carrinho atualiza e mostra o novo),
produto esgotou ou saiu do cardápio (sai do carrinho com o aviso), mesa inativada ("A Mesa 7 foi
inativada. Fale com o gerente."), sessão vencida ("Sua sessão venceu. Entre de novo: o carrinho
continua aqui.").

**Sem rede.** Antes de enviar: "Sem conexão. O pedido não foi enviado." Se a rede cai depois de
**Confirmar** e a resposta não volta, o sistema não sabe se o pedido chegou: o carrinho trava
("Não deu para saber se o pedido chegou. Toque em Enviar de novo: ele não é lançado duas vezes."),
com **Enviar de novo** e **Ver Pedidos da mesa**. O mesmo envio nunca vira dois pedidos.

**Conta fechada no meio.** Se o caixa fechou a conta da mesa enquanto o garçom montava o carrinho, o
pedido abre uma conta nova e avisa: "A conta anterior desta mesa foi fechada. Este pedido abriu uma
conta nova."

## O carrinho fica no aparelho

O carrinho de cada mesa fica guardado no aparelho, por restaurante, pessoa e mesa, por até 12
horas. Trocar de mesa, girar a tela ou a sessão vencer não perde nada. Some ao enviar, ao **Limpar**
e ao tocar **Sair**. Quando outro garçom entra no mesmo aparelho, os carrinhos do anterior são
apagados. Em aba anônima ou com o armazenamento bloqueado, a tela funciona, só não lembra.

## Pedidos da mesa

Os pedidos da conta aberta, de todas as origens, do mais novo para o mais velho: número, hora, quem
lançou ("João" ou "QR code"), situação, linhas com as mudanças e a observação. O topo mostra o total
da conta e **Ver conta** (a conta da [capítulo 5](05-conta-da-mesa.md), sem receber).

- **Pedir de novo** por linha ou pelo pedido inteiro: põe no carrinho com as mesmas escolhas e o
  preço de hoje. Fica de fora, com aviso, o que esgotou ("X-Burger está esgotado hoje e não
  entrou."), saiu do cardápio ou mudou desde o pedido.
- **Entregue** quando o pedido está Pronto.
- **Cancelar** o próprio pedido ainda em Recebido, com o motivo (o primeiro é "Lançado errado";
  "Outro" pede o texto). Depois que a cozinha começou: "A cozinha já começou. Peça ao chef ou ao
  gerente para cancelar."

## Quem lançou, nas outras telas

- **Cozinha**: "João" ou "QR code" embaixo da mesa, e a observação em destaque na linha.
- **Garçom**: quem lançou em cada pronto e o filtro **Só os meus**.
- **Pedidos**: filtro e coluna **Lançado por**, e o resumo "Por quem lançou" com pedidos, total e
  cancelados por motivo.
- **Pedido**: "lançado por João em 17/11/26 20:14" e a observação nas linhas.
- **Conta da mesa**: quem lançou cada pedido; o histórico mostra quem abriu a conta; **Voltar à
  Mesa 12** para quem lança pedido.

Pedido da equipe não tem o limite de 20 minutos nem o de 10 pedidos do QR code, e não depende da
chave do QR code.
