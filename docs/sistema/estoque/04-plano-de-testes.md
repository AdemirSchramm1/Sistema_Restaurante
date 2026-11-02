# Estoque — Plano de testes

Mapa de **o que precisa ter teste** antes de cada feature do [roadmap](../../produto/estoque/00-visao-geral.md#roadmap)
ser considerada pronta. Os testes são escritos primeiro (ver [TDD](../01-tdd.md)).

Legenda: **U** = unidade (domínio), **I** = integração (banco real), **E** = ponta a ponta.

## 001 — Cadastros base (com as mudanças da 002)

| Nível | Teste |
|---|---|
| U | Conversão dentro da mesma família e embalagem → medida (casos de [02-regras-de-calculo](02-regras-de-calculo.md#medida-e-embalagem--unitsts-itemts)) |
| U | Geração de código `GG.SS.NNNN` sequencial por subgrupo |
| U | Normalização de descrição (acentos, caixa, espaços) para detectar duplicidade |
| I | Duplicidade de descrição normalizada no mesmo subgrupo é rejeitada |
| I | Medida não muda após 1ª movimentação (`ITEM_UNIT_LOCKED`) |
| I | **Isolamento de tenant**: restaurante A não lê/grava itens de B |
| U | Permissões por papel (gerente faz tudo; chef cria e edita itens; demais só leem) |
| U | Sempre um gerente ativo (`LAST_MANAGER`); convite vence em 7 dias |
| I | **RLS**: toda tabela com `restaurant_id` tem política; sem restaurante definido nada volta |
| I | Auditoria só de inserção; tentativa negada vira `DENIED` |
| I | Edição concorrente devolve `STALE_RECORD` (trava otimista) |
| I | Convite: só o hash do token no banco; repetido, revogado, vencido, e-mail de outro restaurante |
| I | Membro desativado perde o acesso; o histórico mantém o usuário |
| I | Busca na lista com 2.000 itens em até 1 s (SC-005) |
| E | Gerente convida chef; chef aceita, não gerencia grupos e cadastra item |
| E | Acessibilidade: nenhuma falha grave do axe (WCAG 2.1 AA) nas telas públicas, de estoque e de equipe |
| U | Formulários mantêm o que foi digitado quando o servidor recusa |

## 002 — Cadastro simplificado

| Nível | Teste |
|---|---|
| U | Item aceita só nome, grupo, tipo, medida e embalagem opcional; recusa campos retirados |
| U | Embalagem e quantidade andam juntas (`PURCHASE_FACTOR_REQUIRED`, `PURCHASE_LABEL_REQUIRED`); quantidade > 0 |
| U | Frase "1 Caixa = 20 kg" |
| U | Formulário do item: três blocos, sem temperatura, validade, alérgeno, EAN, NCM, contagem, receita nem fator |
| U | Não existem permissões de locais |
| I | Item sem embalagem; embalagem incompleta recusada também pelo banco (`items_purchase_pair`) |
| I | Banco sem as tabelas `locations` e `item_locations` (migração `0003`) |
| I | Migração `0002` aplicada sobre banco com dados antigos |
| E | Criar conta (cai direto em Itens, menu sem Locais) e cadastrar item com embalagem |

## 003 — Produtos

| Nível | Teste |
|---|---|
| U | Quantidade de cada item na medida do item ou numa menor da mesma família (g para kg) |
| U | Família diferente (un num item em kg) é recusada |
| U | Custo do produto = Σ quantidade × custo médio do item; produto sem custo quando falta custo |
| U | Explodir produto com preparo (50 g de molho que rende 2 kg = 1/40 dos ingredientes) |
| U | Ciclo direto e indireto entre preparos (`RECIPE_CYCLE`); vendido dentro de outro (`NOT_A_SUB_RECIPE`) |
| U | Preparo em uso não inativa, não vira vendido, não troca a família do rendimento (`RECIPE_IN_USE`) |
| U | Formulário: medida filtrada pela família, linhas somem e voltam, erro na linha certa sem apagar o digitado |
| I | Nova versão ao editar; o pedido usa a versão vigente na data |
| I | Versões e linhas só de inserção (permissão e gatilho) |
| I | Item inativo não entra em produto novo |
| I | Nome repetido entre ativos; isolamento de restaurante; chef pode, estoquista não |
| E | Cadastrar o molho e o "X-Burger" que usa o molho, editar e ver a versão 2 |

## 004 — Entradas, perdas e saldo

| Nível | Teste |
|---|---|
| U | Custo médio (todos os casos) |
| U | Entrada em embalagens vira quantidade na medida do item |
| U | Motivo de perda obrigatório e de lista fechada |
| I | Saldo = soma do livro após sequência aleatória de operações (teste de propriedade) |
| I | `UPDATE`/`DELETE` em `stock_movements` falha |
| I | Estorno único por movimentação |
| I | Duas saídas concorrentes não deixam saldo inconsistente |
| I | `idempotency_key` repetido não duplica lançamento |
| U | Pedido de acerto calcula a diferença; quem pediu não aprova (`SELF_APPROVAL`) |
| I | Acerto: pedir não muda o saldo; outro gerente aprova e grava `ADJUSTMENT`; recusar e cancelar |
| I | Estorno de compra recalcula o custo médio; estorno que deixaria saldo negativo é recusado |
| I | Custo do produto (003) aparece depois da primeira compra |
| I | Primeira movimentação trava a medida do item |
| E | Lançar compra em caixas, perda com motivo, estornar a perda e ver o saldo |
| E | Chef pede acerto; gerente aprova; saldo muda |

## 005 — Baixa automática por pedido

| Nível | Teste |
|---|---|
| U | Pedido de 2 X-Burger baixa 2 × cada item do produto |
| I | Pedido lançado gera uma saída por item, com a versão do produto vigente |
| I | Pedido repetido (mesmo identificador) não baixa duas vezes |
| I | Saldo negativo por pedido: conforme a decisão da spec 004 (permitir com alerta) |
| E | Lançar um pedido manual e ver o estoque dos itens cair |

## 006 — Alerta de reposição

| Nível | Teste |
|---|---|
| U | ES, PP e par (caso do filé mignon em [02-regras-de-calculo](02-regras-de-calculo.md#reposição--reorderts)) |
| I | Item abaixo do ponto de pedido aparece no aviso |

## 007 — Fornecedores

| Nível | Teste |
|---|---|
| U | Validação de CNPJ (dígitos verificadores), numérico e alfanumérico |
| U | Fornecedor: só o nome obrigatório; e-mail, dias, prazo, pedido mínimo |
| U | Item do fornecedor: preço > 0, embalagem em par; preço por medida; mais barato |
| U | Compra na embalagem do fornecedor (2 caixas de 18 kg = 36 kg) |
| U | `supplier.write` só para gerente e comprador |
| U | Formulário do fornecedor e itens que vende (mantém o digitado no erro) |
| I | CNPJ único por restaurante; nome único entre ativos; trava otimista |
| I | Embalagem e preço por fornecedor; um preferido por item (caso de uso e banco) |
| I | Compra com fornecedor e na embalagem dele; fornecedor bloqueado recusado |
| I | Fornecedor só na compra (check no banco); isolamento; permissões e auditoria |
| E | Cadastrar fornecedor com CNPJ, item em caixa, comprar na caixa dele e comparar no item |

## 008 — Painel de custo dos produtos

Casos de domínio em [02-regras-de-calculo](02-regras-de-calculo.md#cmv-e-indicadores--cogsts-indicatorsts)
(CMV teórico, % de CMV por produto). O plano detalhado é escrito no `tasks.md` da feature.

Fora do plano por decisão do dono: recebimento com conferência cega, temperatura, quarentena,
contagem de estoque e fiscal.

## Dados de teste

- `tests/builders/`: `anItem()`, `aSupplier()`, `aMovement()` com padrões sensatos.
- `tests/fixtures/manual/`: os exemplos numéricos do manual (filé mignon, CMV Sebrae PR, FC
  Aracaju) como dados reutilizáveis.
- Banco de integração: um container por execução, migrações aplicadas no início, transação com
  rollback por teste (ou truncate) para isolamento.
