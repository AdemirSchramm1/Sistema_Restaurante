# 9. Tablet da mesa

Um tablet fica fixo na mesa com o cardápio aberto, sem prazo, para o cliente pedir sem escanear
nada. Spec [016, US4 e US5](../../../specs/016-cardapio-tablet-mesa/spec.md).

## Ligar

1. Na tela **Mesas**, no cartão da mesa, quadro **Tablet da mesa**: **Criar link do tablet** (só o
   gerente, `table.manage`).
2. Abrir o link no tablet: copiar e colar, ou apontar a câmera do tablet para o QR code do link, que
   aparece no próprio quadro.
3. O primeiro aparelho que abre o link vira **o tablet daquela mesa** e vai para as boas-vindas.

Outro aparelho com o mesmo link vê "Este link já está ligado em outro tablet. Peça ao gerente para
liberar." e não vê o cardápio. Mesa inativa e chave "Recebendo pedidos" desligada não impedem ligar:
o tablet mostra a mensagem da mesa até ela voltar.

O tablet guarda um cookie de 400 dias (o máximo que os navegadores guardam). Recarregar a página ou
reiniciar o tablet volta às boas-vindas da mesma mesa, sem o gerente.

## Liberar e trocar o link

| Ação | Quando | O que acontece |
|---|---|---|
| **Liberar** | Trocar de tablet, tablet quebrado | Pede confirmação. O tablet ligado mostra "Este tablet foi desligado. Peça ao gerente." em até 10 segundos; o mesmo link aceita o próximo aparelho |
| **Trocar link** | O link vazou | Pede confirmação. O tablet ligado desliga e o link antigo passa a mostrar "Link inválido. Chame um garçom."; o link novo aparece na hora |

Criar, ligar, liberar e trocar vão para a trilha de auditoria com quem e quando. O código do link
**nunca** aparece no histórico.

## Situação na tela Mesas

- No topo: "4 mesas com tablet ligado".
- Por mesa: "Nenhum tablet ligado" ou "Tablet ligado desde 16/11 20:05 · visto há 2 min".
- Sem notícia do tablet há mais de 10 minutos: "Sem sinal há 25 min", em destaque (tablet
  desligado, sem bateria ou sem internet).

## O que muda para o cliente

- **Sem prazo e sem limite de pedidos**: não há "Faltam N min" nem o aviso dos 10 pedidos. A chave
  "Recebendo pedidos" e a mesa inativa continuam valendo.
- **Boas-vindas**: a capa e o logo em tela cheia, "Mesa 12" e o botão grande **Ver o cardápio**.
- **Parado**: sem toque por 3 minutos com o carrinho vazio, volta às boas-vindas. Com algo no
  carrinho, "Ainda está aí? Seu pedido não foi enviado." com **Continuar**; sem resposta em 30
  segundos, limpa o carrinho e volta às boas-vindas.
- **Depois de enviar**: "Pedido enviado para a cozinha" por 10 segundos e volta ao cardápio com o
  carrinho vazio.
- **Pedidos enviados**: os pedidos da **conta aberta** da mesa, de qualquer origem (tablet, QR code
  ou garçom). Quando o caixa fecha a conta, o tablet volta às boas-vindas em até 10 segundos sem
  nada da conta fechada; o próximo pedido abre uma conta nova.
- **Sem internet**: "Sem conexão com o restaurante. Chame um garçom." por cima do cardápio, sem
  limpar o carrinho; volta sozinho quando a conexão volta. O pedido não fica guardado para depois.
- **Tela sempre acesa** onde o navegador permite, e o botão **Tela cheia** quando o navegador deixa.
- A cozinha, o garçom, a conta e a consulta mostram "Mesa 12 · tablet"; o filtro "Lançado por" da
  consulta tem "Tablet da mesa".

## Travar o aparelho

Uma página não consegue impedir o cliente de sair do navegador. A ajuda **Como travar o tablet**,
no próprio quadro, explica:

- Abrir o link no navegador do tablet, não pela Tela de Início.
- Android: "Fixar app" nas configurações de segurança, e fixar o navegador.
- iPad: "Acesso Guiado" em Acessibilidade, iniciado com três toques no botão lateral.
- "Bloqueio automático: Nunca" e o tablet na tomada.

## Pré-visualização

Em **Ver como o cliente** ([06](06-editar-o-cardapio.md#ver-como-o-cliente)), a escolha **Tablet da
mesa** mostra as boas-vindas e o cardápio sem prazo, sem enviar nada.
