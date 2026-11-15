# Quickstart: validar a 015

Roteiro para conferir a feature de ponta a ponta. Ambiente como na
[011](../011-fechamento-conta-mesa/quickstart.md) (`pnpm dev`, banco local com `pnpm db:up`, seed
com um restaurante). Em sessão na nuvem, ligar o Docker antes do `pnpm db:up`.

## Preparação

1. Produtos: X-Burger a R$ 30,00 com o adicional "Fatia de queijo" a R$ 2,00 (até 3) e a retirada
   "Sem cebola"; Purê a R$ 12,00; Suco a R$ 9,00. Seções Lanches e Bebidas.
2. Mesas 4 e 12 ativas; mesa 7 ativa (vai ser inativada no passo 11).
3. Usuários: gerente, garçom João, garçom Maria, caixa Ana e chef.
4. Taxa de serviço desligada, para os números redondos.

## Roteiro

| # | Passo | Esperado |
|---|---|---|
| 1 | João entra | Cai em **Lançar pedido**; grade com Mesa 4, Mesa 7 e Mesa 12, todas "Livre" |
| 2 | Chef marca Purê "Esgotado hoje"; João abre a Mesa 12 | Cardápio com "Mesa 12" no topo; Purê no fim de Lanches, apagado, "Esgotado hoje", sem "+" |
| 3 | João: modo **Lista**, busca "burg" | Só o X-Burger; "+" em cada linha |
| 4 | Toca no nome X-Burger: + 2 Fatia de queijo, sem cebola, observação "mal passado", quantidade 2 | Linha R$ 68,00 no carrinho |
| 5 | **Trocar mesa** → grade | Mesa 12 com "Carrinho: 1 item"; volta à Mesa 12 e o carrinho está lá |
| 6 | **Enviar pedido** | "Conferir: Mesa 12", total R$ 68,00 |
| 7 | **Confirmar** com toque duplo | Um só "Pedido 1 enviado para a cozinha · Mesa 12 · R$ 68,00"; carrinho vazio |
| 8 | Chef: Cozinha | Pedido 1, Mesa 12, "João" embaixo; linha "2 X-Burger + 2 Fatia de queijo, SEM cebola" e "mal passado" em destaque |
| 9 | Ana: Caixa → conta da Mesa 12 | R$ 68,00; pedido 1 "Lançado por João"; histórico "Conta aberta por João (pedido 1)" |
| 10 | Cliente lê o QR da Mesa 12 e pede 1 Suco | Entra na mesma conta (R$ 77,00); o celular não tem campo de observação |
| 11 | Gerente inativa a Mesa 7 com o carrinho de João montado nela; João envia | "A Mesa 7 foi inativada. Fale com o gerente."; carrinho continua |
| 12 | Gerente desliga "Recebendo pedidos pelo QR code"; João abre a grade | Aviso "O QR code está desligado: só a equipe lança pedidos."; João lança 1 Suco na Mesa 4 normalmente |
| 13 | João: Mesa 4 → Pedidos da mesa → pedido 3 → **Cancelar** → "Lançado errado" | Pedido riscado; sai de Recebidos na cozinha |
| 14 | Maria abre a Mesa 12 → Pedidos da mesa | Vê os pedidos 1 (João) e 2 (QR code), sem **Cancelar** em nenhum |
| 15 | Chef: Começar preparo no pedido 1; João abre Pedidos da mesa | Pedido 1 sem **Cancelar**; texto "A cozinha já começou. Peça ao chef ou ao gerente para cancelar." |
| 16 | Chef: Pronto no pedido 1; João: Garçom → **Só os meus** | Só o pedido 1; toca **Entregue** |
| 17 | Ana fecha a conta da Mesa 12 enquanto João monta outro X-Burger nela; João envia | Pedido aceito, "A conta anterior desta mesa foi fechada. Este pedido abriu uma conta nova." |
| 18 | Gerente: Pedidos → hoje, "Lançado por: João" | Só os pedidos de João; resumo "QR code: 1 pedido, R$ 9,00 · João: N pedidos, R$ …, 1 cancelado (Lançado errado)"; a soma bate com o total do dia |
| 19 | João toca **Sair** com um carrinho montado; Maria entra no mesmo aparelho | Grade sem "Carrinho" em nenhuma mesa |
| 20 | Chef abre `/pedidos/lancar` pelo endereço | "Sem acesso" e a tentativa na auditoria |
| 21 | João: Mesa 12 → Pedidos da mesa → **Pedir de novo** no pedido 1 | Carrinho com 2 X-Burger + 2 Fatia de queijo, sem cebola, "mal passado", preço de hoje |
| 22 | Chef marca X-Burger "Esgotado hoje"; João toca **Pedir de novo** no pedido 1 | Nada entra; "X-Burger está esgotado hoje e não entrou." (chef desmarca depois) |
| 23 | Maria lança 1 Suco na Mesa 12; João põe 1 Suco no carrinho e toca **Enviar pedido** | Aviso "Maria lançou 1 Suco nesta mesa há 0 min."; botão **Lançar mesmo assim** |
| 24 | João corta a rede do celular depois de tocar **Confirmar** (o pedido chega ao servidor) | "Não deu para saber se o pedido chegou."; "+", "−" e **Limpar** desligados |
| 25 | Rede volta; **Enviar de novo** | O mesmo número de pedido, um só na cozinha; carrinho vazio |
| 26 | Sessão de João vence com carrinho na Mesa 4; João entra de novo | Grade com "Carrinho: N itens" na Mesa 4 |
| 27 | João: Mesa 12 → Pedidos da mesa → **Ver conta** | Conta da 011 com a impressão; sem **Lançar pagamento** |

## Testes automatizados

- Unidade: `pnpm test src/domain/ordering src/domain/menu src/domain/access src/components/staff-ordering src/components/ordering`.
- Integração (PostgreSQL em container):
  `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test:integration tests/integration/ordering`.
- Índices: `pnpm test:integration tests/integration/performance/indexes.test.ts`.
- Telas: `pnpm test:screens tests/screens/staff-ordering.spec.ts`.
- Ponta a ponta: `pnpm test:e2e tests/e2e/staff-ordering.spec.ts --trace off`.
