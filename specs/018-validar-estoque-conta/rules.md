# Regras e os testes que as garantem (spec 018, FR-007)

Cada regra de `docs/produto/estoque/` e de `docs/produto/pedidos/01` a `05` aparece aqui com pelo
menos um teste nomeado. O nome do teste é o título do `it`/`test`, e o caminho é o arquivo onde ele
fica. Regras que a decisão de novembro de 2026
([13-decisoes-adotadas](../../docs/produto/estoque/13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026))
tirou do escopo ficam marcadas **fora do escopo**, sem teste. As duas que ainda não existem no
sistema ficam marcadas **spec 019**, que é a próxima feature.

Abreviações dos caminhos: `int/` = `tests/integration/`, `dom/` = `src/domain/`,
`cmp/` = `src/components/`, `e2e/` = `tests/e2e/`, `telas/` = `tests/screens/`.

## Estoque

### 00 — Visão geral

| Regra | Teste |
|---|---|
| Os quatro dados mestres (itens, fornecedores, produtos, movimentações) por restaurante, sem um ver o do outro | `int/items/tenant-isolation.test.ts` › usuário de B não vê, não lista e não altera item de A; `int/movements/movements.test.ts` › administrativo não lança; restaurante B não vê nem lança no item de A |
| Ciclo fechado: produto → compra → entrada → baixa pelo pedido → perda | `e2e/billing.spec.ts` › do pedido à conta fechada: divisão, troco, mesa livre, contas e baixa do estoque (spec 011); `int/billing/sale.test.ts` › 2 × X-Burger com + 2 Fatia de queijo e sem cebola… |
| Contagem, sanitário, conferência cega, fiscal e locais | **fora do escopo** |

### 01 — Grupos de itens

| Regra | Teste |
|---|---|
| Restaurante novo já vem com a árvore padrão | `int/groups/groups.test.ts` › restaurante novo já tem a árvore padrão (cenário 2.1); `dom/inventory/default-tree.test.ts` |
| Pode criar subgrupo, com o próximo código livre | `int/groups/groups.test.ts` › cria o subgrupo Cogumelos em Hortifrúti com o próximo código livre (cenário 2.3) |
| Grupo novo: próximo código e nome sem repetir entre ativos | `int/groups/groups.test.ts` › cria grupo novo com código 14 e recusa nome repetido entre ativos |
| Grupo padrão não é apagado nem inativado | `int/groups/groups.test.ts` › não inativa grupo padrão (cenário 2.2) |
| Grupo ou subgrupo com item ativo não é inativado | `int/groups/groups.test.ts` › inativa grupo criado pelo restaurante só sem itens ativos; › não inativa subgrupo com itens ativos (cenário 2.5) |
| Renomear mantém o código | `int/groups/groups.test.ts` › renomear mantém o código |
| Todo item tem exatamente um grupo, um subgrupo e um tipo | `int/items/create-item.test.ts` › recusa subgrupo inexistente; `int/items/edges.test.ts` › subgrupo inativo, ou de grupo inativo, é SUBGROUP_INACTIVE no campo subgroupId |
| "Entra no CMV" vem do grupo e pode ser sobrescrito no item, com auditoria | `int/groups/cogs-override.test.ts` › gerente marca item de Higiene e limpeza como CMV, com auditoria, e depois volta a seguir o grupo; › chef não sobrescreve o CMV |
| Relatórios agrupam por grupo | `int/items/edges.test.ts` › filtros por grupo, subgrupo, tipo, texto (também no código) e situação; página inválida vira 1 |
| Quem não é do estoque não mexe em grupos | `int/groups/groups.test.ts` › chef não mexe em grupos |

### 02 — Cadastro do item

| Regra | Teste |
|---|---|
| Formulário em três blocos com títulos do dia a dia | `cmp/items/item-form.test.tsx` › mostra os três blocos com títulos do dia a dia |
| Todo campo com rótulo claro | `cmp/items/item-form.test.tsx` › cada campo tem rótulo claro |
| Código grupo.subgrupo.número gerado pelo sistema, em sequência, sem buraco quando recusa | `int/items/create-item.test.ts` › gera 01.02.0001 e 01.02.0002…; › 10 cadastros simultâneos… geram 10 códigos distintos e em sequência; › não consome número do subgrupo quando o cadastro é recusado |
| Código nunca muda (nem trocando de subgrupo) | `int/items/edges.test.ts` › trocar de subgrupo: … para um ativo, o código fica |
| Depois do 9999 não há código | `int/items/edges.test.ts` › depois do item 9999 do subgrupo não há código |
| Dois itens ativos com o mesmo nome normalizado no subgrupo: não | `int/items/create-item.test.ts` › recusa descrição normalizada repetida no mesmo subgrupo e mostra o código existente (cenário 1.4); `int/items/edges.test.ts` › versão velha e descrição repetida são recusadas pelo banco; item inativo pode repetir |
| O mesmo nome em outro subgrupo pode | `int/items/create-item.test.ts` › aceita a mesma descrição em outro subgrupo |
| Inativo libera o nome; reativar com duplicado ativo é recusado | `int/items/item-active.test.ts` › item inativo sai da lista de ativos e libera a descrição; reativar com duplicado ativo é recusado |
| A medida não muda depois da primeira movimentação | `int/items/stock-unit-lock.test.ts` › recusa trocar a unidade pelo caso de uso e pelo SQL direto; › permite trocar a unidade antes de qualquer movimentação; `int/movements/movements.test.ts` › a primeira movimentação trava a medida do item; `cmp/items/item-form.test.tsx` › bloqueia a medida quando o item já movimentou |
| Item usado em produto, preparo ou adicional (qualquer versão) só muda de medida dentro da família; a recusa diz onde está (decisão de 2026-11-28) | `int/items/unit-in-use.test.ts` › item num produto não vira un nem l; a recusa diz em quais produtos ele está; › vale para item dentro de preparo e para item de adicional; › produto que tirou o item numa versão nova ainda segura a troca: pedidos antigos usam a versão velha; `dom/inventory/item.test.ts` › item usado em produto ou adicional não troca de família, e a recusa diz onde ele está (spec 018) |
| Embalagem e quantidade andam juntas e a recusa aponta o campo | `int/items/purchase-package.test.ts` › embalagem sem quantidade é recusada apontando o campo (cenário 4); › o banco também exige embalagem e quantidade juntas; `cmp/items/item-form.test.tsx` › com embalagem e sem quantidade, avisa o que falta |
| Frase pronta "1 Caixa = 20 kg" | `cmp/items/item-form.test.tsx` › mostra a frase pronta da embalagem: 1 Caixa = 20 kg; `int/items/purchase-package.test.ts` › grava a embalagem e mostra 1 Saco = 5 kg (cenário 3) |
| Custo médio e último custo só na tela, calculados pelas entradas | `int/movements/movements.test.ts` › 3 caixas de tomate por R$ 240: saldo 60 kg, custo R$ 4,00; depois 10 kg a R$ 30 mudam a média |
| Só gerente e chef cadastram; tentativa negada fica registrada | `int/items/permissions.test.ts` › estoquista não cadastra item e a tentativa fica registrada; › chef cadastra item |
| Edição com versão velha é recusada | `int/items/stale-record.test.ts` › o segundo a salvar com a mesma versão recebe STALE_RECORD |

### 03 — Fornecedores

| Regra | Teste |
|---|---|
| Só o nome é obrigatório; o resto completa depois | `int/suppliers/suppliers.test.ts` › cria só com o nome e depois completa com CNPJ, contato e entrega |
| CNPJ validado pelos dígitos, também o alfanumérico | `dom/suppliers/cnpj.test.ts` › recusa dígito verificador errado, tamanho errado e todos iguais; › aceita o CNPJ alfanumérico (Receita Federal, julho de 2026); `int/suppliers/suppliers.test.ts` › aceita CNPJ alfanumérico |
| CNPJ único por restaurante, dizendo quem já usa | `int/suppliers/suppliers.test.ts` › CNPJ repetido no restaurante é recusado e diz quem já usa; em outro restaurante pode; `int/suppliers/edges.test.ts` › CNPJ de outro fornecedor na edição é recusado mesmo bloqueado, e diz quem usa |
| Nome único entre ativos | `int/suppliers/suppliers.test.ts` › nome repetido entre ativos é recusado, ignorando acento e caixa; `int/suppliers/edges.test.ts` › nome repetido: ativo recusa na edição; bloqueado pode ter o mesmo nome, mas não desbloqueia |
| Itens que vende, com preço, embalagem e preço por medida | `int/suppliers/suppliers.test.ts` › adiciona item com caixa, mostra preço por medida e não repete o item; `cmp/suppliers/supplier-items.test.tsx` › mostra embalagem, preço, preço por medida, última compra e preferido |
| Um preferido por item | `int/suppliers/suppliers.test.ts` › um preferido por item: marcar outro tira a marca do anterior; › o banco não deixa dois preferidos para o mesmo item |
| A página do item mostra quem vende e o mais barato por medida | `cmp/suppliers/item-offers.test.tsx` › mostra embalagem, preço, preço por medida, selos e a última compra no fuso do restaurante |
| Compra na embalagem do fornecedor; o preço cadastrado não muda sozinho | `int/suppliers/suppliers.test.ts` › compra de 2 caixas de 18 kg do fornecedor: entram 36 kg e a compra mostra o fornecedor |
| Bloqueado não recebe compra e some das opções; nunca é apagado | `int/suppliers/suppliers.test.ts` › fornecedor bloqueado não recebe compra e some das opções; desbloqueado volta; › bloquear e desbloquear ficam no histórico |
| Cadastram: gerente e comprador | `int/suppliers/suppliers.test.ts` › comprador cadastra; chef e estoquista só veem; negado vai para a auditoria; `dom/access/permissions.test.ts` › fornecedores: só gerente e comprador cadastram (spec 007, FR-006) |
| SIF/SIE/SIM, desempenho, sanitário, fiscal e de-para da NF-e | **fora do escopo** |

### 04 — Produtos (fichas técnicas)

| Regra | Teste |
|---|---|
| Produto com as quantidades de cada item; quantidade em medida menor da mesma família | `int/recipes/recipes.test.ts` › salva o X-Burger com três linhas e mostra 'sem custo' até haver custo médio; `dom/inventory/recipe-graph.test.ts` › 2 X-Burger baixam 2 pães, 0,3 kg de carne e 0,06 kg de queijo |
| Custo da linha = quantidade na medida do item × custo médio; "Sem custo" antes da primeira compra | `int/movements/movements.test.ts` › o custo do produto aparece depois da compra (liga com a 003); `dom/inventory/recipe-graph.test.ts` › sem custo médio em algum item, o total fica sem custo e diz qual falta |
| Preparo com rendimento; outro produto usa a parte proporcional | `int/recipes/recipes.test.ts` › o X-Burger usa 50 g do molho que rende 2 kg e custa a parte proporcional |
| Sem ciclos (preparo não contém a si mesmo) | `int/recipes/recipes.test.ts` › produto vendido não entra em outro; preparo não fecha ciclo |
| Cada edição das linhas cria versão; o pedido usa a versão do envio | `int/recipes/recipes.test.ts` › editar as linhas cria a versão 2; o pedido de antes continua vendo a versão 1; › versões e linhas gravadas não mudam nem somem; `int/billing/sale.test.ts` › mudar a ficha depois do envio não muda a baixa: vale a versão gravada no pedido |
| Mudar só o nome ou o preço não cria versão | `int/recipes/recipes.test.ts` › mudar só o nome não cria versão; registro desatualizado dá STALE_RECORD; `int/costs/product-costs.test.ts` › salva R$ 28,00 no X-Burger, sem criar versão, e registra no histórico |
| Nome único entre ativos | `int/recipes/recipes.test.ts` › recusa nome repetido entre ativos, sem diferenciar maiúsculas e acentos |
| Item inativo não entra em produto novo | `int/recipes/recipes.test.ts` › item inativo não entra em produto novo |
| Preparo em uso não é inativado nem troca de família de medida | `int/recipes/recipes.test.ts` › preparo em uso não é inativado, não vira vendido e não troca kg por un |
| Preço de venda; preparo não tem preço | `int/costs/product-costs.test.ts` › recusa preço inválido, registro desatualizado e preço em preparo; › o banco recusa preço em preparo e preço zero |
| % CMV = custo ÷ preço × 100 | `dom/inventory/product-cost.test.ts` › é custo ÷ preço × 100, exato |
| Item mostra em quais produtos entra (aviso de fichas afetadas) | `int/costs/product-costs.test.ts` › lista os produtos ativos que usam o item direto ou dentro de um preparo |
| FC, IC, porções, alérgenos, modo de preparo, ordem de produção | **fora do escopo** |

### 06 — Movimentações

| Regra | Teste |
|---|---|
| Movimentação não é editada nem apagada; correção por estorno | `int/movements/movements.test.ts` › movimentação não muda nem some, nem pela aplicação nem pelo dono; › estorno de compra devolve o saldo e a média; não estorna duas vezes |
| Tipo e motivo de listas fechadas, iguais no banco e no domínio | `int/movements/movements.test.ts` › motivos do banco são os mesmos do domínio; `dom/inventory/movement-reasons.test.ts`; `int/movements/edges.test.ts` › acerto com motivo de outro tipo é recusado no campo reasonId |
| Saldo = soma das movimentações | `int/movements/movements.test.ts` › propriedade: depois de uma sequência qualquer de lançamentos, saldo = soma do livro |
| Valor da saída = quantidade × custo médio | `int/movements/movements.test.ts` › 500 g queimados saem pelo custo médio e aparecem nas movimentações com o motivo |
| Compra recalcula o custo médio; saída não muda | `int/movements/movements.test.ts` › 3 caixas de tomate por R$ 240…; `dom/inventory/average-cost.test.ts` |
| Saída que deixaria saldo negativo é bloqueada (perda, acerto, estorno), também em paralelo | `int/movements/movements.test.ts` › perda maior que o saldo é recusada; › duas perdas ao mesmo tempo não passam do saldo; › aprovar falta maior que o saldo atual é recusado; › estorno que deixaria saldo negativo é recusado; só gerente estorna |
| Acerto: qualquer um que lança pede, com motivo; outro gerente aprova; saldo muda só na aprovação | `int/movements/movements.test.ts` › chef pede, o saldo não muda; o gerente aprova e a diferença entra no livro; › quem pediu não aprova, nem sendo gerente; chef não aprova; › recusar e cancelar não mudam o saldo; só quem pediu cancela |
| Mesmo envio duas vezes lança uma vez só | `int/movements/movements.test.ts` › mesmo formulário enviado duas vezes não lança em dobro; `int/movements/edges.test.ts` › perda e estorno enviados duas vezes (mesma chave) lançam uma vez só |
| Item inativo não recebe compra | `int/movements/movements.test.ts` › item inativo não recebe compra |
| "Pedido cancelado" só vem do sistema | `dom/inventory/movement.test.ts` › 'Pedido cancelado' só vem do cancelamento: fora das listas e recusado na perda e no estorno à mão; `cmp/movements/movement-form.test.tsx` › perda não oferece 'Pedido cancelado'… |
| Venda: no "Começar preparo", uma vez só; recebido não mexe | `int/billing/sale.test.ts` › tocar duas vezes ou em duas telas baixa uma vez só; › Pronto e Entregue não baixam de novo; `int/billing/cancel-stock.test.ts` › pedido só recebido: cancelar não mexe no estoque e não pergunta nada |
| Venda pelo consumo do pedido (versão do envio, retiradas, adicionais, preparos) | `int/billing/sale.test.ts` › 2 × X-Burger com + 2 Fatia de queijo e sem cebola: queijo −0,14 kg, pão −2, carne −0,3 kg, cebola nada |
| Até 4 casas; o que arredonda para zero não sai | `int/billing/sale.test.ts` › linha que arredonda para zero na precisão do livro não sai |
| Venda mostra "Pedido 7, Mesa 12" | `int/billing/sale.test.ts` › lançamentos mostram a venda com o pedido e a mesa; venda não se estorna à mão; `cmp/movements/movement-table.test.tsx` › venda mostra o pedido e a mesa |
| Custo médio do momento; item nunca comprado sai com custo zero e "Sem custo" | `int/billing/sale.test.ts` › item sem custo ainda baixa, com custo zero; `cmp/movements/movement-table.test.tsx` › venda sem custo diz 'Sem custo' |
| Venda nunca é bloqueada, nem por item inativo; saldo negativo com aviso | `int/billing/sale.test.ts` › não bloqueia por saldo: carne sem estoque fica negativa e o saldo é a soma do livro; `dom/inventory/movement.test.ts` › item inativo também baixa; `cmp/items/stock-balance.test.tsx` › saldo negativo vem com o aviso em texto, não só em cor |
| Em Repor, saldo negativo conta como zero | `dom/inventory/reorder.test.ts` › saldo negativo (venda sem estoque lançado, spec 011) conta como zero: acabou |
| Venda não se lança nem se estorna à mão | `dom/inventory/movement.test.ts` › venda não se estorna à mão: desfaz cancelando o pedido; `cmp/movements/movement-table.test.tsx` › venda não tem 'Estornar'… |
| Falha no meio da baixa desfaz a mudança de situação | `int/billing/sale.test.ts` › falha no meio da baixa desfaz a mudança de situação |
| Cancelado depois do preparo: "Sim" = estorno + perda "Pedido cancelado"; "Não" = só estorno | `int/billing/cancel-stock.test.ts` › 'Sim, já foram usados': estorna cada venda e lança a mesma saída como perda 'Pedido cancelado'; › 'Não': só estorna e o saldo volta ao de antes do preparo |
| A perda do cancelamento não é barrada por saldo; nada é editado | `int/billing/cancel-stock.test.ts` › pedido pronto também pergunta; a perda não é barrada por saldo negativo; › nada do livro é editado ou apagado; cancelar de novo é recusado e não estorna duas vezes |
| Gráficos: "Venda" separada das perdas | `int/billing/sale-report.test.ts` › 'Venda' aparece nas saídas por motivo, separada das famílias de perda |

### 08 — Ciclo operacional

| Regra | Teste |
|---|---|
| ES, PP, par e quantidade a pedir (exemplo do filé mignon) | `dom/inventory/reorder.test.ts` › calcula ES, PP, par e quantidade a pedir do exemplo do filé mignon |
| CMD = consumo do período ÷ dias; sugestão pelos últimos 30 dias, prazo e dias do preferido, margem 20% | `dom/inventory/reorder.test.ts` › consumo médio diário = consumo do período ÷ dias; › 180 kg em 30 dias, entrega 1 dia depois, a cada 3,5 dias: PP 10,2 e comprar até 25,2; `int/reorder/reorder.test.ts` › 45 kg em 30 dias, entrega em 1 dia, seg e qui: PP 2,55 e comprar até 6,3; › saída de mais de 30 dias atrás não entra no consumo |
| Sem preferido: prazo 1 dia e ciclo de 7 | `dom/inventory/reorder.test.ts` › sem fornecedor preferido usa prazo de 1 dia e ciclo de 7 dias |
| Item no ponto aparece em Repor, com quanto comprar arredondado para cima na embalagem e de quem | `int/reorder/reorder.test.ts` › item que chegou no ponto aparece com quanto comprar na caixa do fornecedor preferido; `dom/inventory/reorder.test.ts` › arredonda para cima na embalagem: 18 kg em caixa de 5 kg = 4 caixas (20 kg) |
| "Comprar até" maior que o ponto | `int/reorder/reorder.test.ts` › recusa comprar até menor que o ponto, versão velha e quem não pode; › o banco também recusa comprar até sem ponto ou menor que ele |
| Ponto em branco desliga o aviso; inativo não avisa | `int/reorder/reorder.test.ts` › deixar o ponto em branco desliga o aviso; › item inativo não avisa e a lista de itens marca quem está no ponto |
| Requisição com alçada, cotação, recebimento, ordem de produção, inventário | **fora do escopo** |

### 09 — Controles e permissões

| Regra | Teste |
|---|---|
| Quem lança um acerto não aprova | `int/movements/movements.test.ts` › quem pediu não aprova, nem sendo gerente; chef não aprova |
| Tabela "Na primeira versão" (lançar compra, perda, pedir acerto, aprovar, fornecedor, aviso, preço, ver) | `dom/access/permissions.test.ts` › lançamentos por papel (spec 004, FR-006); › fornecedores: só gerente e comprador cadastram; › item.reorder só para gerente, chef e comprador; `int/movements/edges.test.ts` › garçom não lança, não pede acerto, não estorna e não vê o livro |
| Tabela de pedidos (009 e 010) | `dom/access/permissions.test.ts` › garçom só vê prontos, marca entregue, consulta pedidos e vê a conta (spec 011); não vê estoque; › matriz das ações novas; › preços de adicionais só o gerente muda; o chef vê; › menu.write é do gerente e do chef, e de mais ninguém; › lançar pedido e cancelar o próprio: gerente, garçom e caixa; › cancelar qualquer pedido continua só com gerente e chef |
| Tabela da conta da mesa (011) | `dom/access/permissions.test.ts` › caixa vê o caixa, recebe, fecha e consulta contas e pedidos; não vê estoque nem cozinha |
| Tabela do caixa do dia (014) | `dom/access/permissions.test.ts` › abrir, sangria, reforço, fechar o próprio turno e ver turnos fechados: gerente e caixa; › fechar o turno de outra pessoa, ver o esperado do turno aberto e Vendas: só o gerente |
| Toda escrita registra quem e quando; negada fica registrada | `int/audit/history.test.ts` › mostra quem criou e quem alterou, com antes e depois, em ordem; `int/audit/menu.test.ts` › cada tentativa sem permissão fica gravada como negada, com quem tentou; `int/audit-log.test.ts` › UPDATE e DELETE em audit_log falham para a aplicação |
| Relatório de auditoria filtra por usuário, período e tipo | **spec 019** |
| Modo operação pequena (acumular funções com registro da exceção) | **spec 019** |
| Contagem cega × lançamento da NF | **fora do escopo** |

### 10 — Indicadores

| Regra | Teste |
|---|---|
| Gráficos: resumo, mais saíram, menos saíram (com parados), por motivo e semanas | `int/reorder/reorder.test.ts` › mais saíram, menos saíram (com parado), motivos, resumo e semanas; `dom/inventory/stock-report.test.ts` › menos saíram: parados com estoque primeiro, depois do menor valor para o maior |
| Estorno e lançamento estornado não contam; acerto para menos é saída | `int/reorder/reorder.test.ts` › estorno e lançamento estornado não contam; acerto para menos conta como saída |
| Período de 7, 30 ou 90 dias pela data do fato | `dom/inventory/stock-report.test.ts` › aceita 7, 30 ou 90 dias e conta para trás a partir de agora; `int/reorder/reorder.test.ts` › o período escolhido limita as contas pela data do fato |
| Custo no preço, faixas 35%/40%, sobra, o que mais pesa | `dom/inventory/product-cost.test.ts` › faixas do manual: até 35% dentro da faixa, até 40% atenção, acima de 40% alto (10-indicadores); › X-Burger a R$ 28,00: 30,4% dentro da faixa, sobra R$ 19,50 e a carne pesa mais; › vendido abaixo do custo tem sobra negativa (prejuízo) |
| Ordem do painel e resumo no topo | `dom/inventory/product-cost.test.ts` › maior % primeiro; depois sem preço; depois sem custo; empate pelo nome; › resumo conta alto, atenção, dentro da faixa, sem preço e sem custo; `int/costs/product-costs.test.ts` › mostra custo, custo no preço, faixa, sobra e o que mais pesa, na ordem do painel |
| CMV por contagem, curva ABC, variância por item e categoria | **fora do escopo** (sem contagem física) |

### 13 — Decisões adotadas

| Regra | Teste |
|---|---|
| Ponto de pedido como gatilho do aviso | `dom/inventory/reorder.test.ts` › avisa quando o saldo é menor ou igual ao ponto |
| Custo médio ponderado (não PEPS) | `dom/inventory/average-cost.test.ts`; `int/movements/movements.test.ts` › 3 caixas de tomate por R$ 240… |
| Saldo único por item, sem locais | `dom/access/permissions.test.ts` › não existe mais permissão de locais (spec 002, US3); `int/movements/movements.test.ts` › propriedade: … saldo = soma do livro |

## Pedidos

### 01 — Mesas e QR codes

| Regra | Teste |
|---|---|
| Nome de 1 a 30 letras, sem repetir entre ativas (sem acento nem maiúscula) | `dom/ordering/table-name.test.ts` › de 1 a 30 caracteres, sem espaço nas pontas; › compara sem acento e sem diferenciar maiúsculas; `int/ordering/tables.test.ts` › cria mesa, recusa o mesmo nome sem diferenciar maiúsculas e acentos e lista em ordem natural |
| Criar várias de um número a outro (1 a 999, até 200), pulando as que existem | `dom/ordering/table-name.test.ts` › de 1 a 999, até 200 de uma vez, inteiros, início ≤ fim; `int/ordering/tables.test.ts` › cria uma faixa de mesas e pula as que já existem; `int/ordering/tables-edges.test.ts` › faixa pula a mesa ativa com o mesmo número, mas não a inativa |
| Mesa é inativada, não apagada; inativa libera o nome e não abre o cardápio | `int/ordering/tables.test.ts` › renomeia e inativa com trava otimista; mesa inativa libera o nome; `int/ordering/menu-access.test.ts` › mesa inativa, chave desligada e token desconhecido não abrem acesso |
| Renomear não muda o QR code; trocar o QR code invalida o antigo | `int/ordering/tables.test.ts` › QR code com o link da mesa; trocar o QR code invalida o antigo |
| Código aleatório; QR code desconhecido diz "QR code inválido" | `int/ordering/public-route.test.ts` › token desconhecido: 404 com 'QR code inválido. Chame um garçom.' |
| Cartão: desenho, nome, "Mesa N", Abrir, Baixar, Imprimir, Trocar com confirmação | `cmp/ordering/table-qr-card.test.tsx` › mostra o desenho com o nome do restaurante e 'Mesa 12'; › 'Baixar imagem' baixa o SVG com o nome da mesa; › 'Abrir o cardápio' leva ao link…; › 'Trocar QR code' pede confirmação antes de trocar; › na folha de impressão não mostra os botões |
| Imprimir todos em ordem natural | `int/ordering/tables-edges.test.ts` › QR codes para imprimir saem em ordem natural |
| Chave "Recebendo pedidos": desligada não abre nem aceita envio; liga e desliga com auditoria | `int/ordering/orders.test.ts` › gerente desliga e liga a chave, com trava e auditoria; `int/ordering/public-route.test.ts` › chave desligada: mostra a mensagem sem criar acesso; `int/ordering/submit-order.test.ts` › mesa inativa, chave desligada e limite de 10 pedidos por acesso |
| Só o gerente cuida das mesas; auditoria sem o código do QR | `int/ordering/tables.test.ts` › só o gerente cuida das mesas; tentativa negada vai para a auditoria; › QR code com o link da mesa; trocar o QR code invalida o antigo (confere que o código antigo não está no histórico) |

### 02 — Cardápio do cliente

| Regra | Teste |
|---|---|
| Só vendidos, ativos, com preço e não esgotados hoje | `int/ordering/menu.test.ts` › mostra só produtos vendidos, ativos, com preço e não esgotados hoje, com os botões da 010; `dom/menu/customer-menu.test.ts` › some o que o cliente não pode pedir: inativo, sem preço, esgotado hoje e preparo |
| Por seção, na ordem escolhida; "Outros" no fim | `dom/menu/customer-menu.test.ts` › seções na ordem escolhida, produtos pela posição e Outros no fim; `int/ordering/menu.test.ts` › vem por seção, na ordem escolhida, com descrição e foto (spec 013, US6) |
| Topo com capa, logo, nome e mesa | `cmp/ordering/menu-app.test.tsx` › o cardápio de verdade mostra a capa, o logo, o nome e a mesa |
| Barra de seções presa no topo, que leva à seção | `telas/customer-menu.spec.ts` › cardápio: a barra de seções fica no topo e leva à seção; `cmp/ordering/menu-app.test.tsx` › marca na barra a seção que está na tela |
| "+" direto sem abrir o prato; nome ou foto abrem a tela do prato | `cmp/ordering/menu-app.test.tsx` › produto sem opções vai direto para o pedido; › tocar no nome abre a tela do prato com a descrição inteira, mesmo sem opções |
| Tela do prato só com botões (adicionais com preço, retiradas) | `telas/customer-menu.spec.ts` › tela do prato: foto maior, descrição inteira, adicionais e retiradas |
| Carrinho sempre à vista: coluna ao lado a partir de 1024 px, barra no pé abaixo | `telas/customer-menu.spec.ts` › carrinho sempre à vista: ao lado na tela larga, barra no pé na estreita (spec 016, US3); `cmp/ordering/cart-panel.test.tsx` › coluna ao lado na tela larga… |
| "Meus pedidos" só deste celular | `int/ordering/menu.test.ts` › 'Meus pedidos' mostra só os pedidos deste celular, mais novo primeiro |
| Colunas por largura; nada rola de lado, nada cortado, toque de 44 px; claro e escuro | `telas/customer-menu.spec.ts` › cardápio: seções, cartões nas colunas do layout, nada cortado, tudo tocável; › SC-001: pelo menos 4 pratos inteiros na tela depois do topo (spec 016) |
| Letra do aparelho em 200% | `telas/customer-menu.spec.ts` › cardápio: seções, cartões nas colunas do layout, nada cortado, tudo tocável (com `expectReadableAt200`); › tela do prato de um produto sem foto e com descrição de 300 caracteres |
| Girar não perde o carrinho nem o lugar; fotos carregam perto da tela | `telas/customer-menu.spec.ts` › cardápio: fotos só carregam perto da tela e girar o aparelho mantém o carrinho; `cmp/ordering/menu-app.test.tsx` › volta ao que estava no topo quando a largura muda |
| Acesso de 20 minutos desde a leitura; usar não renova | `dom/ordering/menu-access.test.ts` › fecha 20 minutos depois da leitura; › usar o cardápio não aumenta o tempo: o prazo só depende da leitura; `int/ordering/menu-access.test.ts` › cada leitura do QR code abre 20 minutos, com IP e navegador; usar não renova |
| "Faltam N min", aviso dos 2 minutos com carrinho, "Seu tempo acabou" | `cmp/ordering/access-timer.test.tsx` › avisa nos 2 últimos minutos só se tiver coisa sem enviar; › no fim mostra 'Seu tempo acabou' com o que não foi enviado |
| O servidor conta o tempo; envio vale até 15 s depois | `cmp/ordering/access-timer.test.tsx` › conta pelo relógio do servidor, não pelo do celular; `int/ordering/submit-order.test.ts` › aceita até 15 s depois do prazo; depois disso pede para escanear de novo |
| Nova leitura no mesmo celular encerra a anterior | `int/ordering/menu-access.test.ts` › nova leitura no mesmo celular encerra o acesso anterior |
| Até 10 pedidos por acesso | `dom/ordering/order-lines.test.ts` › até 10 pedidos por acesso; o seguinte pede para chamar o garçom; `cmp/ordering/menu-app.test.tsx` › sem pedidos restantes no acesso, pede para chamar o garçom |
| Carrinho até 30 linhas e até 20 de cada | `dom/ordering/order-lines.test.ts` › pedido tem de 1 a 30 linhas; › quantidade inteira de 1 a 20 |
| Enviar mostra o resumo; Confirmar envia | `cmp/ordering/cart.test.tsx` › confirma com o resumo e envia; sucesso limpa o carrinho |
| Sem pedido em dobro | `int/ordering/submit-order.test.ts` › o mesmo clientRequestId devolve o mesmo pedido (toque duplo); `cmp/ordering/cart.test.tsx` › nova tentativa depois de falha reusa o mesmo clientRequestId |
| Preço que mudou: avisa e pede nova confirmação | `dom/ordering/checkout.test.ts` › preço do produto mudou → PRICE_CHANGED com os preços novos; nada é aceito (US2-10); `cmp/ordering/cart.test.tsx` › preço mudado: avisa, atualiza o carrinho e pede nova confirmação |
| Produto que saiu é tirado do carrinho | `dom/ordering/checkout.test.ts` › produto que saiu do cardápio (esgotado, inativo, sem preço) → PRODUCT_UNAVAILABLE com a lista (US2-11); `cmp/ordering/cart.test.tsx` › produto indisponível: avisa e tira do carrinho |
| Preço gravado no pedido | `int/ordering/submit-order.test.ts` › pedido enviado não muda quando o adicional muda depois; › grava o pedido, as linhas com a versão e as escolhas copiadas, e o evento |
| Número por restaurante e por dia, desde 1 | `int/ordering/submit-order.test.ts` › número do dia 1, 2, 3; dois envios ao mesmo tempo não repetem; recomeça no dia seguinte |
| Sem dado pessoal; só o restaurante dono da mesa | `int/ordering/menu.test.ts` › nada de outro restaurante entra no cardápio; `int/ordering/isolation.test.ts` › as funções do QR code devolvem só o mínimo e o token de B leva só a B |

### 03 — Cozinha e garçom

| Regra | Teste |
|---|---|
| Só para frente, um passo por vez; Entregue e Cancelado são finais | `dom/ordering/order.test.ts` › anda um passo por vez: Recebido → Em preparo → Pronto → Entregue; › não pula etapa nem volta; › entregue e cancelado são finais |
| Cada mudança grava quem e quando; pedido e linhas não mudam depois do envio | `int/ordering/kitchen.test.ts` › avança Recebido → Em preparo → Pronto → Entregue, com trava e eventos de quem fez; `int/ordering/schema.test.ts` (APPEND_ONLY de pedidos e linhas) |
| Duas telas: a segunda vê "Este pedido mudou em outra tela." | `src/actions/kitchen.test.ts` › versão velha vira 'Este pedido mudou em outra tela.' e a tela recarrega (novo nesta spec); `int/ordering/kitchen-edges.test.ts` › garçom que lançou: versão velha com o pedido ainda Recebido é STALE_RECORD |
| Três colunas, o mais antigo primeiro | `int/ordering/kitchen.test.ts` › cozinha vê os pedidos abertos, mais antigo primeiro, com as mudanças e o atraso; `telas/operations.spec.ts` › quadro com pedido recebido e o cancelamento aberto |
| Mesa em destaque, quem lançou, número, tempo e mudanças | `cmp/ordering/kitchen-board.test.tsx` › mostra mesa, número, há quanto tempo e as mudanças embaixo do produto; › quem lançou embaixo da mesa e a observação em destaque (spec 015, US2) |
| Pedido novo sozinho em até 10 s, marcado Novo | `cmp/ordering/auto-refresh.test.tsx` › atualiza a cada intervalo com a aba à vista; `cmp/ordering/kitchen-board.test.tsx` › pedido que chega depois aparece como 'Novo' |
| Atrasado há mais de 20 min, em texto | `dom/ordering/order.test.ts` › mais de 20 minutos sem ficar pronto; `cmp/ordering/kitchen-board.test.tsx` › 'Atrasado' em texto, não só em cor |
| Cancelar com motivo da lista; "Outro" pede o texto | `int/ordering/kitchen.test.ts` › cancela com motivo; 'Outro' pede o texto; pedido final não muda; `dom/ordering/order.test.ts` › motivo fora da lista é recusado |
| Esgotado hoje: sai do cardápio só hoje; preparo não esgota | `int/ordering/sold-out.test.ts` › tira do cardápio hoje e volta sozinho amanhã; o produto continua ativo; › preparo não esgota; garçom não marca; vai para a auditoria |
| Baixa no Começar preparo, uma vez só, nunca segura o pedido | `int/billing/sale.test.ts` › tocar duas vezes ou em duas telas baixa uma vez só; `int/ordering/staff-orders.test.ts` › cancelar e Começar preparo ao mesmo tempo: só um vale e o estoque nunca baixa de cancelado |
| Cancelar recebido: nada no estoque; em preparo ou pronto pergunta (padrão Sim) | `int/billing/cancel-stock.test.ts` › pedido só recebido: cancelar não mexe no estoque e não pergunta nada; › em preparo ou pronto sem dizer se os ingredientes foram usados: recusa e nada muda; `cmp/ordering/kitchen-board.test.tsx` › cancelar pedido em preparo ou pronto pergunta se os ingredientes já foram usados (padrão Sim) |
| O cancelado sai do total da conta | `int/billing/cancel-stock.test.ts` › a conta da mesa muda de versão e o pedido cancelado sai do total |
| Garçom: só os prontos, mesa grande, quem lançou, observação; Só os meus; Entregue tira | `cmp/ordering/ready-list.test.tsx` › mostra a mesa em destaque e o botão 'Entregue'; › mostra quem lançou e a observação (spec 015, US5); `int/ordering/staff-orders.test.ts` › cozinha e Garçom mostram a origem e a observação; Só os meus filtra os prontos; `telas/operations.spec.ts` › prontos para levar com um pedido pronto |
| Consulta: período até 31 dias, mesa, situação, Lançado por; resumo por quem lançou | `int/ordering/orders.test.ts` › lista pedidos do período, por mesa e situação, e mostra um pedido com os eventos; `int/ordering/staff-orders.test.ts` › consulta filtra por Lançado por e resume por origem, com cancelados por motivo (SC-005) |
| Quem não é da cozinha não muda nem cancela | `int/ordering/kitchen.test.ts` › estoquista não vê nada; garçom não vê a cozinha nem cancela; `int/ordering/kitchen-edges.test.ts` › a cozinha só move para Em preparo ou Pronto; quem não é da cozinha é FORBIDDEN antes |

### 04 — Adicionar e tirar

| Regra | Teste |
|---|---|
| Nome de até 40 letras, sem repetir entre ativos | `dom/ordering/addon.test.ts` › nome de 1 a 40 caracteres; `int/ordering/addons.test.ts` › recusa nome repetido sem diferenciar acentos, preço inválido e medida de outra família |
| Item ou preparo, com quantidade e medida da mesma família | `dom/ordering/addon.test.ts` › pode usar um preparo (US1-4), mas não um produto vendido; › medida da mesma família da do item (US1-3); › quantidade maior que zero com até 4 casas |
| Preço zero ou mais; zero é Grátis | `dom/ordering/addon.test.ts` › zero é permitido (Grátis); negativo e 3 casas não; `cmp/ordering/addon-form.test.tsx` › preço zero aparece como Grátis |
| Custo de uma vez, % do preço e faixa | `int/ordering/addons.test.ts` › cadastra 'Fatia de queijo' e mostra custo, % do preço e faixa; › adicional de preparo usa o custo do preparo |
| Inativado, não apagado; inativo some; pedidos antigos não mudam | `int/ordering/addons.test.ts` › edita com trava otimista, inativa e reativa; o preço vai para a auditoria; `int/ordering/submit-order.test.ts` › pedido enviado não muda quando o adicional muda depois |
| Só o gerente escreve; o chef vê | `int/ordering/addons.test.ts` › chef lê; só o gerente escreve, e a tentativa negada fica registrada; `int/ordering/customization.test.ts` › chef vê o quadro mas não muda |
| Quadro: adicionais com máximo 1 a 5; retiradas do próprio produto; até 10 de cada | `dom/ordering/customization.test.ts` › aceita adicionais ativos com máximo de 1 a 5 e retiradas do próprio produto; › máximo fora de 1 a 5; › sem repetir e até 10 de cada |
| Salvar o quadro não cria versão | `int/ordering/customization.test.ts` › liga adicionais e retiradas, com texto padrão 'Sem …', sem criar versão nova |
| Versão nova tira o ingrediente: o quadro avisa | `int/ordering/customization.test.ts` › retirada fica 'órfã' quando a versão nova do produto tira o ingrediente; `cmp/ordering/product-customization.test.tsx` › avisa quando o ingrediente saiu do produto |
| Preço do prato soma os adicionais (2 × R$ 34,00) | `dom/ordering/customization.test.ts` › 28,00 + 2 × Fatia de queijo 3,00 = 34,00 por unidade; › tirar não dá desconto e adicional grátis não muda o preço |
| Cozinha e consulta mostram "+ 2 Fatia de queijo" e "SEM cebola" | `cmp/ordering/cart-state.test.ts` › escolhas no texto da cozinha, sem 'SEM sem'; `e2e/ordering.spec.ts` › do QR code da mesa à entrega, com adicionar e tirar por botão (specs 009 e 010) |
| O pedido guarda cópia do adicional | `int/ordering/submit-order.test.ts` › grava o pedido, as linhas com a versão e as escolhas copiadas, e o evento |
| Consumo: ficha do envio − retiradas + adicionais × vezes, × quantidade | `dom/ordering/consumption.test.ts` › exemplo da spec: 2 X-Burger, + 2 Fatia de queijo (20 g), sem cebola; › adicional de preparo desce até os ingredientes; `int/ordering/consumption.test.ts` › 2 × X-Burger + 2 Fatia de queijo, sem cebola: pão 2, carne 0,3 kg, queijo 0,14 kg, nada de cebola |

### 05 — Conta da mesa e caixa

| Regra | Teste |
|---|---|
| A conta abre sozinha no primeiro pedido, com a taxa do restaurante daquele momento | `int/billing/tab-open.test.ts` › primeiro pedido abre a conta com a taxa do restaurante; o histórico diz que o cliente abriu; › mudar a taxa do restaurante não muda a conta aberta; vale para a próxima conta |
| No máximo uma conta aberta por mesa; todo pedido entra nela | `int/billing/tab-open.test.ts` › os pedidos seguintes da mesa, de qualquer celular, entram na mesma conta e mudam a versão; › dois envios ao mesmo tempo numa mesa sem conta abrem uma conta só; `int/ordering/staff-orders.test.ts` › QR code e equipe ao mesmo tempo na mesa sem conta abrem uma conta só (SC-003) |
| Tela Caixa: mesa, há quanto tempo, total, falta/pago/pago a mais, não entregues | `int/billing/tabs.test.ts` › lista as mesas com conta aberta: total com a taxa, há quanto tempo e pedidos não entregues; `cmp/billing/open-tabs.test.tsx` › diz quanto falta, se pagaram a mais, e nada sobre a cozinha quando tudo foi entregue (spec 018) |
| A conta: pedidos com as mudanças, cancelado riscado e fora do total, pagamentos e histórico | `int/billing/tabs.test.ts` › a conta tem as linhas com as mudanças, o cancelado riscado com o motivo, a taxa, o total e o que falta; `cmp/billing/tab-detail.test.tsx` › histórico em ordem, com hora, o que aconteceu e quem fez; `telas/operations.spec.ts` › Conta da mesa com pagamento, divisão e taxa |
| Subtotal, serviço em centavos (meio centavo para cima), total, pago, falta | `dom/billing/tab.test.ts` › subtotal soma os pedidos menos os cancelados; total = subtotal + taxa; › pago ignora pagamento tirado; falta = total − pago; `dom/billing/service-charge.test.ts` › meio centavo arredonda para cima; menos que meio, para baixo |
| Não entregue entra no total, mas segura o fechamento | `dom/billing/tab.test.ts` › pedido ainda não entregue entra no total; › pedido ainda não entregue: PENDING_ORDERS com quantos |
| Taxa do restaurante: só gerente, 0% a 20% com 2 casas, vazio desliga, começa em 10% | `int/billing/service-charge.test.ts` › começa em 10%; o gerente muda para 12,5% ou desliga, com auditoria; › fora de 0 a 20% ou com mais de 2 casas é recusado; versão antiga também; › só o gerente muda a porcentagem; o caixa é recusado |
| Taxa da conta: tirar e pôr de volta, com confirmação, quem e quando | `int/billing/service-charge.test.ts` › tirar zera a taxa só nessa conta e o histórico diz quem e quando; pôr de volta desfaz; › só gerente e caixa tiram a taxa; garçom é recusado e fica na auditoria |
| Não tira a taxa se o pago passaria do novo total | `int/billing/service-charge.test.ts` › tirar é recusado se o que já foi pago passaria do novo total |
| Pagamento: já vem com o que falta; > 0, 2 casas, até o que falta; cinco formas | `cmp/billing/payment-form.test.tsx` › cinco formas e o valor já vem com o que falta; `dom/billing/payment.test.ts` › valor maior que zero, com até 2 casas; › o valor não passa do que falta: PAYMENT_EXCEEDS_REMAINING com quanto falta |
| Dinheiro: recebido e troco | `dom/billing/payment.test.ts` › em dinheiro, troco = recebido − valor: falta R$ 24,93, recebe R$ 50,00, troco R$ 25,07; › recebido menor que o valor: RECEIVED_TOO_LOW |
| Vários pagamentos de formas diferentes | `int/billing/payments.test.ts` › cinco formas somam no pago, o falta cai até zero e o histórico guarda cada uma |
| Toque duplo não lança duas vezes; duas telas nunca passam do total | `int/billing/payments.test.ts` › toque duplo (mesmo pedido de pagamento) devolve o mesmo pagamento, uma vez só; › dois caixas pagando ao mesmo tempo nunca passam do total |
| Tirar pagamento: confirmação; fica riscado com quem e quando | `int/billing/payments.test.ts` › grava quem tirou e quando, o falta volta e o pagamento continua na lista como tirado; `cmp/billing/payment-form.test.tsx` › tirar pede confirmação e só então envia |
| Pagar e tirar exigem o caixa aberto (014) | `int/billing/edges.test.ts` › sem caixa aberto, não lança pagamento; › tirar com o caixa já fechado é recusado e diz que a ação era tirar |
| Dividir em partes iguais (2 a 20) sobre o que falta; centavos na primeira | `dom/billing/split.test.ts` › R$ 74,80 por 3 (conta da mesa 12 com serviço): 24,94 + 24,93 + 24,93; › de 2 a 20 pessoas, número inteiro; `cmp/billing/split-helper.test.tsx` › mudar o número de pessoas no meio refaz as partes sobre o que falta |
| Valor livre a qualquer momento | `cmp/billing/split-helper.test.tsx` › valor livre antes de dividir: a divisão é feita sobre o que falta |
| Fechar só com falta zero e tudo entregue ou cancelado, com o motivo | `int/billing/close.test.ts` › ainda falta pagar: recusa e diz quanto; › pedido ainda não entregue: recusa e diz quantos; `cmp/billing/payment-form.test.tsx` › desabilitado com o motivo enquanto falta pagar ou há pedido não entregue |
| Fechar grava quem, quando e os valores; libera a mesa | `int/billing/close.test.ts` › falta zero e tudo entregue: grava os valores, quem e quando, e a mesa sai do caixa; › os celulares da mesa fechada… não pedem mais: o cardápio avisa que a conta foi fechada |
| O próximo pedido abre conta nova | `int/billing/close.test.ts` › o próximo pedido pelo QR code da mesa abre uma conta nova, vazia |
| Tudo cancelado: R$ 0,00, fecha sem pagamento | `int/billing/close.test.ts` › conta com todos os pedidos cancelados (total zero) fecha sem pagamento |
| Pedido no instante do fechamento: entra antes ou abre conta nova | `int/billing/close.test.ts` › pedido que entrou depois da tela carregada: 'a conta mudou'; `int/ordering/tablet-submit.test.ts` › pedido do tablet × fechar a conta (20 rodadas): nunca fica fora de conta |
| Pago a mais segura o fechamento e diz o que fazer | `cmp/billing/tab-detail.test.tsx` › pago a mais (pedido cancelado depois de pago) diz quanto e o que fazer; `cmp/billing/payment-form.test.tsx` › pago a mais também segura o fechamento |
| Mesa inativada com conta aberta ainda fecha | `int/billing/close.test.ts` › mesa inativada com a conta aberta ainda fecha |
| Imprimir: restaurante, mesa, data, linhas não canceladas, totais, "Não é documento fiscal" | `cmp/billing/tab-print.test.tsx` › restaurante, mesa, data, linhas com as mudanças e o valor de cada linha; › pedido cancelado não sai na conta impressa; › subtotal, taxa, total e o aviso de que não é documento fiscal |
| Contas fechadas: até 31 dias, por mesa, dia local; lista e resumo por forma | `int/billing/history.test.ts` › período de até 31 dias, com o início antes do fim; › filtra por mesa; › o dia da conta é o dia local do restaurante em que ela fechou; › resumo por forma de pagamento sem os pagamentos tirados, com o total da taxa e o total |
| Reabrir: só gerente, com motivo; volta com os pagamentos; histórico guarda o antes | `int/billing/history.test.ts` › gerente reabre com motivo: volta aberta com os pagamentos e o histórico guarda os valores de antes; › só o gerente reabre; conta aberta não reabre; versão antiga é recusada |
| Mesa com outra conta aberta não reabre | `int/billing/history.test.ts` › mesa que já abriu outra conta: feche a nova antes |
| Quem pode (tab.read, tab.pay, tab.history, tab.reopen, tab.settings) | `dom/access/permissions.test.ts` › caixa vê o caixa, recebe, fecha e consulta contas e pedidos; não vê estoque nem cozinha; `int/billing/history.test.ts` › garçom abre a conta aberta, mas não a fechada, nem pelo link (FR-010) |
| Ligação com o estoque | ver **06 — Movimentações** acima |
