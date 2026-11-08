# Feature 010 — Adicionar e tirar ingredientes por botão

**Branch**: `claude/project-thread-qmc5hs` · **Criada**: 2026-11-08 · **Status**: rascunho

**Pedido do dono**: "Preciso também que o tirar ou adicionar algo seja um botão, não uma
descrição. Assim, se for adicionar uma fatia de queijo, vamos saber. E aí claro vêm os preços, que
devem ser editados pelo gerente."

## Contexto

Na [009](../009-pedidos-qr-mesa/spec.md) o cliente escreve uma observação livre em cada linha
("sem cebola"). Texto livre não diz ao sistema o que mudou: a cozinha lê, mas o estoque não sabe
que saiu uma fatia de queijo a mais, e ninguém cobra por ela.

Esta feature troca a observação livre por **botões**: o gerente cadastra o que o cliente pode
**adicionar** (com preço) e o que pode **tirar** em cada produto; o cliente só toca. Depende da
009 (cardápio e pedido) e da [003](../003-produtos/spec.md) (itens e produtos). Como a 009 ainda
não foi implementada, as duas entram juntas: a 009 é construída já sem a observação livre.

## Histórias

### US1 — Gerente cadastra os adicionais com preço (P1)

Como gerente, quero cadastrar o que pode ser adicionado a um prato e quanto custa, para cobrar e
saber o que saiu do estoque.

**Por que P1**: sem adicional cadastrado não há botão para o cliente.

**Teste independente**: cadastrar "Fatia de queijo" (queijo mussarela 20 g) por R$ 3,00 e ligá-lo
ao X-Burger; o adicional aparece na página do produto com o preço.

**Cenários**

1. Dado o menu, então em Pedidos vejo **"Adicionais"**. A página lista nome, o que usa do
   estoque, preço e se está ativo.
2. Dado o formulário de novo adicional, quando informo "Fatia de queijo", escolho o item "Queijo
   mussarela" com 20 g e o preço R$ 3,00, então o adicional é salvo.
3. O item e a quantidade seguem as regras de produto da 003: item ativo, medida da mesma família
   (g ou kg para item em kg), quantidade maior que zero com até 4 casas.
4. Um adicional pode usar um **preparo** em vez de item (ex.: "Molho especial", 30 g do preparo
   "Molho da casa").
5. Preço maior que zero, até 2 casas. Adicional grátis (ex.: "Cebola extra" sem cobrar) usa preço
   **zero** marcado como "Grátis".
6. Nome único entre os adicionais ativos, sem diferenciar maiúsculas e acentos.
7. Dado o adicional "Fatia de queijo" em uso, quando o gerente muda o preço para R$ 3,50, então
   vale para os próximos pedidos; os já enviados guardam R$ 3,00. A mudança vai para o histórico.
8. Posso inativar um adicional; ele some de todos os cardápios e continua nos pedidos antigos.
9. A página do adicional mostra quanto ele custa em ingredientes (custo médio, como na 003) e a %
   do preço, com a mesma faixa da 008, para o gerente acertar o preço.

### US2 — Gerente escolhe o que cada prato pode adicionar e tirar (P1)

Como gerente, quero dizer, em cada prato, quais adicionais valem e o que dá para tirar.

**Teste independente**: no X-Burger, ligar "Fatia de queijo" e "Bacon" e marcar "Cebola" e
"Picles" como retiráveis; o cardápio do X-Burger mostra esses quatro botões.

**Cenários**

1. Na página de um produto vendido, o quadro **"Adicionar e tirar"** tem duas listas.
2. **Pode adicionar**: escolho adicionais ativos. Para cada um, digo quantas vezes cabe por
   unidade do prato (1 a 5; padrão 1). Ex.: "Fatia de queijo" até 3 vezes.
3. **Pode tirar**: escolho linhas do próprio produto (ex.: "Cebola", "Picles"). O nome do botão é
   "Sem {nome}"; posso trocar o texto (ex.: "Sem cebola roxa" vira "Sem cebola").
4. Só linhas da versão mais nova do produto aparecem para tirar. Se uma linha retirável sai do
   produto numa versão nova, o botão some e o quadro avisa "Cebola saiu do produto e não aparece
   mais como opção".
5. Tirar é sempre grátis e não dá desconto.
6. Preparo (usado dentro de outros produtos) não tem esse quadro.
7. Mudanças no quadro vão para o histórico do produto e **não** criam versão nova do produto.

### US3 — Cliente adiciona e tira tocando em botões (P1)

Como cliente, quero personalizar o prato com toques, vendo o preço na hora.

**Teste independente**: no celular, abrir o X-Burger, tocar "+ Fatia de queijo" duas vezes e
"Sem cebola"; o pedido mostra "X-Burger · + 2 Fatia de queijo · Sem cebola — R$ 34,00".

**Cenários**

1. Dado o X-Burger a R$ 28,00 com adicionais, quando toco em "Adicionar", abre a tela do prato com
   os botões "+ Fatia de queijo R$ 3,00", "+ Bacon R$ 5,00" e "Sem cebola", "Sem picles".
2. Cada adicional tem botões − e + com o número escolhido, até o máximo do prato. Ao chegar no
   máximo o + fica indisponível.
3. "Sem cebola" é um botão de liga e desliga.
4. O preço do prato na tela já soma os adicionais: 28,00 + 2 × 3,00 = R$ 34,00 por unidade. Com
   quantidade 2, a linha mostra R$ 68,00.
5. Os adicionais e retiradas valem para todas as unidades da linha. Para dois X-Burgers diferentes,
   o cliente adiciona duas linhas (o mesmo produto pode aparecer em linhas separadas).
6. Não há campo de texto livre. Quem precisa de algo fora dos botões chama o garçom (a tela diz
   "Precisa de outra mudança? Chame um garçom.").
7. Produto sem adicionais nem retiradas continua com o "Adicionar" direto, como na 009.
8. Dado que o preço de um adicional mudou ou ele foi inativado depois que pus no pedido, quando
   envio, então recebo o mesmo aviso da 009 ("O preço de Fatia de queijo mudou para R$ 3,50" ou
   "Fatia de queijo não está mais disponível") e confirmo de novo.

### US4 — Cozinha e garçom veem as mudanças de forma clara (P1)

1. Na cozinha, cada linha mostra embaixo do prato, em destaque: "+ 2 Fatia de queijo" e
   "SEM cebola" (o "SEM" em maiúsculas e cor diferente, sem depender só da cor).
2. "Meus pedidos" do cliente, a tela do garçom e a consulta de pedidos mostram o mesmo texto.
3. O total do pedido inclui os adicionais.

### US5 — O pedido guarda o que mudou, para o estoque e o custo (P2)

Como dono, quero que a baixa do estoque (feature 005) conte a fatia de queijo a mais e não conte a
cebola que saiu.

1. O pedido guarda, por linha, cada adicional (nome, quantidade por unidade, preço no envio, item
   ou preparo e quantidade usada) e cada retirada (qual linha do produto saiu).
2. A regra de cálculo fica pronta e testada nesta feature: consumo de uma linha = (produto
   explodido − linhas retiradas + adicionais × vezes) × quantidade. Ex.: 2 X-Burgers com "+ 2
   Fatia de queijo" e "Sem cebola" usam 2 × (pão 1 un + carne 150 g + queijo 30 g + 2 × 20 g de
   queijo) e nenhuma cebola. A baixa em si continua sendo a 005.

## Casos-limite

- Adicional usa um item inativado depois: o adicional fica indisponível no cardápio até o gerente
  trocar o item ou inativá-lo; a página do adicional avisa.
- Adicional ligado a vários produtos com preço único: o preço é do adicional, não do par
  produto + adicional (mudar uma vez muda em todos).
- Retirada de uma linha que é um preparo (ex.: "Sem molho"): tira o preparo inteiro.
- Produto com todas as linhas retiráveis: permitido (ex.: salada montada).
- Adicional com o mesmo item de uma linha retirada na mesma escolha (tirar o queijo e pôr fatia de
  queijo): permitido; a cozinha vê as duas coisas.
- Mudar o preço de venda do prato ou de um adicional não muda pedidos já enviados.

## Requisitos

- **FR-001** O restaurante cadastra adicionais: nome (até 40 caracteres, único entre ativos sem
  diferenciar maiúsculas e acentos), item **ou** preparo com quantidade e medida (mesmas regras da
  linha de produto da 003), preço (zero ou maior, até 2 casas; zero aparece como "Grátis") e
  ativo/inativo. Adicional não é apagado.
- **FR-002** Cada produto vendido tem uma lista de adicionais permitidos, cada um com o máximo de
  vezes por unidade (1 a 5), e uma lista de retiradas, cada uma ligada a uma linha da versão mais
  nova do produto, com texto do botão (até 40 caracteres; padrão "Sem {nome do item ou preparo}").
- **FR-003** O cardápio mostra só adicionais ativos, com item ou preparo ativo, e retiradas cuja
  linha ainda existe na versão mais nova.
- **FR-004** Preço unitário da linha do pedido = preço de venda do produto + Σ(preço do adicional ×
  vezes). Total da linha = preço unitário × quantidade. Tudo em decimal exato.
- **FR-005** A linha do pedido guarda: produto, versão, quantidade, preço do produto no envio, e
  para cada adicional: adicional, vezes, preço no envio, item ou preparo, quantidade e medida no
  envio; para cada retirada: a linha do produto retirada e o texto do botão. Nada disso muda depois
  do envio.
- **FR-006** A conferência de preço e disponibilidade da 009 inclui os adicionais e as retiradas.
- **FR-007** A observação livre da 009 deixa de existir no cardápio do cliente.
- **FR-008** Permissões: cadastrar e mudar adicionais e preços, e escolher o que cada prato pode
  adicionar e tirar: **gerente**. Ver adicionais: gerente e chef. Toda mudança vai para a auditoria.
- **FR-009** A regra de consumo (US5-2) é uma função pura testada, usada depois pela 005.
- **FR-010** Isolamento por restaurante, como em toda a aplicação.

## Entidades

- **Adicional**: nome, item ou preparo, quantidade e medida, preço, ativo.
- **Adicional do produto**: produto, adicional, máximo de vezes por unidade.
- **Retirada do produto**: produto, linha do produto, texto do botão.
- **Adicional na linha do pedido**: adicional, vezes, preço, item ou preparo e quantidade no envio.
- **Retirada na linha do pedido**: linha retirada, texto do botão.

## Critérios de sucesso

- **SC-001** 100% das mudanças pedidas pelo cardápio chegam à cozinha como botões, sem texto livre.
- **SC-002** Todo adicional pedido entra no total do pedido com o preço vigente no envio.
- **SC-003** O cliente personaliza um prato com até 3 mudanças em menos de 20 segundos.
- **SC-004** O gerente cadastra um adicional e o liga a 10 produtos em menos de 3 minutos.
- **SC-005** Para qualquer pedido, o sistema diz exatamente quanto de cada item ele consumiu,
  contando adicionais e retiradas.

## Premissas

- Os preços são editados só pelo gerente, como pedido. O chef vê, mas não muda.
- Sem observação livre: o que não estiver nos botões é falado com o garçom.
- Retirar não dá desconto.
- O preço do adicional é o mesmo em todos os pratos.
- Grupos de escolha obrigatória (ex.: "escolha o ponto da carne", "escolha 1 acompanhamento") e
  tamanhos ficam para depois.

## Fora do escopo

Escolhas obrigatórias (ponto da carne, acompanhamento), tamanhos (P/M/G), combos, preço do
adicional diferente por prato, desconto por retirada, foto do adicional, baixa do estoque (005).

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-08 | Tirar de vez o campo de texto livre do cardápio? | Sim, só botões. O que não estiver nos botões o cliente fala com o garçom |
