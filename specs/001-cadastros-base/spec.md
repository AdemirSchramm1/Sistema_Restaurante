# Feature Specification: Cadastros base do estoque (grupos, unidades, locais, itens)

**Feature Branch**: `001-cadastros-base`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "feature 001 — cadastros base (grupos, unidades, locais, itens)."

**Regras de negócio de referência** (esta spec referencia, não copia):
[01 — Grupos de itens](../../docs/produto/estoque/01-grupos-de-itens.md) ·
[02 — Cadastro de itens](../../docs/produto/estoque/02-cadastro-de-itens.md) ·
[05 — Locais](../../docs/produto/estoque/05-locais.md) ·
[07 — Regras sanitárias](../../docs/produto/estoque/07-regras-sanitarias.md) ·
[09 — Controles e permissões](../../docs/produto/estoque/09-controles-e-permissoes.md) ·
[Roadmap](../../docs/produto/estoque/00-visao-geral.md#roadmap)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar um item com as três unidades (Priority: P1)

O gerente (ou chef) cadastra um item do estoque — por exemplo "Tomate italiano, caixa 20 kg, tipo
AA" — escolhendo grupo, subgrupo e tipo, e informando a unidade de estoque (kg), a unidade de
receita (g) e a unidade de compra padrão (caixa de 20 kg, fator 20). O sistema gera o código
interno, mostra a conversão entre as três unidades e o item passa a aparecer na lista de itens.

**Why this priority**: o item é o alicerce de custo, compra, ficha técnica e contagem. Sem ele
nenhuma outra feature do roadmap (002 a 012) pode começar. A entrega do roadmap para a 001 é
justamente "itens com três unidades e conversão".

**Independent Test**: com a árvore padrão de grupos já existente, cadastrar um item com as três
unidades, conferir o código gerado, a conversão exibida (ex.: 2 caixas = 40 kg = 40.000 g) e
encontrar o item pela busca na lista.

**Acceptance Scenarios**:

1. **Given** o subgrupo "Hortifrúti > Legumes" (código 01.02) sem itens, **When** o usuário salva o
   item "Tomate italiano, caixa 20 kg, tipo AA" com estoque em kg, receita em g e compra "Caixa
   20 kg" com fator 20, **Then** o item recebe o código `01.02.0001` e aparece na lista com as três
   unidades.
2. **Given** um item com compra "Caixa com 12" e fator 12 em unidades, **When** o usuário consulta a
   conversão de 20 caixas, **Then** o sistema mostra 240 un.
3. **Given** um item cadastrado, **When** o usuário tenta editar o código, **Then** o campo não é
   editável.
4. **Given** já existe o item ativo "Tomate italiano, caixa 20 kg, tipo AA" no subgrupo, **When** o
   usuário tenta salvar "tomate  ITALIANO, caixa 20 kg, tipo aa" no mesmo subgrupo, **Then** o
   sistema recusa, informando que o item já existe e mostrando o código do item existente.
5. **Given** um item com estoque em "un" e receita em "g" (ex.: ovo), **When** o usuário tenta salvar
   sem informar quantos gramas tem uma unidade, **Then** o sistema exige essa conversão específica
   do item antes de salvar.
6. **Given** um item que já teve movimentação de estoque, **When** o usuário tenta trocar a unidade
   de estoque, **Then** o sistema bloqueia e orienta a inativar o item e criar outro.

---

### User Story 2 - Organizar itens por grupos e subgrupos (Priority: P1)

Ao começar a usar o sistema, o restaurante já encontra a árvore padrão de grupos (Hortifrúti,
Carnes e aves, Pescados, Laticínios, Congelados, Secos e mercearia, Padaria, Bebidas, Produção
própria, Embalagens de delivery, Descartáveis de produção, Higiene e limpeza, EPIs/utensílios/etc.),
cada um indicando se é alimentar e se entra no CMV. O gerente cria os subgrupos que faltarem e
ajusta, item a item, a indicação de "entra no CMV" quando necessário.

**Why this priority**: todo item exige grupo e subgrupo, e o código do item depende deles. Por isso
é P1 junto com a história 1 (a árvore padrão é o mínimo para a história 1 funcionar).

**Independent Test**: num restaurante novo, verificar que a árvore padrão existe, criar um subgrupo
"Cogumelos" em Hortifrúti, cadastrar um item nele e sobrescrever o "entra no CMV" do item, conferindo
o registro de quem alterou.

**Acceptance Scenarios**:

1. **Given** um restaurante recém-criado, **When** o gerente abre os grupos, **Then** encontra a
   árvore padrão do documento [01](../../docs/produto/estoque/01-grupos-de-itens.md#árvore-de-grupos-padrão)
   com códigos de 2 dígitos e as indicações "alimentar" e "entra no CMV".
2. **Given** a árvore padrão, **When** o gerente tenta apagar o grupo "Bebidas", **Then** o sistema
   recusa (grupos padrão não podem ser apagados).
3. **Given** o grupo Hortifrúti, **When** o gerente cria o subgrupo "Cogumelos", **Then** ele recebe o
   próximo código de 2 dígitos livre dentro do grupo.
4. **Given** um item do grupo "Higiene e limpeza" (não entra no CMV), **When** o gerente marca o item
   como "entra no CMV", **Then** o item passa a entrar no CMV e o sistema registra quem alterou,
   quando e o valor anterior.
5. **Given** um subgrupo com itens ativos, **When** o gerente tenta inativá-lo, **Then** o sistema
   recusa até que os itens sejam movidos ou inativados.

---

### User Story 3 - Cadastrar locais com nome real e rota de contagem (Priority: P2)

O gerente cadastra os locais com o nome que a equipe usa ("Câmara 1", "Estoque do bar", "Depósito
dos fundos"), o tipo (seco, refrigerado, congelado, quarentena, trânsito, químicos, praça, bar, não
alimentar), o responsável, a faixa de temperatura (quando refrigerado ou congelado) e a ordem na
rota de contagem. Depois vincula cada item aos locais onde ele fica, com um local padrão e a
posição do item na prateleira/folha.

**Why this priority**: locais são necessários para saldo (003) e contagem (006), mas um item pode
ser cadastrado e usado em fichas técnicas antes de ter local. Por isso vem depois das histórias 1 e 2.

**Independent Test**: cadastrar a "Câmara de carnes" (refrigerado, 0 a 4 °C), vincular três itens
com posições 1, 2 e 3, e ver a lista de itens do local na ordem das posições; tentar salvar um
refrigerado sem faixa e ver a recusa.

**Acceptance Scenarios**:

1. **Given** um restaurante recém-criado, **When** o gerente abre os locais, **Then** o local
   "Recebimento / quarentena" já existe e não pode ser apagado nem inativado.
2. **Given** o cadastro de um local do tipo refrigerado ou congelado, **When** o gerente tenta salvar
   sem faixa de temperatura, **Then** o sistema recusa e indica o campo obrigatório.
3. **Given** um local congelado, **When** o gerente informa faixa mínima maior que a máxima, **Then**
   o sistema recusa.
4. **Given** um item do grupo "Higiene e limpeza", **When** o gerente tenta vinculá-lo a um local de
   alimentos (seco, refrigerado, congelado, praça ou bar), **Then** o sistema recusa; e um item
   alimentar não pode ser vinculado a um local de químicos.
5. **Given** um item vinculado a dois locais, **When** o gerente marca um deles como padrão, **Then**
   o outro deixa de ser padrão (no máximo um local padrão por item).
6. **Given** um local com itens nas posições 3, 1 e 2, **When** o usuário abre a lista de itens do
   local, **Then** os itens aparecem na ordem 1, 2, 3; e a lista de locais aparece na ordem da rota
   de contagem.

---

### User Story 4 - Registrar dados de conservação, sanitários e fiscais do item (Priority: P3)

O chef ou gerente completa o cadastro do item com temperatura de conservação e faixa de
recebimento, validade fechado e após aberto, controle de lote, dias de alerta, alérgenos (lista da
RDC 727/2022, antiga RDC 26/2015), peso variável, fator de correção padrão, fator de rendimento, EAN/GTIN, NCM, CEST,
origem, frequência de contagem e se o item é inventariável.

**Why this priority**: são dados usados pelas features de recebimento (005), fichas técnicas (004),
contagem (006) e registros sanitários (010). Têm valor no cadastro, mas o item já é útil sem eles.

**Independent Test**: editar um item de carne, marcar peso variável, informar conservação ≤ 4 °C,
recebimento entre 4 e 7 °C, validade após aberto de 3 dias e o alérgeno "leite" (em um queijo),
salvar e conferir os dados.

**Acceptance Scenarios**:

1. **Given** um item, **When** o usuário seleciona alérgenos, **Then** só pode escolher da lista
   fechada da RDC 727/2022, antiga RDC 26/2015.
2. **Given** um item, **When** o usuário informa fator de correção menor que 1, **Then** o sistema
   recusa (FC ≥ 1).
3. **Given** um item, **When** o usuário informa fator de rendimento fora do intervalo maior que 0 e
   até 1 (ex.: chope 0,90), **Then** o sistema recusa.
4. **Given** um item, **When** o usuário tenta editar a curva ABC, o custo médio ou o último custo,
   **Then** esses campos aparecem só para leitura (são calculados por outras features).
5. **Given** um item sem código de barras, **When** o usuário marca "SEM GTIN", **Then** o sistema
   aceita e registra o item sem EAN.

---

### User Story 5 - Criar a conta do restaurante e montar a equipe (Priority: P1)

O dono cria a conta do restaurante, entra como gerente, convida as pessoas da equipe por e-mail e dá
a cada uma um ou mais papéis (gerente, chef, estoquista, comprador, administrativo). Cada pessoa
entra com o próprio login e só enxerga os dados do seu restaurante.

**Why this priority**: sem login e restaurante não há isolamento entre clientes do SaaS nem
registro de quem fez cada alteração (FR-004). Decidido pelo usuário em 2026-10-31 (resposta 1A):
entra na 001, no mínimo necessário.

**Independent Test**: criar dois restaurantes, convidar um chef em cada um, cadastrar um item em cada
e verificar que nenhum dos dois usuários vê o item do outro restaurante.

**Acceptance Scenarios**:

1. **Given** uma pessoa sem conta, **When** ela cria a conta do restaurante, **Then** o restaurante é
   criado com a árvore padrão de grupos e o local de quarentena, e ela entra como gerente.
2. **Given** um gerente, **When** ele convida um e-mail com o papel chef, **Then** a pessoa recebe o
   convite, define a senha e entra só com as permissões de chef.
3. **Given** um restaurante com um único gerente ativo, **When** alguém tenta remover o papel de
   gerente dele ou desativá-lo, **Then** o sistema recusa (sempre existe pelo menos um gerente ativo).
4. **Given** um usuário desativado, **When** ele tenta entrar, **Then** o acesso é negado, e o
   histórico do que ele fez continua com o nome dele.

---

### Edge Cases

- **Conversão entre dimensões diferentes sem conversão do item** (ex.: kg → un): o sistema recusa com
  a mensagem de que falta a conversão específica do item.
- **Frações**: 120 limões de uma caixa de 240 equivalem a 0,5 caixa; o sistema aceita e mostra
  frações sem arredondar no meio do cálculo (arredonda só na exibição).
- **Fator de compra zero ou negativo**: recusado; o fator deve ser maior que zero.
- **Descrição com acentos, maiúsculas e espaços duplos**: a comparação de duplicidade ignora essas
  diferenças ("Pão francês" = "pao  FRANCES").
- **Duplicidade com item inativo**: permitida (o item antigo inativo não impede um novo ativo de mesma
  descrição); reativar o antigo nessa situação é recusado.
- **Item movido de subgrupo**: o código original não muda (é imutável), mesmo que o prefixo deixe de
  corresponder ao novo subgrupo.
- **Subgrupo esgota a numeração** (9.999 itens): o sistema recusa novos itens e orienta criar outro
  subgrupo.
- **Apagar item ou local**: não existe exclusão definitiva de item ou local; eles são inativados.
  Item inativo não aparece para novos lançamentos, mas continua no histórico e nos relatórios.
- **Inativar local com itens vinculados ou que seja padrão de algum item**: recusado até que os
  vínculos sejam removidos ou outro local vire padrão.
- **Dois usuários editando o mesmo item ao mesmo tempo**: o segundo a salvar é avisado de que o item
  mudou e precisa revisar antes de gravar (sem perda silenciosa de alteração).
- **Cliente do restaurante** (quem vai ler o QR code da mesa no futuro) não é usuário do sistema e
  não tem acesso a nenhum cadastro desta feature.
- **Usuário de outro restaurante** tenta abrir um item por link direto: o sistema responde como se o
  item não existisse.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e restaurante (tenant)**

- **FR-001**: O sistema MUST garantir que todo grupo, subgrupo, local e item pertence a exatamente um
  restaurante, e que nenhum usuário lê ou grava dados de um restaurante ao qual não pertence.
- **FR-002**: O sistema MUST permitir criar a conta de um restaurante (quem cria vira gerente), entrar
  com e-mail e senha, recuperar a senha, convidar usuários por e-mail, atribuir e retirar papéis
  (gerente, chef, estoquista, comprador, administrativo; um usuário pode ter mais de um) e desativar
  usuários. Todo restaurante MUST ter sempre pelo menos um gerente ativo.
- **FR-003**: Permissões de cadastro MUST seguir esta tabela (resposta 2A do usuário, 2026-10-31):

  | Papel | Pode | Não pode |
  |---|---|---|
  | Gerente | Tudo: usuários e papéis, grupos, subgrupos, locais, itens, vínculos item-local, sobrescrita de "entra no CMV" | – |
  | Chef | Criar, editar, inativar e reativar itens (inclusive dados de conservação, sanitários e alérgenos) | Grupos, subgrupos, locais, vínculos item-local, "entra no CMV", usuários |
  | Estoquista, comprador, administrativo | Consultar grupos, locais e itens | Qualquer alteração de cadastro nesta feature |

  Tentativa sem permissão é recusada e registrada na auditoria. As permissões valem também para
  acesso direto (sem passar pela tela).
- **FR-004**: Toda criação, edição, inativação e reativação de grupo, subgrupo, local, item e vínculo
  item-local MUST registrar usuário, data/hora, origem e os valores anteriores e novos dos campos
  alterados, consultáveis no histórico do registro.

**Unidades**

- **FR-005**: O sistema MUST oferecer um catálogo de unidades de medida comum a todos os
  restaurantes, com no mínimo kg, g, l, ml e un, cada uma em uma dimensão (massa, volume ou
  contagem) com fator para a unidade base da dimensão (g, ml, un).
- **FR-006**: O sistema MUST converter quantidades entre unidades da mesma dimensão de forma exata
  (ex.: 1,5 kg = 1.500 g), sem perda por arredondamento intermediário.
- **FR-007**: O sistema MUST permitir, por item, conversões específicas entre dimensões diferentes
  (ex.: 1 un de ovo = 50 g) e MUST recusar conversão entre dimensões sem essa conversão cadastrada.

**Grupos e subgrupos**

- **FR-008**: Todo restaurante novo MUST receber a árvore padrão de grupos (e subgrupos de exemplo)
  do documento 01, com código de 2 dígitos, indicação "alimentar" e indicação "entra no CMV" por
  grupo.
- **FR-009**: O gerente MUST poder criar novos grupos e subgrupos; o código de 2 dígitos é gerado pelo
  sistema (único no restaurante para grupos, único dentro do grupo para subgrupos) e não é editável.
- **FR-010**: Grupos da árvore padrão MUST NOT ser apagados nem inativados. Grupos e subgrupos criados
  pelo restaurante podem ser inativados apenas se não tiverem itens ativos.
- **FR-011**: O nome de grupos e subgrupos MAY ser editado; o código não.

**Locais**

- **FR-012**: O gerente MUST poder cadastrar locais com nome, tipo (seco, refrigerado, congelado,
  quarentena, em trânsito, químicos, praça, bar, não alimentar), responsável, faixa de temperatura
  mínima e máxima e ordem na rota de contagem.
- **FR-013**: Local refrigerado ou congelado MUST ter faixa de temperatura, com mínima menor ou igual
  à máxima; sem isso não pode ser salvo.
- **FR-014**: Todo restaurante MUST ter o local "Recebimento / quarentena", criado automaticamente,
  que não pode ser apagado nem inativado. Os demais locais sugeridos do documento 05 são oferecidos
  como modelo opcional no primeiro acesso.
- **FR-015**: Nome de local MUST ser único entre os locais ativos do restaurante.
- **FR-016**: O sistema MUST listar os locais na ordem da rota de contagem e, dentro de cada local, os
  itens vinculados na ordem da posição na folha.

**Itens**

- **FR-017**: Todo item MUST ter exatamente um grupo, um subgrupo e um tipo (insumo, revenda,
  produzido, consumo, patrimônio).
- **FR-018**: O sistema MUST gerar o código do item no formato `GG.SS.NNNN` (grupo, subgrupo e
  sequencial de 4 dígitos dentro do subgrupo), único e imutável.
- **FR-019**: O sistema MUST recusar dois itens ativos com a mesma descrição normalizada (sem
  diferença de maiúsculas, acentos e espaços repetidos) no mesmo subgrupo.
- **FR-020**: Todo item MUST ter unidade de estoque e unidade de receita; e MUST ter uma unidade de
  compra padrão composta de nome da embalagem (ex.: "Caixa 12 un.") e fator de conversão maior que
  zero, expresso em unidades de estoque por unidade de compra.
- **FR-021**: Quando a unidade de receita for de dimensão diferente da unidade de estoque, o item MUST
  ter a conversão específica correspondente (FR-007) para ser salvo.
- **FR-022**: O sistema MUST mostrar, no cadastro do item, a equivalência entre as três unidades
  (ex.: 1 caixa = 20 kg = 20.000 g) e permitir simular a conversão de uma quantidade qualquer,
  aceitando frações.
- **FR-023**: A unidade de estoque MUST ficar bloqueada para edição depois da primeira movimentação do
  item; a tentativa é recusada com orientação para inativar o item e criar outro.
- **FR-024**: A indicação "entra no CMV" do item MUST vir do grupo e MAY ser sobrescrita no item; a
  sobrescrita é registrada conforme FR-004 e pode ser desfeita (volta a seguir o grupo).
- **FR-025**: O item MUST aceitar os campos opcionais: EAN/GTIN da unidade e da embalagem (ou "SEM
  GTIN"), categoria financeira, apresentação e peso líquido/drenado, peso variável, fator de correção
  padrão (≥ 1, padrão 1), fator de rendimento (> 0 e ≤ 1), temperatura máxima de conservação, faixa
  de temperatura de recebimento, validade fechado e após aberto (em dias), controle de lote, dias de
  alerta de validade, alérgenos (lista fechada da RDC 727/2022, antiga RDC 26/2015), NCM, CEST, origem e grupo
  tributário, inventariável, frequência de contagem (por turno, diária, semanal, quinzenal, mensal,
  trimestral).
- **FR-026**: Custo médio, último custo, data de atualização de custo e curva ABC MUST aparecer no item
  somente para leitura; nesta feature ficam vazios até que as features 003 e 009 os calculem.
- **FR-027**: Itens e locais MUST NOT ser excluídos definitivamente; MUST poder ser inativados e
  reativados (respeitando FR-019 na reativação). Itens inativos não aparecem nas listas de seleção
  de novos lançamentos.
- **FR-028**: O usuário MUST poder vincular um item a vários locais, com no máximo um local padrão e
  uma posição na folha por vínculo.
- **FR-029**: O sistema MUST recusar vínculo de item do grupo "Higiene e limpeza" a local de
  alimentos (seco, refrigerado, congelado, praça, bar) e de item alimentar a local de químicos.
  Quarentena e em trânsito aceitam qualquer item.
- **FR-030**: A lista de itens MUST permitir buscar por código, descrição e EAN, e filtrar por grupo,
  subgrupo, tipo, local e situação (ativo/inativo).
- **FR-031**: Quando o usuário salva uma alteração em registro que outra pessoa alterou depois que ele
  abriu a tela, o sistema MUST avisar e não sobrescrever sem confirmação.
- **FR-032**: Todos os textos de interface MUST estar em português do Brasil, com números no formato
  brasileiro (vírgula decimal).

### Key Entities *(include if feature involves data)*

- **Usuário**: pessoa da equipe com login próprio; pertence a um restaurante; ativo ou desativado.
- **Papel**: gerente, chef, estoquista, comprador, administrativo; um usuário pode ter vários.
- **Restaurante**: dono de todos os dados desta feature; isola o que cada cliente vê.
- **Unidade de medida**: kg, g, l, ml, un; dimensão e fator para a unidade base. Comum a todos.
- **Grupo**: o que o item é, no nível mais alto (ex.: Carnes e aves); código de 2 dígitos, alimentar
  ou não, entra no CMV ou não, padrão ou criado pelo restaurante.
- **Subgrupo**: divisão do grupo (ex.: Bovinos); código de 2 dígitos dentro do grupo.
- **Local**: espaço físico real onde os itens ficam; tipo, responsável, faixa de temperatura, ordem
  de contagem, ativo/inativo.
- **Item**: produto controlado no estoque; código imutável, descrição padronizada, tipo, subgrupo,
  três unidades, dados de conservação, sanitários, fiscais e de contagem; custos e curva ABC só leitura.
- **Unidade de compra padrão do item**: nome da embalagem e fator para a unidade de estoque. A
  feature 002 acrescenta o fator por fornecedor.
- **Conversão específica do item**: equivalência entre dimensões diferentes válida só para o item
  (1 un de ovo = 50 g).
- **Vínculo item-local**: item, local, se é o padrão e posição na folha.
- **Registro de auditoria**: quem, quando, de onde, o quê, valores anteriores e novos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário treinado cadastra um item completo nas três unidades (sem os campos
  opcionais) em até 2 minutos.
- **SC-002**: 100% dos casos de conversão do manual dão o resultado esperado exato (20 caixas × 12 =
  240 un; 2 caixas × 12 = 24 un; 1,5 kg = 1.500 g; 120 limões de caixa de 240 = 0,5 caixa; kg → un
  sem conversão do item = recusa).
- **SC-003**: 0 casos de usuário de um restaurante vendo ou alterando dados de outro restaurante nos
  testes de isolamento.
- **SC-004**: 100% das tentativas de duplicar item ativo (mesma descrição normalizada no mesmo
  subgrupo) são recusadas.
- **SC-005**: Com um catálogo de 2.000 itens, a busca na lista de itens mostra resultados em até 1
  segundo para o usuário.
- **SC-006**: Um restaurante novo consegue, no primeiro acesso, ter a árvore de grupos, a quarentena
  e seus locais principais prontos em até 15 minutos, sem precisar de suporte.
- **SC-007**: 100% das alterações de cadastro podem ser explicadas pelo histórico (quem, quando,
  antes e depois).

## Assumptions

- **Fora do escopo desta feature**: fornecedores e fator por fornecedor (002), movimentações, saldo e
  cálculo de custo médio (003), fichas técnicas e herança de alérgenos (004), parâmetros de
  reposição — estoque de segurança, ponto de pedido, par, lead time (007), cálculo da curva ABC (009),
  leituras de temperatura e etiquetas (010), importação em massa de itens por planilha, login social
  ou SSO.
- **Cardápio digital por QR code na mesa** (informado pelo usuário em 2026-10-31): o cliente lê o QR
  code e vê o cardápio. É uma feature futura, fora do módulo de estoque e fora da 001. O cliente é
  um visitante sem login, não um papel de usuário. O cardápio deve sair das fichas técnicas e preços
  de venda (feature 004), não dos itens de estoque, então a 001 não precisa de nenhum campo para ele.
- Nesta feature cada usuário pertence a um único restaurante; um mesmo login em vários restaurantes
  (redes) fica para a feature 012.
- A regra de bloqueio da unidade de estoque (FR-023) é especificada e testada agora, mesmo que as
  movimentações só existam a partir da feature 003.
- Unidades de embalagem (caixa, saco, fardo, barril) não entram no catálogo de unidades de medida:
  são o nome da unidade de compra, sempre acompanhado do fator.
- A árvore padrão é criada por restaurante (cada um pode acrescentar subgrupos sem afetar os outros).
- Um restaurante corresponde a uma unidade física nesta feature; redes e cozinha central ficam para
  a feature 012 (o tipo de local "em trânsito" já existe, mas sem uso aqui).
- Dados fiscais (NCM, CEST etc.) são guardados como informados; a validação com o contador é
  responsabilidade do restaurante, e o sistema só checa o formato.
- Datas e horas da auditoria são exibidas no fuso do restaurante.
- O sistema é usado em navegador, em computador ou tablet, com conexão à internet.
