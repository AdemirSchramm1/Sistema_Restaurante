# Pedidos — Visão geral

O cliente pede pelo celular, sem login, escaneando o QR code da mesa. O pedido cai na tela da
cozinha; quando fica pronto, aparece na tela do garçom, que leva até a mesa. Os pedidos da mesa
formam a conta, que o caixa recebe e fecha, liberando a mesa. Specs:
[009 — Pedidos pelo QR code da mesa](../../../specs/009-pedidos-qr-mesa/spec.md),
[010 — Adicionar e tirar por botão](../../../specs/010-adicionais-retiradas/spec.md) e
[011 — Fechar a conta da mesa e baixar o estoque](../../../specs/011-fechamento-conta-mesa/spec.md) e
[013 — Editar o cardápio](../../../specs/013-editar-cardapio/spec.md),
[014 — Caixa do dia](../../../specs/014-fechamento-caixa/spec.md) e
[015 — Pedido pelo garçom](../../../specs/015-pedido-pelo-garcom/spec.md) e
[016 — Cardápio com a cara do restaurante e tablet fixo na mesa](../../../specs/016-cardapio-tablet-mesa/spec.md).
Quem não usa o QR code pede ao garçom, que lança pelo celular com o próprio login, ou pelo tablet
fixo na mesa, que fica com o cardápio aberto sem prazo.

```text
Gerente cria as mesas ──► imprime os QR codes ──► cliente escaneia
        │                                             │
        │                                  cardápio por 20 minutos
        │                                             │
        └── adicionais e retiradas ──► cliente monta e envia ──► Cozinha ──► Garçom ──► mesa
                                                 │                  │                     │
                                        conta da mesa abre    estoque baixa         Caixa recebe,
                                           no 1º pedido     (Começar preparo)      fecha e libera
```

| Documento | Assunto |
|---|---|
| [01 — Mesas e QR codes](01-mesas-e-qr-code.md) | Cadastro, impressão, troca do QR code, chave "Recebendo pedidos" |
| [02 — Cardápio do cliente](02-cardapio-do-cliente.md) | O que aparece (seções, fotos, descrições), acesso de 20 minutos, envio, preço que mudou |
| [03 — Cozinha e garçom](03-cozinha-e-garcom.md) | Situações do pedido, cancelamento, esgotado hoje, consulta |
| [04 — Adicionar e tirar](04-adicionar-e-tirar.md) | Adicionais com preço, retiradas por produto, consumo |
| [05 — Conta da mesa e caixa](05-conta-da-mesa.md) | Conta da mesa, taxa de serviço, pagamento, divisão, fechar, imprimir, contas fechadas, reabrir |
| [06 — Editar o cardápio](06-editar-o-cardapio.md) | Tela Cardápio: seções, ordem, foto, descrição, preço, produto novo, Ver como o cliente |
| [07 — Caixa do dia](07-caixa-do-dia.md) | Abrir com troco, sangria e reforço, contar sem ver o esperado, fechar, Turnos e Vendas |
| [08 — Lançar pedido](08-lancar-pedido.md) | Garçom lança pela mesa: carrinho no aparelho, observação para a cozinha, Pedir de novo, cancelar o próprio, quem lançou |
| [09 — Tablet da mesa](09-tablet-da-mesa.md) | Link do tablet por mesa, ligar, liberar, trocar o link, boas-vindas, "Ainda está aí?", travar o aparelho |

Telas da equipe, no menu: **Cozinha**, **Lançar pedido** (015), **Garçom**, **Caixa**, **Contas**, **Pedidos**, **Mesas**,
**Adicionais** e **Cardápio** (013) (cada uma só para quem tem a permissão; ver
[09-controles-e-permissoes](../estoque/09-controles-e-permissoes.md#pedidos-features-009-e-010)).
O papel **Garçom** vê "Lançar pedido", "Garçom", "Caixa" (só para ler a conta e levar o total à
mesa) e "Pedidos" e entra direto em Lançar pedido. O papel **Caixa** (011) vê "Lançar pedido",
"Caixa", "Contas", "Turnos" e "Pedidos" e entra direto no Caixa.

Ligação com o estoque: cada linha do pedido guarda a versão do produto no envio e o que foi
adicionado e tirado. Quando a cozinha toca **Começar preparo**, o estoque baixa sozinho o consumo do
pedido (feature 005, entregue na 011; ver
[06-movimentacoes](../estoque/06-movimentacoes.md#venda-pelo-pedido-feature-011)).
