# 13. Onde as fontes divergem e o que o sistema adota

> Fonte: Manual de Referência, seção 11. Estas escolhas são regras do produto; mudar qualquer uma
> exige atualizar este arquivo e os testes correspondentes.

## Escopo simplificado (novembro de 2026)

O dono do produto testou a primeira versão e achou o cadastro complexo demais. Decisões:

| Tema | Antes | Agora |
|---|---|---|
| Regras sanitárias (Anvisa/CVS) | Temperaturas, validades, lote, alérgenos, quarentena, registros | **Fora do escopo** |
| Fiscal | EAN, NCM, CEST, origem, grupo tributário, inventário fiscal | **Fora do escopo** |
| Contagem de estoque | Folhas de contagem, frequência, "inventariável" | **Fora do escopo.** O estoque baixa sozinho conforme os pedidos |
| Unidades do item | Três unidades (compra, estoque, receita), fator e conversão do item | **Uma medida** (kg, g, l, ml, un) e, opcionalmente, a embalagem de compra com a quantidade |
| Quanto se usa em cada produto | Unidade de receita e fator no item | Tela de **Produtos** (próxima feature) |
| Locais | Tipo, temperatura, responsável, ordem de contagem, regra de químicos | **Fora do escopo.** O estoque tem um saldo só por item, sem dizer onde ele está guardado |
| Textos da tela | Termos técnicos (fator, FC, GTIN) | Rótulos do dia a dia, com exemplo em cada campo |

Decisões da feature 003 (Produtos), 2026-11-02:

| Tema | Decisão |
|---|---|
| Preparos (sub-receitas) | **Entram na primeira versão.** Preparo tem rendimento e é usado dentro de outros produtos; a baixa vai direto nos ingredientes, proporcional |
| Ordem de produção / estoque de preparo pronto | Fora por enquanto |
| Preço de venda e % do custo no preço | Fora por enquanto |

Decisões da feature 004 (compras, perdas e saldo), 2026-11-02:

| Tema | Decisão |
|---|---|
| Acerto manual (sistema × prateleira) | **Com aprovação.** Quem lança pede o acerto (quanto tem de verdade + motivo); um gerente que não seja quem pediu aprova ou recusa. O saldo só muda na aprovação |
| Saldo negativo | Compra, perda, acerto e estorno nunca deixam saldo negativo. A exceção para vendas foi decidida na 011 (ver abaixo) |
| Valor da compra | Digita-se o **valor total pago**; o custo por medida é calculado |
| Custo médio | Guardado com 8 casas para o estorno de compra voltar exatamente à média anterior; tela mostra 2 |

Decisões da feature 007 (Fornecedores), 2026-11-02:

| Tema | Decisão |
|---|---|
| Ordem | O dono escolheu fazer a 007 enquanto a 005 espera o cardápio do cliente (QR code na mesa, cardápio aberto por 10 minutos, entrega na mesa) |
| CNPJ | Opcional (feirante e produtor podem não ter); se informado, validado e único. Aceita o CNPJ alfanumérico |
| Situação | Ativo ou **bloqueado**; sem "em avaliação" |
| Preço | O preço combinado fica no cadastro; a compra não muda o preço, só mostra a última compra ao lado |
| Embalagem | Cada fornecedor pode ter a sua para o mesmo item; a compra pode ser lançada nela |

Decisões da feature 006 (Alerta de reposição e gráficos), 2026-11-02:

| Tema | Decisão |
|---|---|
| Ordem | Feita antes da 005; até lá o consumo é só perda e acerto para menos |
| Ponto e "comprar até" | Digitados no item; o sistema sugere pela conta do manual e o botão "Usar sugestão" preenche |
| Sem "comprar até" | O item avisa, mas não diz quanto comprar |
| Gráficos | Pedido do dono: o que mais e menos saiu, por motivo e por semana. Leves: conta no banco, barras em HTML e CSS |
| Ordem dos gráficos | Por valor em R$ |

Decisões da feature 008 (Painel de custo dos produtos), 2026-11-02:

| Tema | Decisão |
|---|---|
| Preço de venda | Entra agora (estava fora na 003). Fica no produto, não na versão; vai para o histórico. Só produto vendido |
| Quem define o preço | Quem cadastra produto: gerente e chef |
| Faixas | Até 35% dentro da faixa; até 40% atenção; acima de 40% alto. Sem meta universal (o manual aceita até 40% à la carte), por isso 35–40% é atenção, não alto |
| Barra | Escala fixa de 0% a 100% do preço, com marca nos 35% |
| O que mais pesa | Pela linha do produto (item ou preparo), que é o nome que a pessoa vê |
| Produtos afetados por preço de insumo | Quadro "Usado nos produtos" no item, com custo e % de cada produto |
| CMV teórico do período | Espera as vendas da 005 |

Decisões da feature 011 (Conta da mesa e baixa do estoque), 2026-11-11:

| Tema | Decisão |
|---|---|
| Conta e baixa juntas | Pedido do dono: a 011 fecha o ciclo do pedido e entrega a 005 do roadmap |
| Quando o estoque baixa (Q1) | Quando a cozinha toca "Começar preparo" (é quando os ingredientes saem da prateleira); não no envio nem no fechamento da conta |
| Saldo negativo na venda | **Permitido, com aviso no item**: o pedido não pode parar. Compra, perda, acerto e estorno continuam bloqueados; a perda "Pedido cancelado" também não é bloqueada |
| Pedido cancelado depois do preparo | A cozinha diz se os ingredientes foram usados: Sim → estorno da venda + perda "Pedido cancelado"; Não → só o estorno |
| Dividir a conta (Q2) | Partes iguais por pessoas (2 a 20, centavos na primeira parte) e valor livre por pagamento; dividir por itens fica para depois |
| Taxa de serviço (Q3) | Configurável pelo gerente (0 a 20%, padrão ligada em 10%); vale para as contas que abrirem depois. O caixa tira e põe de volta numa conta, com registro |
| Valor do pagamento | Nunca passa do que falta, em nenhuma forma; no dinheiro, o recebido a mais vira troco |
| Fechar a conta | Só com falta R$ 0,00 e todos os pedidos entregues ou cancelados; libera a mesa e fecha os cardápios abertos nela |
| Reabrir a conta | Só o gerente, com motivo; recusada se a mesa já abriu outra conta |
| Papel Caixa | Novo: vê só Caixa, Contas e Pedidos. O garçom vê a conta aberta para levar o total, sem receber nem ver contas fechadas |
| Fiscal e maquininha | Fora do escopo |
| Caixa do dia (014) | Receber exige caixa aberto; um caixa aberto por restaurante; o caixa conta antes de ver o esperado e todas as contagens ficam; conta de mesa aberta não segura o fechamento; turno fechado não reabre; Vendas só para o gerente |
| CMV teórico do período | Agora que as vendas existem, fica para uma feature de indicadores |

Os documentos de regras sanitárias, fiscal e rotinas foram retirados. O manual original continua em
[`fontes/`](fontes/) para consulta.

## Onde as fontes divergem

| Tema | Divergência | Escolha adotada |
|---|---|---|
| Estoque mínimo e ponto de pedido | Saipos/UFPR: mínimo = consumo × tempo de reposição. Conta Azul: mínimo = estoque de segurança, com dupla contagem no PP | ES = CMD × ciclo × margem; PP = CMD × LT + ES; o campo "mínimo" recebe o PP |
| Estoque máximo | Saipos: mínimo + lote. UFPR: consumo mensal + mínimo. Altametrics: par | Par = CMD × ciclo + ES |
| Devoluções no CMV | Saipos soma; BaresSP subtrai | Compras líquidas = compras − devoluções |
| Mão de obra no CMV | Blog Sebrae PR inclui; Stone exclui | Excluir |
| Faixa de CMV % | 25–35% × 30–40% | Depende do modelo; variância teórico × real é a meta principal |
| Valoração do estoque | Último custo (PDV Legal) × custo médio (Saipos) | Custo médio; último custo visível |

## Prioridade de implantação (conclusão do manual)

O que separa um estoque que só registra de um que gerencia é a **granularidade dos motivos**. A
ordem de prioridade:

1. Produtos cadastrados com as quantidades de cada item.
2. Baixa automática a cada pedido.
3. Motivos de perda em lista fechada.

O resto é refinamento. Essa ordem orienta o [roadmap do módulo](00-visao-geral.md#roadmap).

## Em aberto (próxima rodada de pesquisa)

- Comparação dos módulos de estoque de cada software.
