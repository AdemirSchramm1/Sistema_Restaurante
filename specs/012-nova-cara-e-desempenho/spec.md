# Feature 012 — Nova cara, padrões do front, limpeza e desempenho

**Branch**: `claude/project-thread-btqt25` · **Criada**: 2026-11-11 · **Status**: em revisão

**Pedido do dono**: "Varra todo o repositório e faça melhorias de limpeza de código aumentando o
TDD, deixando o sistema com uma nova cara no front e criando os padrões desse front. Pode usar as
cores que achar melhor, mas pensando que envolve comida, e também pensando na performance do
sistema, na baixa latência e na otimização."

## Contexto

O sistema já cobre estoque (001–008), pedidos pelo QR code (009, 010) e a conta da mesa (011). Cada
feature trouxe telas próprias e o visual cresceu sem padrão: o menu é uma linha de 16 links que
quebra em duas, cada tela monta o próprio título, as cores de aviso são escolhidas uma a uma
(`amber-100`, `red-800`…) e o verde do botão não lembra restaurante. No código, o mesmo trecho
aparece em vários lugares (formatar "R$", ler filtro da URL, juntar listas) e cada tela consulta o
banco mais vezes do que precisa.

Esta feature não muda regra de negócio. Ela muda **como o sistema se apresenta**, **como o front é
construído** e **quanto cada tela custa**.

## Histórias

### US1 — Identidade visual de restaurante (P1)

Como dono, quero que o sistema tenha cara de restaurante, com cores de comida, para a equipe
reconhecer o sistema e trabalhar num ambiente agradável.

**Teste independente**: abrir qualquer tela da equipe e ver o fundo creme, o botão principal em
páprica, os avisos em açafrão, os "deu certo" em manjericão e os títulos com a fonte de cardápio;
com o celular no modo escuro, ver as mesmas cores em versão escura, legíveis.

**Cenários**

1. Paleta de comida: **páprica** (ação principal), **manjericão** (deu certo, positivo),
   **açafrão** (atenção), **beterraba** (erro e ação que apaga), **creme** (fundo) e **café**
   (texto). Cada cor tem versão clara e escura.
2. Todo texto tem contraste mínimo de 4,5:1 com o fundo onde aparece (WCAG AA), nos dois modos.
3. Títulos das telas usam uma fonte serifada de cardápio; o resto usa uma fonte sem serifa
   própria para números e tabelas. As fontes são servidas pelo próprio sistema (sem chamada a
   outro site quando a tela abre).
4. Nenhuma tela usa cor solta fora da paleta.

### US2 — Menu lateral por área (P1)

Como pessoa da equipe, quero um menu organizado por área, que mostre onde estou, para achar a tela
certa rápido no computador, no tablet e no celular.

**Teste independente**: entrar como gerente e ver o menu lateral com as áreas **Estoque**,
**Operação** e **Configuração**, a tela atual destacada e o número do Repor; no celular, abrir o
menu pelo botão "Menu".

**Cenários**

1. No computador, o menu fica à esquerda, com o nome do restaurante no topo, as áreas com os
   links e, no rodapé, quem está logado, o papel e "Sair".
2. A tela atual fica destacada e é anunciada para leitor de tela (`aria-current="page"`). Em
   "Contas", só "Contas" fica destacado (não "Caixa"); em "Cozinha", só "Cozinha" (não "Pedidos").
3. No celular e no tablet em pé, o menu vira uma barra no topo com o botão **Menu**, que abre e
   fecha a lista; escolher uma tela fecha o menu.
4. Cada papel continua vendo só as telas que pode, na mesma ordem de hoje: garçom vê "Garçom",
   "Caixa" e "Pedidos"; caixa vê "Caixa", "Contas" e "Pedidos" e entra direto no Caixa.
5. Um link "Pular para o conteúdo" aparece ao navegar pelo teclado.

### US3 — Telas com o mesmo padrão (P1)

Como pessoa da equipe, quero que todas as telas sigam o mesmo desenho (título, ações, tabelas,
avisos, lista vazia), para não reaprender cada tela.

**Teste independente**: abrir Itens, Caixa, Cozinha e Contas e ver o mesmo cabeçalho (título,
descrição curta e botões à direita), as mesmas tabelas e os mesmos avisos coloridos por tipo.

**Cenários**

1. Todas as telas da equipe usam o mesmo cabeçalho: título, frase curta do que a tela faz e as
   ações principais.
2. Avisos têm quatro tipos fixos (erro, atenção, informação, deu certo), com cor e ícone próprios
   e o texto sempre dizendo o que houve (a cor nunca é a única pista).
3. Etiquetas (situação do pedido, "Repor", "inativo", "Pago") usam os mesmos seis tons.
4. Entrar, criar conta e recuperar senha ganham a marca e uma frase do sistema ao lado do
   formulário (no computador).
5. A cozinha mostra as colunas com a cor da etapa (Recebido em açafrão, Em preparo em páprica,
   Pronto em manjericão). O cardápio do cliente mostra os pratos em cartões, com o preço em
   destaque.
6. Imprimir conta e QR codes continua sem menu e sem cores de fundo.

### US4 — Telas mais rápidas (P1)

Como pessoa da equipe, quero que as telas abram e se atualizem rápido, inclusive Cozinha, Garçom e
Caixa, que se atualizam sozinhas o dia todo.

**Teste independente**: medir quantas consultas ao banco cada tela faz e o tempo até o primeiro
byte com o banco a 5 ms de distância; comparar com a linha de base de
[research.md](research.md#r1-linha-de-base).

**Cenários**

1. Cada tela descobre quem está logado e o restaurante **uma vez** por carregamento, não uma vez
   por parte da tela.
2. O contexto de quem está logado (restaurante e papéis) sai de uma consulta só.
3. O cabeçalho (nome do restaurante e número do Repor) sai de uma transação só.
4. As consultas das telas mais usadas (cardápio, cozinha, caixa, conta, pedidos, itens, grupos,
   fornecedores, mesas, adicionais) usam índice: nenhuma lê a tabela inteira de todos os
   restaurantes.
5. Enviar um pedido faz o mesmo número de idas ao banco com 1 ou com 10 linhas.
6. Juntar pedidos com linhas, contas com pagamentos e produtos com opções não cresce ao quadrado
   com o volume do dia.

### US5 — Código mais limpo (P2)

Como quem desenvolve, quero menos código repetido e nenhum código morto, para mudar o sistema com
menos risco.

**Cenários**

1. Formatar dinheiro ("R$ 1.234,50"), ler filtro da URL e limpar texto de formulário têm uma
   função só cada, com teste.
2. Funções sem uso são apagadas.
3. As telas usam os componentes do padrão (cabeçalho, link, etiqueta, aviso) em vez de repetir
   classes.

### US6 — Mais testes e régua mais alta (P2)

Como dono, quero que a régua de testes suba junto, para o visual novo e as otimizações não
quebrarem o que já funciona.

**Cenários**

1. Os componentes que não tinham teste ganham teste.
2. A CI passa a exigir cobertura mínima também dos componentes de tela, e a do domínio sobe.
3. Testes que protegem o desempenho: consultas das telas usam índice; o envio do pedido não faz
   uma ida ao banco por linha; o contexto do login sai de uma consulta.
4. Um teste barra cor solta fora da paleta e outro confere o contraste de todas as cores.

## Casos-limite

- Modo escuro do aparelho: todas as cores mudam juntas e mantêm o contraste.
- Tela de impressão (conta, QR codes): sem menu, sem fundo colorido.
- Menu com muitos itens (gerente vê 16 telas): a lista rola dentro do menu sem empurrar a tela.
- Papel sem nenhuma tela: continua indo para "Sem acesso".
- Leitor de tela: ícones são decorativos (`aria-hidden`), o nome do link é só o texto.
- Telas que se atualizam sozinhas (Cozinha, Garçom, Caixa) não piscam o menu.
- Os testes ponta a ponta que procuram o "Menu principal" e os links pelo nome continuam valendo.

## Requisitos

- **FR-001** Paleta de comida em variáveis de tema (claro e escuro), com nomes por função
  (`primary`, `success`, `warning`, `destructive`, `info`, `muted`, `sidebar`…), nunca por cor.
- **FR-002** Contraste de texto ≥ 4,5:1 em todos os pares de cor de texto e fundo do tema, nos dois
  modos, verificado por teste.
- **FR-003** Fonte de títulos e fonte do texto servidas pelo próprio sistema, com troca sem
  esconder o texto enquanto carrega.
- **FR-004** Componentes do padrão documentados em `docs/sistema/03-padroes-do-front.md`: botão,
  campo, etiqueta, aviso, cartão, tabela, cabeçalho de tela, lista vazia, link.
- **FR-005** Proibido usar cor da paleta crua do Tailwind (`amber-100`, `red-800`, `white`…) em
  `app/` e `src/components/`; um teste falha se aparecer.
- **FR-006** Menu lateral agrupado em Estoque, Operação e Configuração, com tela atual destacada,
  versão de celular com botão "Menu" e link "Pular para o conteúdo". As permissões e a ordem dos
  links não mudam.
- **FR-007** Quem está logado e o contexto do restaurante são resolvidos uma vez por
  carregamento de tela; o contexto sai de uma consulta.
- **FR-008** Índices para as consultas das telas mais usadas, com teste que falha se uma delas ler a
  tabela inteira.
- **FR-009** Envio do pedido grava as linhas, os adicionais e as retiradas em lote.
- **FR-010** Junções em memória por chave (mapa), não por busca em lista dentro de laço.
- **FR-011** Uma função para formatar reais, uma para ler filtros da URL e uma para limpar texto de
  formulário; o código repetido sai.
- **FR-012** Cobertura mínima na CI: domínio com 95% das linhas, 90% dos desvios e 95% das funções;
  componentes de tela com 90% das linhas e 80% dos desvios.
- **FR-013** Nenhuma regra de negócio, texto de regra, permissão ou URL muda.

## Critérios de sucesso

- **SC-001** Cada tela da equipe faz pelo menos 50% menos consultas ao banco que a linha de base.
- **SC-002** Com o banco a 5 ms de distância, o tempo até o primeiro byte das telas medidas cai pelo
  menos 40%.
- **SC-003** 100% dos pares de cor de texto do tema passam 4,5:1, nos dois modos.
- **SC-004** Nenhuma falha grave de acessibilidade (axe, WCAG 2.1 AA) nas telas já verificadas.
- **SC-005** Todos os testes existentes continuam verdes sem mudar o que verificam.

## Premissas

- O tema segue o modo claro ou escuro do aparelho; não há botão para trocar.
- O menu lateral aparece a partir de 1024 px de largura; abaixo disso, a barra do topo.
- As medidas de tempo usam o banco local com um atraso artificial de 5 ms por ida e volta, que
  imita a distância até o banco gerenciado.

## Fora do escopo

Nova regra de negócio, troca de biblioteca de interface, cache de páginas entre usuários, tempo real
por WebSocket, botão de tema claro e escuro, fechamento do caixa do dia (próxima feature).

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-11 | Que cores? | Escolha livre, pensando em comida (pedido do dono): páprica, manjericão, açafrão, beterraba, creme e café |
| 2026-11-11 | Uma feature só? | Sim: o dono pediu a varredura inteira de uma vez; o fechamento do caixa do dia fica para depois |
