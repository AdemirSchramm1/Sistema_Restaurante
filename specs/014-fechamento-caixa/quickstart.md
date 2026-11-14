# Quickstart: validar a 014

Roteiro para conferir a feature de ponta a ponta. Ambiente como na
[011](../011-fechamento-conta-mesa/quickstart.md) (`pnpm dev`, banco local com `pnpm db:up`, seed
com um restaurante). Em sessão na nuvem, ligar o Docker antes do `pnpm db:up`.

## Preparação

1. Produtos: X-Burger a R$ 30,00 com o adicional "Fatia de queijo" a R$ 2,00; Suco a R$ 9,00.
2. Mesas 4 e 12. Usuários: gerente, caixa (Ana), outro caixa (Bruno) e chef.
3. Taxa de serviço desligada, para os números redondos.

## Roteiro

| # | Passo | Esperado |
|---|---|---|
| 1 | Ana: Caixa, antes de abrir | "Caixa fechado" e **Abrir caixa**; em qualquer conta, "Lançar pagamento" desligado com "Abra o caixa antes de receber." |
| 2 | Ana: Abrir caixa com R$ 150,00 | "Caixa aberto desde HH:MM · Ana"; Sangria, Reforço e Fechar caixa aparecem |
| 3 | Bruno, em outra aba, tenta abrir o caixa | "O caixa já foi aberto por Ana às HH:MM." |
| 4 | Mesa 12: 2 X-Burger (um com + 2 Fatia de queijo) e 1 Suco → R$ 73,00; entregar | Conta R$ 73,00 |
| 5 | Ana: R$ 73,00 em dinheiro, recebido R$ 100,00 | Troco R$ 27,00 |
| 6 | Mesa 4: 1 X-Burger, R$ 30,00, entregue; pagar em Pix e fechar a conta | Mesa 4 livre |
| 7 | Ana: Sangria R$ 150,00, motivo Cofre | Comprovante para imprimir |
| 8 | Ana: Sangria R$ 100,00 | "A gaveta deve ter R$ 73,00. A sangria não pode passar disso." |
| 9 | Ana: Reforço R$ 50,00 | Esperado (visto pelo gerente) R$ 123,00 |
| 10 | Gerente: Caixa | Vê "Esperado na gaveta R$ 123,00"; Ana não vê o esperado |
| 11 | Ana: Fechar caixa → calculadora: 1 × R$ 100, 1 × R$ 20, 1 × R$ 1 → R$ 121,00 → Confirmar contagem | "Falta R$ 2,00"; observação obrigatória |
| 12 | Em outra aba, Ana lança um reforço de R$ 10,00; volta e toca Fechar caixa | "Entrou dinheiro no turno depois da contagem. Conte de novo." |
| 13 | Ana: Contar de novo (R$ 131,00), observação "Troco errado na mesa 12", fica R$ 100,00, Fechar caixa | Relatório do turno com as duas contagens, esperado R$ 133,00, contado R$ 131,00, "Falta R$ 2,00", retirada do fechamento R$ 31,00 |
| 14 | Ana: Abrir caixa de novo | Troco já vem com R$ 100,00; mudar para R$ 80,00 pede observação |
| 15 | Gerente reabre a conta da mesa 4, tira o Pix e lança de novo em dinheiro | Relatório do turno novo mostra "Pagamento tirado de outro turno: Pix R$ 30,00" e recebido em dinheiro R$ 30,00; o turno antigo não mudou |
| 16 | Gerente: Vendas → hoje | X-Burger 3 un R$ 94,00; Suco 1 un R$ 9,00; Fatia de queijo 2 vezes R$ 4,00; formas de pagamento iguais à soma dos turnos; turnos com a diferença |
| 17 | Gerente: Baixar planilha | Abre no Excel em colunas, com vírgula decimal |
| 18 | Ana: abrir `/vendas` pelo endereço | "Sem acesso" |

## Testes automatizados

- Unidade: `pnpm test src/domain/cash src/components/cash`.
- Integração (PostgreSQL em container):
  `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test:integration tests/integration/cash`.
- Índices: `pnpm test:integration tests/integration/performance/indexes.test.ts`.
- Ponta a ponta: `pnpm test:e2e tests/e2e/cash.spec.ts --trace off`.
