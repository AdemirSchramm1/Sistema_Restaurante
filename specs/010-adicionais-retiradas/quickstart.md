# Quickstart: validar a 010 — Adicionar e tirar ingredientes por botão

Roda junto com o [quickstart da 009](../009-pedidos-qr-mesa/quickstart.md) (mesmos
pré-requisitos e mesmos comandos de teste).

## Dados de partida

- Itens: Pão (un), Carne (kg), Queijo mussarela (kg), Cebola (kg), Bacon (kg).
- Produto vendido X-Burger, R$ 28,00: pão 1 un, carne 150 g, queijo 30 g, cebola 20 g.
- Mesa 5 com QR code; usuários gerente, chef e garçom.

## Roteiro manual

| # | Passo | Esperado |
|---|---|---|
| 1 | Gerente: Pedidos → Adicionais → novo "Fatia de queijo", Queijo mussarela 20 g, R$ 3,00 | Salvo; mostra custo em ingredientes e % do preço |
| 2 | Novo "Bacon", Bacon 30 g, R$ 5,00; novo "Cebola extra", Cebola 20 g, preço 0 | "Cebola extra" aparece como "Grátis" |
| 3 | Chef abre Adicionais e tenta editar o preço | Vê a lista; não há botão de editar (`addon.write` só gerente) |
| 4 | Gerente: X-Burger → "Adicionar e tirar": Fatia de queijo até 3, Bacon até 1; tirar Cebola | Salvo; histórico do produto mostra a mudança; versão do produto não muda |
| 5 | Celular: escanear mesa 5 → X-Burger | Botões "+ Fatia de queijo R$ 3,00", "+ Bacon R$ 5,00", "Sem cebola"; nenhum campo de texto |
| 6 | Tocar + duas vezes no queijo e "Sem cebola"; quantidade 2 | Linha "2 × X-Burger · + 2 Fatia de queijo · Sem cebola — R$ 68,00" |
| 7 | Tentar + uma quarta vez no queijo | Botão + indisponível |
| 8 | Enviar | Cozinha mostra "+ 2 Fatia de queijo" e "SEM cebola" embaixo do X-Burger |
| 9 | Gerente muda Fatia de queijo para R$ 3,50 com o mesmo pedido montado em outro celular; enviar | "O preço de Fatia de queijo mudou para R$ 3,50"; nova confirmação com R$ 70,00 |
| 10 | Pedido do passo 8 continua com R$ 68,00 | Pedido antigo não muda |
| 11 | Gerente cria versão nova do X-Burger sem cebola | Quadro avisa "Cebola saiu do produto…"; "Sem cebola" some do cardápio |
| 12 | Gerente inativa "Bacon" | Some do cardápio do X-Burger; pedidos antigos com bacon seguem iguais |

## Teste de consumo (domínio)

`lineConsumption` do pedido do passo 8 (2 × X-Burger, + 2 Fatia de queijo, sem cebola) devolve:
pão 2 un, carne 0,3 kg, queijo 0,14 kg (2 × (30 g + 2 × 20 g)), nenhuma cebola.

## Conferência no banco

- `order_line_addons` e `order_line_removals` recusam `UPDATE` e `DELETE`.
- `order_lines.unit_price = base_price + Σ(order_line_addons.unit_price × times)` em todo pedido.
- `order_lines` não tem mais `note`.
