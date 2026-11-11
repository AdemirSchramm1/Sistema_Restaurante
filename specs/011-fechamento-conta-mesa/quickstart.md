# Quickstart: validar a 011

Roteiro para conferir a feature de ponta a ponta. Comandos e ambiente como na
[009](../009-pedidos-qr-mesa/quickstart.md) (`pnpm dev`, banco local, seed com um restaurante).

## Preparação

1. Itens com compra lançada: Pão (un, saldo 10), Carne (kg, saldo 2), Queijo (kg, saldo 1),
   Cebola (kg, saldo 0,5).
2. Produto X-Burger a R$ 28,00: pão 1 un, carne 150 g, queijo 30 g, cebola 20 g. Adicional "Fatia
   de queijo" (queijo 20 g, R$ 3,00) até 3 vezes; retirada "Sem cebola". Produto Suco a R$ 9,00.
3. Mesa 12. Usuários: gerente, chef, caixa (papel novo) e garçom.
4. Taxa de serviço do restaurante: 10% (padrão).

## Roteiro

| # | Passo | Esperado |
|---|---|---|
| 1 | Celular: QR code da mesa 12, pedir 2 × X-Burger com + 2 Fatia de queijo, sem cebola | Pedido enviado; Caixa mostra a mesa 12 com conta aberta, R$ 68,00, "1 pedido ainda não foi entregue" |
| 2 | Cozinha (chef): "Começar preparo" | Queijo: saída "Venda — pedido N, Mesa 12" de 0,14 kg, saldo 0,86 kg; Pão −2 un; Carne −0,3 kg; Cebola sem saída |
| 3 | Tocar "Começar preparo" de novo em outra aba | "Este pedido mudou em outra tela"; nenhuma saída a mais |
| 4 | Celular: pedir 1 Suco; cozinha cancela ainda Recebido (cliente desistiu) | Conta mostra o suco riscado, fora do total; nenhuma saída de estoque |
| 5 | Pronto → Entregue no pedido do X-Burger | Conta: subtotal R$ 68,00, serviço R$ 6,80, total R$ 74,80; "Fechar conta" disponível só depois de pagar |
| 6 | Caixa: "Dividir por 3" | Partes R$ 24,94 + R$ 24,93 + R$ 24,93 |
| 7 | Pagar parte 1 no crédito, parte 2 em Pix, parte 3 em dinheiro recebendo R$ 50,00 | Troco R$ 25,07; falta R$ 0,00 |
| 8 | Tentar registrar mais R$ 1,00 em Pix | "O valor passa do que falta pagar" |
| 9 | "Fechar conta" | Mesa 12 some do Caixa; o cardápio ainda aberto no celular mostra "Esta conta foi fechada…" |
| 10 | Novo pedido pela mesa 12 | Conta nova, só com esse pedido; a taxa é a configurada agora |
| 11 | Cozinha começa o preparo e cancela, "Os ingredientes já foram usados?" Sim | Estorno da venda e perda "Pedido cancelado" nos itens; saldo igual ao de antes do cancelamento |
| 12 | Repetir com "Não" | Estorno da venda; saldo volta |
| 13 | Gerente: Contas → hoje | Conta do passo 9 com total R$ 74,80, serviço R$ 6,80; resumo: crédito R$ 24,94, Pix R$ 24,93, dinheiro R$ 24,93 |
| 14 | Item com saldo 0 e um pedido que o usa | Preparo começa normalmente; o item mostra saldo negativo em destaque e aparece em Repor |
| 15 | Entrar como caixa | Menu só com Caixa, Contas e Pedidos |

## Testes automatizados

- Unidade: `pnpm test src/domain/billing src/domain/inventory/movement`.
- Integração (PostgreSQL em container): `pnpm test:integration tests/integration/billing`.
- Ponta a ponta: `pnpm test:e2e tests/e2e/billing.spec.ts --trace off`.
