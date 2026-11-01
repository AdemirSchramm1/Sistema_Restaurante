# Estoque — Plano de testes

Mapa de **o que precisa ter teste** antes de cada feature do [roadmap](../../produto/estoque/00-visao-geral.md#roadmap)
ser considerada pronta. Os testes são escritos primeiro (ver [TDD](../01-tdd.md)).

Legenda: **U** = unidade (domínio), **I** = integração (banco real), **E** = ponta a ponta.

## 001 — Cadastros base

| Nível | Teste |
|---|---|
| U | Conversões de unidade (todos os casos de [02-regras-de-calculo](02-regras-de-calculo.md#conversão-de-unidades--unitsts)) |
| U | Geração de código `GG.SS.NNNN` sequencial por subgrupo |
| U | Normalização de descrição (acentos, caixa, espaços) para detectar duplicidade |
| I | Duplicidade de descrição normalizada no mesmo subgrupo é rejeitada |
| I | Unidade de estoque não muda após 1ª movimentação (`ITEM_UNIT_LOCKED`) |
| I | Local refrigerado sem faixa de temperatura é rejeitado (check constraint) |
| I | Local "Quarentena" não pode ser apagado |
| I | **Isolamento de tenant**: restaurante A não lê/grava itens de B |
| U | Permissões por papel (gerente faz tudo; chef cria e edita itens; demais só leem) |
| U | Sempre um gerente ativo (`LAST_MANAGER`); convite vence em 7 dias |
| U | Campos opcionais do item: FC ≥ 1, rendimento em (0, 1], EAN com dígito verificador, NCM, CEST, origem, alérgenos da RDC 26/2015 |
| U | Compatibilidade item × local (químico só em local de químicos, quarentena ou trânsito) |
| I | **RLS**: toda tabela com `restaurant_id` tem política; sem restaurante definido nada volta |
| I | Auditoria só de inserção; tentativa negada vira `DENIED` |
| I | Edição concorrente devolve `STALE_RECORD` (trava otimista) |
| I | Convite: só o hash do token no banco; repetido, revogado, vencido, e-mail de outro restaurante |
| I | Membro desativado perde o acesso; o histórico mantém o usuário |
| I | Todos os campos de FR-025 gravam e voltam sem perder precisão |
| I | Busca na lista com 2.000 itens em até 1 s (SC-005) |
| E | Criar conta, aceitar locais sugeridos, cadastrar item com três unidades, ligar a um local e ver na folha de contagem |
| E | Gerente convida chef; chef aceita, não gerencia grupos e cadastra item |
| E | Acessibilidade: nenhuma falha grave do axe (WCAG 2.1 AA) nas telas públicas, de estoque e de equipe |
| U | Formulários mantêm o que foi digitado quando o servidor recusa |

## 002 — Fornecedores

| Nível | Teste |
|---|---|
| U | Validação de CNPJ (dígitos verificadores) |
| U | No máximo um fornecedor preferencial por item |
| I | CNPJ único por restaurante |
| I | Fornecedor bloqueado não recebe pedido nem recebimento |
| I | De-para: código do fornecedor resolve para o item interno e o fator |

## 003 — Movimentações e saldo

| Nível | Teste |
|---|---|
| U | Custo médio (todos os casos) |
| U | Cada tipo gera as linhas e sinais corretos |
| U | Motivo obrigatório e compatível com o tipo |
| I | Saldo = soma do livro após sequência aleatória de operações (teste de propriedade) |
| I | `UPDATE`/`DELETE` em `stock_movements` falha |
| I | Estorno único por movimentação |
| I | Duas saídas concorrentes não deixam saldo inconsistente |
| I | `idempotency_key` repetido não duplica lançamento |
| I | Saída que deixaria saldo negativo é bloqueada (exceto venda, conforme decisão) |
| E | Lançar perda com motivo e ver o saldo cair |

## 004 — Fichas técnicas

| Nível | Teste |
|---|---|
| U | FC, IC, quantidade bruta, custo da linha, custo da ficha, % CMV |
| U | Recursão em sub-receitas e detecção de ciclo |
| U | Herança de alérgenos |
| I | Nova versão ao editar; venda usa a versão vigente na data |
| I | Ordem de produção: baixa ingredientes, entra sub-receita com custo pelo rendimento real |

## 005 — Recebimento

| Nível | Teste |
|---|---|
| U | Checagem de temperatura por categoria |
| U | Tolerância de custo |
| U | Cruzamento pedido × NF × físico classifica divergências |
| I | API de conferência cega **não** retorna quantidades da NF/pedido ao estoquista |
| I | Quem conferiu não pode lançar a NF (segregação) |
| I | Recusado vai para Quarentena |
| E | Receber entrega com uma linha recusada por temperatura |

## 006 — Contagem e ajuste

| Nível | Teste |
|---|---|
| U | Acurácia do inventário |
| I | Tela/API de contagem não expõe saldo do sistema |
| I | Ajuste não pode ser aprovado por quem lançou/contou |
| I | Aprovação gera `ADJUSTMENT` com referência à contagem |
| E | Fazer contagem de um local na ordem da folha e aprovar ajuste |

## 007 a 012

Casos de domínio já listados em [02-regras-de-calculo](02-regras-de-calculo.md) (reposição, CMV,
indicadores, validade). O plano detalhado de cada uma é escrito no `tasks.md` da feature.

## Dados de teste

- `tests/builders/`: `anItem()`, `aSupplier()`, `aLocation()`, `aMovement()` com padrões sensatos.
- `tests/fixtures/manual/`: os exemplos numéricos do manual (filé mignon, CMV Sebrae PR, FC
  Aracaju) como dados reutilizáveis.
- Banco de integração: um container por execução, migrações aplicadas no início, transação com
  rollback por teste (ou truncate) para isolamento.
