# 1. Mesas e QR codes

Tela **Pedidos → Mesas** (só gerente). Spec [009, US1](../../../specs/009-pedidos-qr-mesa/spec.md).

## Mesas

- Nome curto, de 1 a 30 letras: "12", "Varanda 3". Não repete entre as mesas ativas (sem
  diferenciar maiúsculas e acentos): "Já existe uma mesa com esse nome."
- **Criar várias mesas** de um número a outro (1 a 999, até 200 de uma vez). Cria as que faltam e
  diz quais já existiam: "10 mesas criadas", "Já existiam: 5".
- Mesa não é apagada: é **inativada**. Mesa inativa some da lista de QR codes e quem escaneia vê
  "Esta mesa não está recebendo pedidos. Chame um garçom." Pode ser reativada.
- Renomear não muda o QR code.

## QR code

- Cada mesa tem um link próprio, `/m/{código}`, com um código aleatório que não dá para adivinhar a
  partir de outra mesa.
- O cartão da mesa mostra o desenho, o nome do restaurante e "Mesa N", e tem:
  - **Abrir o cardápio**: abre o link no computador, para testar sem celular.
  - **Baixar imagem** (SVG).
  - **Imprimir este QR code** e, no topo, **Imprimir todos** (folha com todas as mesas ativas).
  - **Trocar QR code**: pede confirmação ("O QR code impresso nesta mesa vai parar de
    funcionar"). O link antigo para na hora e mostra "QR code inválido. Chame um garçom." Use
    quando um QR code for copiado ou fotografado para fora do restaurante.

## Recebendo pedidos pelo QR code

Chave do restaurante, no topo da tela de Mesas. Desligada, quem escaneia vê "O restaurante não
está recebendo pedidos agora. Chame um garçom." e nenhum envio é aceito. Pedidos já enviados
continuam na cozinha. Ligar e desligar vai para a trilha de auditoria.

## Auditoria

Criar, renomear, inativar, reativar mesa, trocar QR code e mudar a chave ficam no histórico com
quem e quando. O código do QR code não aparece no histórico (só a hora da troca).
