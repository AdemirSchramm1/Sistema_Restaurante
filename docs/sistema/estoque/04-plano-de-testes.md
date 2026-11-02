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
| I | Nova versão ao editar; o pedido usa a versão vigente na data |
| I | Item inativo não entra em produto novo |
| E | Cadastrar "X-Burger" com pão, carne e queijo e ver o custo |

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
| I | Acerto manual exige motivo e grava a diferença como `ADJUSTMENT` |
| I | Primeira movimentação trava a medida do item |
| E | Lançar compra, depois perda com motivo, e ver o saldo |

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
| U | Validação de CNPJ (dígitos verificadores) |
| U | No máximo um fornecedor preferencial por item |
| I | CNPJ único por restaurante |
| I | Embalagem e preço por fornecedor |

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
