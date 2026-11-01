# Sistema Restaurante — Constituição

## Core Principles

### I. Testes Primeiro (INEGOCIÁVEL)

Todo comportamento novo nasce de um teste que falha. O ciclo é Vermelho → Verde → Refatorar:

- O teste é escrito e commitado antes (ou no mesmo commit, nunca depois) do código que o faz passar.
- Nenhum PR é aceito com código de produção sem teste que o exercite.
- Bugs são corrigidos começando por um teste que reproduz o bug.
- Testes nunca são desligados, pulados (`skip`) ou apagados para deixar a CI verde.
- Cada regra de negócio do manual em `docs/produto/` tem pelo menos um teste nomeado pela regra.

Motivo: estoque mexe com dinheiro (CMV) e com o saldo que a cozinha usa para comprar; erro silencioso custa caro.

### II. Domínio Puro e Isolado

Regras de negócio (conversão de unidades, custo médio, ponto de pedido, CMV, custo do produto) vivem em
funções e módulos TypeScript puros, sem acesso a banco, rede, data atual ou React. Data atual e
IDs são recebidos como parâmetro. Banco, Next.js e UI são camadas finas que chamam o domínio.

Motivo: o domínio puro é testável em milissegundos e é onde está o maior risco de erro.

### III. Livro de Movimentações Imutável

Saldo de estoque nunca é editado diretamente. Ele é sempre o resultado da soma das movimentações.
Toda movimentação tem tipo, motivo em lista fechada, usuário, data do fato e do lançamento, custo
no momento e documento de referência. Erro se corrige com movimentação de estorno ou acerto,
nunca com `UPDATE` ou `DELETE` de movimentação.

Motivo: é o que permite explicar a diferença entre CMV teórico e real (manual, seções 4 e 8).

### IV. Precisão Numérica e Unidades

- Dinheiro e quantidades usam decimal exato (`numeric` no PostgreSQL, biblioteca decimal no
  TypeScript). `float`/`number` de ponto flutuante é proibido para esses valores.
- Toda quantidade carrega sua unidade. O saldo é guardado na medida do item; conversões
  (embalagem → medida, kg ↔ g, l ↔ ml) passam por uma única função de domínio testada.
- Arredondamento só na apresentação ou em pontos definidos na spec, nunca no meio do cálculo.

### V. Rastreabilidade e Segregação de Funções

Toda escrita registra quem, quando e de onde (trilha de auditoria). Permissões seguem os papéis
do manual (comprador, estoquista, administrativo, chef, gerente). Quem aprova um ajuste não pode
ser quem o lançou, salvo configuração explícita para operação pequena, que fica registrada.
Todo dado pertence a um restaurante (tenant) e nenhuma consulta cruza tenants.

### VI. Documentação Viva

`docs/produto/` descreve o que o sistema faz para o usuário; `docs/sistema/` descreve como o código
funciona. Mudança de regra de negócio atualiza `docs/produto/` no mesmo PR. Mudança de
arquitetura, modelo de dados ou convenção atualiza `docs/sistema/` no mesmo PR. Toda feature
passa pelo fluxo Spec Kit (`specs/NNN-nome/`) antes do código.

### VII. Simplicidade

Começar pelo mínimo que entrega valor (YAGNI). Nada de microserviços, filas ou cache antes de um
problema medido. Uma aplicação Next.js, um banco PostgreSQL. Complexidade extra precisa de
justificativa escrita no `plan.md` da feature.

## Restrições Técnicas

- Stack: Next.js (App Router) + React + TypeScript em modo `strict`; PostgreSQL; deploy na Vercel;
  Tailwind CSS + shadcn/ui na interface.
- Testes: Vitest (unidade e integração), PostgreSQL real em container para testes de integração
  (sem mock de banco para regras que dependem de SQL), Playwright para fluxos ponta a ponta.
- Idioma: documentação, specs e textos de interface em português do Brasil. Código (nomes de
  variáveis, funções, tabelas) em inglês, com termos de domínio mapeados no glossário
  (`docs/sistema/glossario.md`).
- Datas e horas guardadas em UTC (`timestamptz`); apresentação no fuso do restaurante.
- Controles sanitários (temperatura, validade, alérgenos) e fiscais (NCM, CEST, inventário fiscal)
  estão fora do escopo do produto por decisão do dono (ver
  `docs/produto/estoque/13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026`).

## Fluxo de Desenvolvimento

1. `speckit specify` → `speckit clarify` (se houver dúvida) → `speckit plan` → `speckit tasks`.
2. Em `tasks.md`, cada tarefa de implementação é precedida pela tarefa de teste correspondente.
3. Implementação em branch própria; PR pequeno, ligado à spec.
4. CI obrigatória no PR: lint, checagem de tipos, testes de unidade e integração. Cobertura do
   domínio (`src/domain/`) mínima de 90% de linhas.
5. Revisão verifica: teste veio antes, docs atualizadas, nenhum princípio violado.

## Governance

Esta constituição prevalece sobre qualquer outra prática do projeto. Alterações são feitas por PR
que edita este arquivo, com o motivo descrito, e seguem versionamento semântico: MAJOR para remover
ou redefinir princípio, MINOR para adicionar princípio ou seção, PATCH para ajuste de texto. Todo PR
e revisão verificam conformidade; violação justificada fica registrada na tabela "Complexity
Tracking" do `plan.md` da feature.

**Version**: 1.0.2 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-11-01
