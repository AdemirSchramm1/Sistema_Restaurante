# Feature 018 — Validar o estoque, a conta e o pedido com a mesma régua do cardápio e do caixa

**Branch**: `claude/project-thread-oukdi6` · **Criada**: 2026-11-26 · **Status**: em revisão

**Pedido do dono** (2026-11-26): "revise todo o meu projeto do github e descubra quais partes estão
faltando serem feitas e validadas". Da revisão saíram três frentes; o dono escolheu fazer primeiro
a frente 1 (validar os módulos antigos), depois a 2 (operação pequena e relatório de auditoria),
sem deploy por enquanto.

## Contexto

As features 013 a 016 (cardápio, caixa do dia, pedido pelo garçom, tablet) entraram com uma régua
dura: 100% das linhas, desvios e funções cobertos, 100% no teste de mutação (todo mutante criado no
código tem de ser pego por algum teste) e testes de tela em 9 tamanhos, claro e escuro.

As features 001 a 011, que guardam o dinheiro do restaurante (custo médio, conversão de medidas,
custo dos produtos, conta da mesa, divisão, troco, taxa de serviço, baixa do estoque pelo pedido),
ficaram com a régua anterior: 95% das linhas do domínio, 90% dos desvios e nenhum teste de mutação.

Em 2026-11-26 o teste de mutação rodado sobre esse código deu **80,8%**: de 2.314 mutantes, 396
sobreviveram e 44 nem são tocados por teste. Cerca de 180 deles mudam uma condição ou uma conta e
nenhum teste percebe. Exemplos:

- Dividir a conta: dá para apagar a recusa de valor negativo ou com mais de 2 casas e nenhum teste
  falha.
- Custo médio: o caso de item com saldo e sem custo médio não é testado.
- Decimal (78%), conversão de medidas (76%), fichas (77%), movimentações (83%), adicionais (79%).

Relatório completo da revisão:
[Revisão do Sistema Restaurante](https://claude.ai/artifact/8eJy5Rd5dxhvmFJh82k5Lx).

Esta feature **não muda o que o sistema faz**. Ela prova, com testes, que o que já existe faz o que
`docs/produto/` diz. Onde um teste novo mostrar que o sistema está errado, o sistema é corrigido
(teste primeiro), e não o teste.

## Histórias

### US1 — Conta da mesa e pagamento provados centavo a centavo (P1)

Como dono, quero ter certeza de que a conta da mesa, a taxa de serviço, a divisão e o troco nunca
erram um centavo, porque é dinheiro do cliente e do restaurante.

**Por que P1**: um erro aqui aparece na frente do cliente e no fechamento do caixa.

**Teste independente**: rodar o teste de mutação só no código da conta da mesa e ver 100%; apagar
à mão qualquer checagem de valor da divisão ou do pagamento e ver algum teste falhar.

**Cenários**

1. Dado o código das regras da conta (total, taxa de serviço, pagamento, troco, divisão, fechar e
   reabrir), quando roda o teste de mutação, então todo mutante é pego (100%).
2. Dado o código que lê o banco e grava a conta (lançar e tirar pagamento, tirar e pôr a taxa,
   fechar, reabrir, contas fechadas), quando rodam os testes de unidade e de integração juntos,
   então 100% das linhas, desvios e funções são exercitados.
3. Dividir R$ 100,00 por 3 continua dando R$ 33,34 + R$ 33,33 + R$ 33,33, e um valor negativo ou com
   3 casas é recusado com o motivo que a tela mostra.

### US2 — Estoque e custo provados (P1)

Como dono, quero ter certeza de que o saldo, o custo médio, a conversão de medidas, o custo dos
produtos e o aviso de reposição estão certos, porque é com eles que compro e defino preço.

**Por que P1**: um custo médio errado contamina o custo de todo produto e o painel de Custos.

**Teste independente**: rodar o teste de mutação no código do estoque e ver 100%.

**Cenários**

1. Dado o código das regras do estoque (medidas e conversão, custo médio, compra, perda, acerto e
   estorno, fichas e preparos, custo do produto, reposição, relatório de saídas, código e descrição
   do item, árvore padrão de grupos, motivos de perda), quando roda o teste de mutação, então todo
   mutante é pego.
2. Dado o código que lê e grava o estoque (itens, lançamentos, produtos, custos, repor, gráficos,
   venda pelo pedido), quando rodam unidade e integração juntos, então 100% das linhas, desvios e
   funções são exercitados.
3. Item com saldo e sem custo médio, compra que zera o saldo, estorno que volta à média anterior com
   8 casas: cada caso tem teste nomeado pela regra.

### US3 — Pedido do cliente, adicionais, fornecedores e decimal provados (P2)

Como dono, quero ter certeza de que o preço do pedido com adicionais e retiradas, o consumo que
baixa o estoque, o CNPJ do fornecedor e as contas com decimal estão certos.

**Por que P2**: já tem cobertura alta de linhas; o que falta é provar que os testes pegam erro.

**Teste independente**: rodar o teste de mutação no código do pedido (o que ainda não está na
régua), dos fornecedores e do decimal e ver 100%.

**Cenários**

1. Dado o código das regras do pedido que ainda está fora da régua (adicionais, montar o prato,
   envio, situação do pedido, linhas, consumo para a baixa, cardápio, dia de operação, nome da
   mesa), quando roda o teste de mutação, então todo mutante é pego.
2. O mesmo para fornecedores (cadastro, CNPJ) e para o código comum (decimal, auditoria).
3. Dado o código que lê e grava pedidos, mesas, adicionais e fornecedores, unidade e integração
   juntos exercitam 100% das linhas, desvios e funções.

### US4 — Telas que faltam provar (P2)

Como dono, quero que as telas usadas o dia inteiro em tablet e celular passem pelos mesmos testes
de tela do cardápio, para nada cortar, sobrepor ou rolar para o lado.

**Por que P2**: a cozinha roda em tablet e o caixa e o garçom em celular, e hoje essas telas só
passam pelo teste de layout geral.

**Teste independente**: rodar os testes de tela e ver Cozinha, Garçom, Conta da mesa e Lançamentos
em todos os tamanhos da matriz, claro e escuro, nos dois navegadores, sem erro.

**Cenários**

1. Cozinha, Garçom (prontos para entregar), Conta da mesa (com pagamentos, divisão e taxa) e
   Lançamentos passam nos 9 tamanhos da matriz, claro e escuro: nada rola para o lado, nenhum texto
   cortado, todo alvo de toque com pelo menos 44 px, contraste ok, imagem de referência igual.
2. As telas com menos de 80% dos desvios cobertos (nível do aviso de reposição do item, montar o
   prato, relatório de contas fechadas, preço de venda, formulário do fornecedor, moldura do app,
   rótulos do histórico) passam a ter 100% de linhas, desvios e funções.

### US5 — Cada mutante sobrevivente é tratado como possível erro do sistema (P1)

Como dono, quero que cada falha que os testes novos acharem seja olhada primeiro como erro do
sistema, para que os testes protejam o restaurante e não só fiquem verdes.

**Por que P1**: é a regra do projeto (testes protegem o app; quando um teste falha, primeiro
verificar se o app está errado).

**Teste independente**: abrir o registro de mutantes desta feature e ver, para cada grupo de
sobreviventes, se era erro do sistema (corrigido, com o teste que o reproduz) ou falta de teste.

**Cenários**

1. Para cada mutante sobrevivente, quem implementa decide e registra: (a) o sistema estava errado,
   corrige começando por um teste que falha; (b) faltava teste, escreve o teste da regra; (c) o
   código era inalcançável ou repetido, apaga o código. Nunca: apagar o teste, pular o teste ou
   tirar o arquivo da régua.
2. Todo erro do sistema achado aqui entra em `docs/produto/` se mudar uma regra, e fica listado no
   PR com o antes e o depois.

### Casos de borda

- Mutante equivalente (a mudança não altera nenhum resultado possível): o código é reescrito para
  não ter a forma ambígua; ele não é ignorado por configuração.
- Texto que a pessoa vê (nome de grupo da árvore padrão, motivo de perda, mensagem de erro) é
  comportamento: o teste confere o texto, porque trocar o texto muda o que aparece na tela.
- Código de erro devolvido pela regra é o que escolhe a mensagem da tela: o teste confere o código
  e o campo, não só que deu erro.
- O tempo da CI cresce com o teste de mutação maior. O job de mutação pode ser dividido em partes
  paralelas, como os testes de tela, mas a régua não baixa.

## Requisitos

- **FR-001** O teste de mutação da CI MUST cobrir todo o domínio (`src/domain/**`), com a mesma
  exigência de 100% que já vale para cardápio, caixa e pedido da equipe.
- **FR-002** A régua de cobertura MUST passar a 100% de linhas, desvios e funções, somando unidade e
  integração, para o código da conta da mesa (US1), do estoque (US2) e do pedido, adicionais,
  mesas e fornecedores (US3), do mesmo jeito que `test:menu`, `test:cash` e `test:staff`.
- **FR-003** As telas da US4, cenário 2, MUST chegar a 100% de linhas, desvios e funções.
- **FR-004** Cozinha, Garçom, Conta da mesa e Lançamentos MUST entrar nos testes de tela (9
  tamanhos, claro e escuro, dois navegadores), com imagens de referência tiradas na imagem oficial.
- **FR-005** Nenhum teste existente MUST ser apagado, pulado ou afrouxado; nenhum arquivo MUST sair
  de régua existente. Mudança no que um teste confere só quando o teste estava errado em relação a
  `docs/produto/`, e isso fica escrito no PR.
- **FR-006** Todo erro do sistema encontrado MUST ser corrigido com teste primeiro e listado no PR;
  se mudar regra, `docs/produto/` é atualizado no mesmo PR.
- **FR-007** Cada regra de `docs/produto/estoque/` e `docs/produto/pedidos/01` a `05` MUST ter pelo
  menos um teste nomeado pela regra (constituição, princípio I). As que não têm são listadas e
  ganham o teste.
- **FR-008** `docs/sistema/01-tdd.md`, `05-testes-de-tela.md` e `06-ci-cd.md` MUST descrever a régua
  nova e os comandos.
- **FR-009** O comportamento do sistema para quem usa MUST continuar o mesmo, exceto pelos erros
  corrigidos pela FR-006.

## Entidades

Nenhuma entidade nova de negócio. Artefatos novos:

- **Registro de mutantes**: para cada grupo de sobreviventes, o arquivo, o que o mutante mudava e a
  decisão (erro do sistema, falta de teste ou código removido).
- **Inventário de regras**: cada regra de `docs/produto/` (estoque e pedidos 01 a 05) e o nome do
  teste que a prova.

## Critérios de sucesso

- **SC-001** Teste de mutação de todo o domínio: 100% (era 80,8% no código fora da régua em
  2026-11-26), com zero mutantes sem teste.
- **SC-002** Cobertura de 100% (linhas, desvios, funções) na conta da mesa, no estoque e no pedido,
  medida como as réguas atuais.
- **SC-003** 4 telas novas nos testes de tela, cada uma em 9 tamanhos × claro e escuro × 2
  navegadores, sem falha.
- **SC-004** 100% das regras do inventário (FR-007) com teste nomeado.
- **SC-005** Todos os testes que existiam antes continuam no projeto e verdes; o número de testes
  só sobe.
- **SC-006** A CI do PR fica verde e o tempo total (do push ao último job) cresce no máximo 10
  minutos em relação ao `main` de 2026-11-22.

## Premissas

- "Validar" aqui é prova por teste automático. O aceite manual do dono no aparelho real fica para
  quando houver deploy (frente 3, adiada pelo dono em 2026-11-26).
- A régua de 100% em casos de uso inclui só código que lê e grava dados do restaurante; as telas
  de entrada (`app/`) continuam cobertas pelos testes ponta a ponta e de tela.
- Erros achados que mudem regra de negócio de forma visível (não só corrigir para o que o doc já
  diz) são levados ao dono antes de corrigir.
- Um PR para a feature inteira (`docs/sistema/06-ci-cd.md`).

## Dependências

Features 001 a 016 no `main` (3237ce7). Nenhuma migração de banco.

## Fora do escopo

Funcionalidade nova (operação pequena e relatório de auditoria são a próxima feature), deploy,
testes de carga, testes de segurança além dos que existem, mudança visual das telas.

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-26 | Por onde começar? | Dono: frente 1 (validar os módulos antigos), depois a 2; deploy fica de fora por enquanto |
| 2026-11-26 | Número da spec | 018: o 017 foi usado pelo comando de dados de demonstração, num branch que não vai para o `main` |
| 2026-11-26 | Mutante sobrevivente | Primeiro checar se o sistema está errado; nunca afrouxar teste nem tirar arquivo da régua (regra do dono) |
| 2026-11-26 | Quais telas entram nos testes de tela | Cozinha, Garçom, Conta da mesa e Lançamentos: as usadas o dia todo em tablet e celular (premissa, sem pergunta) |
