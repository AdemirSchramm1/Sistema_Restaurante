# Tarefas — 008 Painel de custo dos produtos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD). Todo teste é rodado antes do código e falha na asserção (esqueleto vazio quando o
módulo é novo), conforme [01-tdd](../../docs/sistema/01-tdd.md).

## Fase 1: Domínio

- [ ] T001 [teste] `product-cost.test.ts`: custo no preço do X-Burger (8,50 ÷ 28,00), faixas nos limites (35 e 40), sobra e prejuízo, o que mais pesa, ordem (maior %, sem preço, sem custo, nome), resumo, validação do preço
- [ ] T002 `src/domain/inventory/product-cost.ts`
- [ ] T003 [teste] `recipe-graph.test.ts`: `usesItem` direto, dentro de preparo em dois níveis, e não usa
- [ ] T004 `usesItem` em `recipe-graph.ts`
- [ ] T005 [teste] `recipe-input.test.ts`: formulário do preço (vírgula, em branco, inválido)
- [ ] T006 `parseSalePriceForm`

## Fase 2: Banco e casos de uso

- [ ] T007 [teste] Integração: salvar preço (trava otimista, auditoria, permissão, preparo recusado no caso de uso e no banco); painel com custo, %, faixa, ordem, o que mais pesa, sem preço, sem custo, só vendidos ativos; item usado direto e por preparo; isolamento
- [ ] T008 Migração `0008_sale_price`, repositório, casos de uso

## Fase 3: Telas

- [ ] T009 [teste] `product-cost-table.test.tsx`, `sale-price.test.tsx`, `item-usage.test.tsx`: resumo, barra e selo, sem preço, sem custo, prejuízo, vazio; quadro do preço; usado nos produtos
- [ ] T010 [teste] E2E (vermelho antes das páginas): comprar itens, cadastrar X-Burger, definir preço, ver no painel e no item; acessibilidade de Custos
- [ ] T011 Componentes, página Custos, quadro no produto, quadro no item, menu

## Fase 4: Docs

- [ ] T012 Atualizar docs de produto e sistema; marcar tarefas
