# Feature 019 — Modo operação pequena e relatório de auditoria

**Branch**: `claude/project-thread-oukdi6` · **Criada**: 2026-11-28 · **Status**: implementada

**Pedido do dono** (2026-11-26): depois da revisão do projeto, "vamos na sequência 1 2 ignora a 3".
A frente 1 foi a [018](../018-validar-estoque-conta/spec.md) (merge no PR #36). Esta é a frente 2:
as duas promessas de `docs/produto/estoque/09-controles-e-permissoes.md` que o sistema ainda não
cumpre.

## Contexto

`09-controles-e-permissoes.md` pede, nos critérios de aceite:

- "O usuário que lançou um ajuste não consegue aprová-lo (**exceto em modo operação pequena**, com
  registro da exceção)." Hoje não há modo operação pequena: num restaurante com **um gerente só**,
  todo acerto que ele mesmo pede fica parado para sempre (`SELF_APPROVAL`), e o saldo não pode ser
  corrigido.
- "Relatório de auditoria filtra por usuário, período, tipo de operação." Hoje a trilha existe
  (`audit_log`, só inserção, com quem, quando, o antes e o depois e as tentativas negadas), mas só
  aparece no histórico de cada registro (um item, um produto, uma conta). Não há uma tela para o
  dono ver **tudo o que a equipe fez** num período.

A seção "Operação pequena" do mesmo documento pede também "contagem periódica feita pelo dono" e
"revisão semanal da variância". A contagem está fora do escopo desde novembro de 2026
([13-decisoes-adotadas](../../docs/produto/estoque/13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026)).
**Premissa até a decisão do dono (pedida em 2026-11-28):** fica a revisão semanal das exceções, sem
contagem. Se o dono escolher outra opção, as histórias US2 e US3 mudam antes do plano.

## Histórias

### US1 — Relatório de auditoria (P1)

Como dono, quero ver numa tela só tudo o que a equipe fez num período, filtrando por pessoa e por
tipo de operação, para conferir perdas, acertos, estornos, cancelamentos, pagamentos tirados e
tentativas sem permissão.

**Por que P1**: é o controle contra furto que `09` pede ("trilha de auditoria de quem fez o quê e
quando"; "relatórios de cancelamentos, estornos e descontos fora do padrão"), e não depende de nada.

**Teste independente**: com um restaurante de teste com registros de várias pessoas, abrir
Auditoria, filtrar por uma pessoa e um tipo e ver só os registros dela, do mais novo para o mais
antigo, com o que mudou em português.

**Cenários**

1. Dado o gerente, quando abre **Auditoria** (menu da equipe), então vê os registros de hoje, do
   mais novo para o mais antigo: dia e hora no fuso do restaurante, quem fez (nome; "Sistema" ou
   "Cliente pelo QR code" quando não há pessoa), o que (tipo e nome do registro, com link quando o
   registro tem tela), a ação (criou, alterou, inativou, reativou, **tentou sem permissão**) e o que
   mudou (antes → depois, com os mesmos textos do histórico de cada registro).
2. Filtros: **período** (de/até, dias locais, até 31 dias; padrão hoje), **pessoa** (todos os
   membros do restaurante, ativos ou não), **tipo de operação** (lista fechada em português, ver
   FR-003) e **só tentativas negadas**. Os filtros ficam no endereço da página (dá para voltar e
   compartilhar o link).
3. Mais de 50 registros: página de 50 em 50, com o total.
4. Período inválido (fim antes do início, mais de 31 dias) diz o problema no campo, como em Vendas e
   Contas fechadas.
5. Ninguém além do gerente vê a tela nem os dados (nem pelo endereço); a tentativa negada também vai
   para a trilha.
6. Dados de outro restaurante nunca aparecem.
7. **Baixar planilha** (CSV, separador `;`, decimal com vírgula, como Vendas) com o filtro aplicado.

### US2 — Modo operação pequena (P1)

Como dono de um restaurante com um gerente só, quero poder aprovar o meu próprio acerto de estoque,
ficando registrado que foi uma exceção, para não ter o saldo travado.

**Por que P1**: sem isso o acerto não funciona em restaurante pequeno; o controle continua porque
cada exceção fica marcada e é revisada (US3).

**Teste independente**: gerente único liga o modo, pede um acerto, aprova o próprio pedido, o saldo
muda, e o acerto aparece como exceção na Auditoria e no histórico do pedido de acerto.

**Cenários**

1. Dado o gerente, quando abre **Equipe** › **Operação pequena**, então vê o modo desligado (padrão)
   e o texto do que ele muda: "Com o modo ligado, o gerente pode aprovar o próprio acerto de
   estoque. Cada caso fica marcado como exceção e entra na revisão da semana."
2. Ligar e desligar pedem confirmação e vão para a trilha com quem e quando (versão otimista: duas
   telas ao mesmo tempo, a segunda vê "mudou em outra tela").
3. Com o modo **ligado**, o gerente que pediu o acerto vê **Aprovar** e **Recusar** no próprio
   pedido; ao aprovar, o saldo muda como num acerto comum e o registro guarda **"Aprovado por quem
   pediu (operação pequena)"**.
4. Com o modo **desligado**, nada muda: quem pediu não aprova (`SELF_APPROVAL`), nem sendo gerente.
5. Só o gerente aprova, com o modo ligado ou não; chef, estoquista e comprador continuam sem aprovar.
6. Desligar o modo não desfaz exceções já aprovadas; pedidos ainda pendentes voltam a precisar de
   outro gerente.
7. O modo é lido na mesma transação que aprova: ligar ou desligar ao mesmo tempo que alguém aprova
   nunca deixa passar uma exceção sem marca.

### US3 — Revisão semanal das exceções (P2)

Como dono, quero que toda semana o sistema me lembre de revisar as exceções da operação pequena,
para que acumular funções não vire falta de controle.

**Por que P2**: completa o controle da US2; sem ela, a exceção fica registrada mas ninguém olha.

**Teste independente**: com exceções numa semana encerrada, o gerente vê o aviso, abre a lista,
marca a semana como revisada e o aviso some; uma semana sem exceção não pede revisão.

**Cenários**

1. Semana = segunda a domingo, no fuso do restaurante. Dada uma semana **já encerrada** com pelo
   menos uma exceção não revisada, o gerente vê, no topo das telas da equipe, "Há exceções da
   operação pequena para revisar (semana de 16/11 a 22/11)." com link para a revisão.
2. A revisão lista as exceções da semana (quando, quem, item, quantidade, valor e motivo do acerto),
   o total em R$ das exceções e o saldo atual de cada item.
3. **Marcar como revisada** grava quem e quando (e uma observação opcional, até 140 letras) e vai para
   a trilha; o aviso some. Semana revisada não volta a pedir revisão.
4. Várias semanas atrasadas aparecem todas, a mais antiga primeiro.
5. Semana sem exceção nunca pede revisão; semana em andamento ainda não pede.

## Requisitos

- **FR-001** Tela **Auditoria** em `/equipe/auditoria`, só com a permissão nova `audit.read`
  (gerente), no menu da equipe.
- **FR-002** A lista lê `audit_log` do restaurante (RLS), mais novo primeiro, com período de até 31
  dias locais, pessoa, tipo de operação, só negadas, página de 50 e total. Índices para período e
  para pessoa + período (`docs/sistema/04-desempenho.md`).
- **FR-003** Tipos de operação (lista fechada, em português), cada um ligado a uma ou mais entidades
  da trilha: Itens e grupos; Produtos e adicionais; Fornecedores; Lançamentos de estoque (inclui
  acertos e estornos); Mesas e QR code; Pedidos; Contas da mesa (pagamentos, taxa, fechar,
  reabrir); Caixa do dia; Cardápio; Equipe e acessos; Configurações do restaurante. Um teste falha
  se uma entidade gravada pelo código não estiver em nenhum tipo.
- **FR-004** O que mudou usa os mesmos rótulos do histórico de cada registro (um único tradutor);
  token, senha e caminho de arquivo nunca aparecem (como já é na trilha).
- **FR-005** Planilha CSV com o mesmo filtro, até 31 dias, só `audit.read`.
- **FR-006** Configuração "operação pequena" do restaurante (padrão desligado), mudada só pelo
  gerente, com versão otimista e trilha.
- **FR-007** Aprovar acerto: com o modo ligado, quem decide = quem pediu e quem decide pode aprovar,
  aprova e marca o pedido de acerto como exceção; a trilha registra a aprovação como exceção. Sem o
  modo, continua `SELF_APPROVAL`. Recusar o próprio pedido com o modo ligado também é permitido (não
  é exceção: não muda saldo).
- **FR-008** Revisão semanal: registro só de inserção com a semana (data da segunda), quem revisou,
  quando e a observação; uma revisão por semana (índice único); recusa revisar semana em andamento
  ou sem exceção.
- **FR-009** Aviso de revisão pendente para quem tem `audit.read`, numa consulta só, com índice.
- **FR-010** Telas novas (Auditoria, Operação pequena, Revisão da semana) entram nos testes de tela
  nos tamanhos da equipe (`celular-android`, `tablet-em-pe`, `computador`), claro e escuro, com as
  asserções de layout e axe.
- **FR-011** Régua: 100% de linhas, desvios, funções e mutação no código novo (portão próprio), como
  nas features 013 a 018.
- **FR-012** `docs/produto/estoque/09` passa a descrever o que o sistema faz (modo, exceção, revisão,
  relatório); `13-decisoes-adotadas` registra a troca da contagem pela revisão semanal.

## Fora do escopo

Contagem de estoque, revisão da variância por contagem, aviso por e-mail, apagar ou editar registros
da trilha (continua só inserção), auditoria de leituras (quem só viu).

## Critérios de sucesso

- **SC-001** O dono acha qualquer ação da equipe de um período com no máximo 3 filtros.
- **SC-002** Num restaurante com um gerente só, um acerto pedido e aprovado por ele leva menos de 1
  minuto e aparece como exceção na Auditoria e na revisão da semana.
- **SC-003** 100% das exceções de semanas encerradas aparecem na revisão até serem marcadas.
- **SC-004** A página da Auditoria responde em até 1 s com 100 mil registros na trilha.
- **SC-005** Régua de 100% (cobertura e mutação) no código novo, CI verde.

## Premissas

- O único acúmulo de funções que o sistema bloqueia hoje é aprovar o próprio acerto; o modo
  operação pequena libera só isso.
- "Dono" = papel Gerente (o sistema não tem papel Dono separado).
