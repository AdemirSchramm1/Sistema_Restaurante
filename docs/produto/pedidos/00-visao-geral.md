# Pedidos — Visão geral

O cliente pede pelo celular, sem login, escaneando o QR code da mesa. O pedido cai na tela da
cozinha; quando fica pronto, aparece na tela do garçom, que leva até a mesa. Os pedidos da mesa
formam a conta, que o caixa recebe e fecha, liberando a mesa. Specs:
[009 — Pedidos pelo QR code da mesa](../../../specs/009-pedidos-qr-mesa/spec.md),
[010 — Adicionar e tirar por botão](../../../specs/010-adicionais-retiradas/spec.md) e
[011 — Fechar a conta da mesa e baixar o estoque](../../../specs/011-fechamento-conta-mesa/spec.md).

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
| [02 — Cardápio do cliente](02-cardapio-do-cliente.md) | O que aparece, acesso de 20 minutos, envio, preço que mudou |
| [03 — Cozinha e garçom](03-cozinha-e-garcom.md) | Situações do pedido, cancelamento, esgotado hoje, consulta |
| [04 — Adicionar e tirar](04-adicionar-e-tirar.md) | Adicionais com preço, retiradas por produto, consumo |
| [05 — Conta da mesa e caixa](05-conta-da-mesa.md) | Conta da mesa, taxa de serviço, pagamento, divisão, fechar, imprimir, contas fechadas, reabrir |

Telas da equipe, no menu: **Cozinha**, **Garçom**, **Caixa**, **Contas**, **Pedidos**, **Mesas** e
**Adicionais** (cada uma só para quem tem a permissão; ver
[09-controles-e-permissoes](../estoque/09-controles-e-permissoes.md#pedidos-features-009-e-010)).
O papel **Garçom** vê "Garçom", "Caixa" (só para ler a conta e levar o total à mesa) e "Pedidos" e
entra direto na tela do garçom. O papel **Caixa** (011) vê só "Caixa", "Contas" e "Pedidos" e entra
direto no Caixa.

Ligação com o estoque: cada linha do pedido guarda a versão do produto no envio e o que foi
adicionado e tirado. Quando a cozinha toca **Começar preparo**, o estoque baixa sozinho o consumo do
pedido (feature 005, entregue na 011; ver
[06-movimentacoes](../estoque/06-movimentacoes.md#venda-pelo-pedido-feature-011)).
