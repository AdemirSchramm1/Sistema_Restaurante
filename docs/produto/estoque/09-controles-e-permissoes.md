# 9. Controles contra perdas e furtos

> **Escopo simplificado (novembro de 2026).** Sem conferência cega e sem contagem, as regras de
> segregação ligadas a elas não se aplicam. Continuam: trilha de auditoria, papéis, perda separada
> de consumo e acerto que só vale com aprovação de um gerente que não seja quem pediu (feature 004). Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

> Fonte: Manual de Referência, seção 7.

Os controles reforçam uns aos outros:

- Um ou dois responsáveis treinados pelo estoque.
- Estoque com acesso controlado.
- Conferência cega.
- Contagem dupla e assinada.
- Política escrita de cortesias e porcionamento: **generosidade não autorizada conta como furto**.
- Trilha de auditoria de quem fez o quê e quando.
- Análise da variância por local, turno e categoria.
- Relatórios de cancelamentos, estornos e descontos fora do padrão.
- Permissões de desconto e de retirar item da conta só para pessoas de confiança.
- Separar "perda" de "consumo" no sistema.

## Papéis e segregação de funções

O sistema usa estes papéis. Um usuário pode ter mais de um, mas o sistema impede as combinações da
última coluna **na mesma operação**.

| Papel | Pode | Não pode acumular com |
|---|---|---|
| Comprador / gerente | Cotação e pedido | Recebimento e aprovação do próprio pedido |
| Estoquista / almoxarife | Recebimento e contagem às cegas | Lançamento da NF e ajuste |
| Administrativo / financeiro | Conferência com a NF e lançamento | Contagem física |
| Chef | Fichas técnicas, porcionamento, perdas, produção | Aprovação dos próprios ajustes |
| Gerente / proprietário | Aprovação de ajustes, análise de CMV e variância | – |

Na primeira versão (features 004 e 007) os papéis fazem:

| Ação | Quem pode |
|---|---|
| Lançar compra | Gerente, estoquista, comprador |
| Lançar perda | Gerente, chef, estoquista |
| Pedir acerto | Gerente, chef, estoquista, comprador |
| Aprovar acerto e estornar | Gerente (nunca o próprio pedido) |
| Cadastrar fornecedor, itens e preços, bloquear | Gerente e comprador |
| Definir o aviso de reposição do item (feature 006) | Gerente, chef e comprador |
| Definir o preço de venda do produto (feature 008) | Gerente e chef |
| Ver estoque, produtos, fornecedores, "Repor", "Gráficos" e "Custos" | Todos os papéis, menos o garçom e o caixa |

### Pedidos (features 009 e 010)

O papel **Garçom** (feature 009) vê as telas "Garçom", "Caixa" (só para ler a conta aberta, feature
011) e "Pedidos"; o menu mostra só o que cada papel pode abrir e, ao entrar, cada um cai na primeira
tela do seu menu.

| Ação | Permissão | Quem pode |
|---|---|---|
| Cadastrar, renomear e inativar mesa; trocar QR code | `table.manage` | Gerente |
| Ligar e desligar "Recebendo pedidos pelo QR code" | `ordering.toggle` | Gerente |
| Ver a cozinha e mudar a situação (Em preparo, Pronto) | `order.kitchen` | Gerente, chef |
| Cancelar pedido (com motivo) | `order.cancel` | Gerente, chef |
| Ver prontos e marcar entregue | `order.deliver` | Gerente, chef, garçom |
| Consultar pedidos | `order.read` | Gerente, chef, garçom |
| Marcar "Esgotado hoje" | `product.sold_out` | Gerente, chef |
| Ver adicionais | `addon.read` | Gerente, chef |
| Cadastrar e mudar adicionais e preços; quadro "Adicionar e tirar" do produto | `addon.write` | Gerente |
| Tela Cardápio: seções, ordem, foto, descrição, preço de venda, produto novo, "Ver como o cliente" (013) | `menu.write` | Gerente, chef |

O cliente não tem usuário: o pedido registra a mesa e o acesso de origem. Toda escrita da equipe
(mesa, QR code, situação, cancelamento, esgotado, chave, adicional, quadro) vai para a trilha de
auditoria, e tentativa sem permissão fica registrada como negada.

Na tela **Cardápio** (feature 013) vão para a auditoria: criar, renomear, ordenar e apagar seção;
mudar a ordem dos produtos; pôr, trocar e tirar foto; mudar descrição, seção e preço; criar produto
pelo cardápio (criação da ficha, preço e dados do cardápio). Cada registro guarda quem, quando e o
antes e depois; foto aparece no histórico como "Foto" trocada, sem o endereço do arquivo. Ver
[06 — Editar o cardápio](../pedidos/06-editar-o-cardapio.md).

### Conta da mesa (feature 011)

Entra o papel **Caixa**: vê só "Caixa", "Contas" e "Pedidos" e entra direto no Caixa. Ver
[05 — Conta da mesa e caixa](../pedidos/05-conta-da-mesa.md).

| Ação | Permissão | Quem pode |
|---|---|---|
| Ver o Caixa e a conta aberta; imprimir a conta aberta | `tab.read` | Gerente, caixa, garçom |
| Lançar e tirar pagamento; tirar e pôr a taxa da conta; fechar conta | `tab.pay` | Gerente, caixa |
| Contas fechadas: a lista, cada conta fechada e o resumo por forma de pagamento | `tab.history` | Gerente, caixa |
| Reabrir conta (com motivo) | `tab.reopen` | Gerente |
| Configurar a taxa de serviço do restaurante | `tab.settings` | Gerente |
| Consultar pedidos | `order.read` | Gerente, chef, garçom, caixa |

A baixa do estoque pelo pedido não tem permissão própria: acontece quando quem pode mudar a
situação na cozinha (`order.kitchen`: gerente, chef) toca "Começar preparo", e o estorno ou a perda
do cancelamento, com quem cancela (`order.cancel`). Toda escrita (pagamento, pagamento tirado,
taxa tirada ou posta de volta, fechamento, reabertura com o motivo, taxa do restaurante, venda,
estorno e perda do cancelamento) vai para a trilha de auditoria com quem e quando.

Controles do manual que a 011 atende: tirar pagamento e tirar a taxa da conta ficam registrados com
quem e quando (o pagamento tirado continua visível, riscado); reabrir conta é só do gerente e exige
motivo; a perda de pedido cancelado fica separada da venda.

## Operação pequena

Quando não dá para separar todas as funções, o restaurante liga o **modo operação pequena**: o
sistema permite acumular, mas registra a exceção e exige **contagem periódica feita pelo dono** e
**revisão semanal da variância** (aparece como tarefa pendente no painel).

## Critérios de aceite (para a spec)

- O usuário que lançou um ajuste não consegue aprová-lo (exceto em modo operação pequena, com
  registro).
- O usuário que fez a contagem cega de um recebimento não consegue lançar a NF desse recebimento.
- Toda escrita registra usuário, data/hora e origem.
- Relatório de auditoria filtra por usuário, período, tipo de operação.
