# Tarefas — 004 Compras, perdas e saldo

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD).

## Fase 0: Escopo

- [x] T000 Confirmar com o dono como fica o acerto manual: **com aprovação de outro gerente**

## Fase 1: Domínio

- [x] T001 [teste] `average-cost.test.ts`: exemplo do manual (10 a R$ 20 + 20 a R$ 25 = 23,333…), saldo zero, saldo negativo, custo zero, estorno de compra
- [x] T002 `src/domain/inventory/average-cost.ts`
- [x] T003 [teste] `movement.test.ts`: compra em embalagens vira medida; custo unitário pelo total; perda em g de item em kg; motivo obrigatório e do tipo certo; saldo insuficiente; pedido de acerto calcula a diferença e recusa sem diferença; quem pediu não aprova (`SELF_APPROVAL`); só pedido pendente é decidido; estorno inverte e não se estorna; data futura recusada
- [x] T004 `src/domain/inventory/movement.ts`
- [x] T005 [teste] `permissions.test.ts`: matriz de lançamentos por papel
- [x] T006 `permissions.ts`

## Fase 2: Banco e casos de uso

- [x] T007 [teste] Integração: livro só de inserção (permissão e gatilho); RLS; motivos semeados
- [x] T008 Schema, migração `0005_stock_ledger`, `movement-repository.ts`
- [x] T009 [teste] Integração: compra atualiza saldo, custo médio e último custo e trava a medida; perda com motivo; perda maior que o saldo; pedir, aprovar, recusar e cancelar acerto (saldo só muda na aprovação; outro gerente); estorno único; estorno de compra recalcula custo; idempotência; saídas concorrentes; propriedade saldo = livro; permissões e isolamento; item inativo; custo do produto aparece
- [x] T010 `movements.ts` (casos de uso) e `movement-input.ts`

## Fase 3: Telas

- [x] T011 [teste] `movement-form.test.tsx`: troca de tipo mostra os campos certos; "Vai entrar: 60 kg"; motivo só em perda e acerto; mantém o digitado no erro; lista de acertos pendentes com aprovar/recusar
- [x] T012 Formulário, página Lançamentos, saldo na lista de itens, quadro Estoque no item, menu
- [x] T013 [teste] E2E: comprar 3 caixas de tomate, perder 500 g, estornar a perda e ver o saldo; acessibilidade

## Fase 4: Docs

- [x] T014 Atualizar docs de produto e sistema; marcar tarefas
