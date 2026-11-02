# Feature 003 — Produtos (o que o cliente pede e quanto de cada item usa)

**Branch**: `claude/project-thread-8lg7o1` · **Criada**: 2026-11-02 · **Status**: em implementação

## Contexto

Depois da [002](../002-simplificar-cadastro/spec.md), o item tem só uma medida. A quantidade usada
em cada prato saiu do item e vem para esta tela. Sem produtos cadastrados não existe baixa
automática (feature 005) nem custo do prato (feature 008). É a prioridade 1 do manual
([13-decisoes-adotadas](../../docs/produto/estoque/13-decisoes-adotadas.md#prioridade-de-implantação-conclusão-do-manual)).

Regras de negócio: [04-fichas-tecnicas](../../docs/produto/estoque/04-fichas-tecnicas.md).

## Histórias

### US1 — Cadastrar um produto com os itens que ele usa (P1)

Como dono do restaurante, quero dizer o que vai em cada prato, para o estoque saber o que baixar
quando o cliente pedir.

**Cenários**

1. Dado o menu, então vejo "Produtos" ao lado de "Itens" e "Grupos".
2. Dado o formulário de novo produto, quando informo "X-Burger" e adiciono pão 1 un, carne 150 g
   (item em kg) e queijo 30 g (item em kg), então o produto é salvo com três linhas.
3. Dado o item "Carne" controlado em kg, quando digito a quantidade, então posso escolher kg ou g;
   unidades de outra família (un, l, ml) não aparecem.
4. Dado uma linha com quantidade zero, vazia ou negativa, quando salvo, então aparece o erro no
   campo da quantidade.
5. Dado o mesmo item duas vezes no produto, quando salvo, então aparece "Este item já está no
   produto; some as quantidades numa linha só".
6. Dado um produto sem nenhuma linha, quando salvo, então aparece "Adicione pelo menos um item".
7. Dado um item inativo, então ele não aparece na busca de itens do produto.
8. Dado "X-Burger" ativo, quando crio outro "x-burger", então aparece o erro de nome repetido.

### US2 — Ver e corrigir um produto (P1)

1. A lista de produtos mostra nome, quantidade de itens e se está ativo; tem busca por nome.
2. Ao editar e salvar, o sistema guarda uma **nova versão** com a data; a versão anterior continua
   guardada (o pedido da feature 005 usa a versão vigente na data do pedido).
3. O histórico do produto mostra quem mudou o quê e quando.
4. Posso inativar e reativar o produto; inativo não aparece para pedidos.

### US3 — Ver quanto custa o produto (P2)

1. Cada linha mostra o custo (quantidade convertida para a medida do item × custo médio do item).
2. O produto mostra o custo total, a soma das linhas.
3. Se algum item ainda não tem custo (as compras só entram na feature 004), o total aparece como
   "Sem custo ainda" e a linha diz qual item falta.
4. Num preparo (US4), o custo mostrado é o do rendimento inteiro e o de cada medida (ex.: R$ 18,00
   por kg).

### US4 — Preparos usados dentro de outros produtos (P1, decidido pelo dono em 2026-11-02)

Como dono, quero cadastrar o molho, a massa ou o hambúrguer porcionado uma vez e usar dentro de
vários pratos, para não repetir a lista de ingredientes.

1. Ao criar um produto escolho o tipo: "Vendido ao cliente" ou "Preparo (usado dentro de outros
   produtos)".
2. O preparo pede "Quanto rende" (ex.: 2 kg de molho). O vendido não pede.
3. Na lista do que vai num produto aparecem os itens e os preparos ativos. "Molho de tomate" (rende
   2 kg) entra no X-Burger com 50 g.
4. Quando o cliente pede um X-Burger, o estoque baixa a parte proporcional dos ingredientes do
   molho: 50 g ÷ 2 kg = 1/40 de cada ingrediente (a baixa é a feature 005; aqui fica a regra de
   cálculo pronta e testada).
5. Um preparo pode usar outro preparo, mas nunca a si mesmo, nem por um caminho indireto
   (molho A usa B que usa A). Aparece "Este preparo acabaria usando a si mesmo".
6. Um produto vendido não pode ser usado dentro de outro.
7. Um preparo usado em produtos ativos não pode ser inativado, nem virar "Vendido", nem trocar a
   medida do rendimento para outra família (ex.: kg → un). Aparece em quais produtos ele está.

## Requisitos

- **FR-001** O produto guarda: nome, tipo (vendido ou preparo), ativo/inativo e as linhas (item ou
  preparo + quantidade + medida da linha). O preparo guarda também quanto rende (quantidade e
  medida). Nome único entre ativos do restaurante, sem diferenciar maiúsculas e acentos.
- **FR-002** A medida da linha é a do item (ou a do rendimento do preparo) ou outra da mesma
  família (g/kg, ml/l, un). A conversão usa a função `convert` de `units.ts`.
- **FR-003** Quantidade decimal exata, > 0, até 4 casas.
- **FR-004** Cada edição das linhas ou do rendimento grava uma nova versão imutável
  (`recipe_version`) com `valid_from`. Versões antigas nunca mudam. Mudar só o nome não cria versão.
- **FR-005** Custo da linha de item = quantidade convertida × `averageCost` do item. Custo da linha
  de preparo = (quantidade convertida ÷ rendimento) × custo do preparo. Custo do produto = soma.
  Arredondamento só na tela (2 casas). Falta custo médio em algum item → produto sem custo.
- **FR-009** "Explodir" um produto (função de domínio): transforma N unidades do produto na lista
  de itens e quantidades na medida de cada item, descendo pelos preparos. É o que a 005 vai baixar.
- **FR-010** Sem ciclos entre preparos (`RECIPE_CYCLE`); só preparo entra em linha de outro
  produto (`NOT_A_SUB_RECIPE`); preparo em uso não inativa, não vira vendido nem troca a família
  do rendimento (`RECIPE_IN_USE`).
- **FR-006** Permissões: gerente e chef cadastram e editam produtos (`recipe.write`); todos os
  papéis leem.
- **FR-007** Auditoria em criar, editar, inativar e reativar; RLS por restaurante como nas demais
  tabelas.
- **FR-008** Textos da tela em linguagem do dia a dia ("Produto", "O que vai nele", "Quanto");
  sem "ficha técnica", "FC" ou "CMV" soltos.

## Fora do escopo (desta primeira versão)

- Preço de venda e % do custo no preço (decisão do dono em 2026-11-02: fica para depois).
- Ordem de produção (preparar um lote de molho e guardar): o preparo é baixado direto pelos
  ingredientes quando o prato é pedido. Lote pronto em estoque pode vir depois.
- Fator de correção, índice de cocção, rendimento, porções, modo de preparo, foto, alérgenos,
  informação nutricional.
- Categoria do cardápio e integração com PDV (vem na 005).
- Aviso de produtos afetados quando o preço de um item muda (vem com a 008).

## Critérios de sucesso

- **SC-001** Cadastrar um produto de 5 itens em menos de 2 minutos sem ajuda.
- **SC-002** 100% das linhas com medida compatível com o item (garantido no domínio e no banco).
