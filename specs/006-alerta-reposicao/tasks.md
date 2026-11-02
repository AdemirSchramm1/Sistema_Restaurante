# Tarefas — 006 Alerta de reposição e gráficos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD).

## Fase 1: Domínio

- [ ] T001 [teste] `reorder.test.ts`: caso do filé mignon (ES, PP, par, pedir), com trânsito, acima do par, arredondar para embalagem; item no ponto; validação dos campos; ciclo pelos dias de entrega; sugestão a partir do consumo
- [ ] T002 `src/domain/inventory/reorder.ts`
- [ ] T003 [teste] `stock-report.test.ts`: período (7/30/90), mais saíram, menos saíram (com parados), largura das barras, semanas
- [ ] T004 `src/domain/inventory/stock-report.ts`
- [ ] T005 [teste] `permissions.test.ts`: `item.reorder` para gerente, chef e comprador
- [ ] T006 `permissions.ts`

## Fase 2: Banco e casos de uso

- [ ] T007 [teste] Integração: salvar aviso (trava otimista, auditoria, permissão, validação no banco); item no ponto aparece na lista "Repor" com quanto comprar e fornecedor preferido; contador; saídas sem estornos; gráficos por item, motivo e semana; isolamento
- [ ] T008 Migração `0007_reorder_levels`, repositório de relatórios, casos de uso e entrada

## Fase 3: Telas

- [ ] T009 [teste] `bar-list.test.tsx`, `reorder-levels.test.tsx`: barras proporcionais, vazio, "parado"; formulário do aviso com sugestão
- [ ] T010 Página Repor, página Gráficos, quadro no item, selo na lista, menu com contador
- [ ] T011 [teste] E2E: definir aviso, lançar perda até o ponto, ver em Repor e nos gráficos; acessibilidade

## Fase 4: Docs

- [ ] T012 Atualizar docs de produto e sistema; marcar tarefas
