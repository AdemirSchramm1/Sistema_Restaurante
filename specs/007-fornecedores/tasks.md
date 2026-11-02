# Tarefas — 007 Fornecedores

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD).

## Fase 1: Domínio

- [x] T001 [teste] `cnpj.test.ts`: CNPJ numérico válido e inválido, com e sem pontuação; dígitos repetidos; CNPJ alfanumérico válido e inválido; formatação
- [x] T002 `src/domain/suppliers/cnpj.ts`
- [x] T003 [teste] `supplier.test.ts`: nome obrigatório; e-mail; dias de entrega; prazo; pedido mínimo; item do fornecedor (preço > 0, embalagem em par, quantidade > 0); preço por medida; mais barato
- [x] T004 `src/domain/suppliers/supplier.ts`
- [x] T005 [teste] `permissions.test.ts`: `supplier.write` só gerente e comprador
- [x] T006 `permissions.ts`
- [x] T007 [teste] `movement.test.ts`: compra na embalagem do fornecedor
- [x] T008 `movement.ts`

## Fase 2: Banco e casos de uso

- [x] T009 [teste] Integração (inclui a tela de lançamento com todos os itens ativos, não só 50): criar, editar (trava otimista), CNPJ e nome repetidos, bloquear; itens do fornecedor com preferido único; item inativo recusado; compra com fornecedor e com a embalagem dele; fornecedor bloqueado recusado; fornecedor só na compra (banco); RLS; permissões e auditoria
- [x] T010 Schema, migração `0006_suppliers`, repositório, casos de uso e entrada

## Fase 3: Telas

- [x] T011 [teste] `supplier-form.test.tsx`: campos, dias da semana, mantém o digitado no erro; itens do fornecedor com preço por medida
- [x] T012 Páginas de fornecedores, quadro no item, campo "Fornecedor" na compra, menu
- [x] T013 [teste] E2E: cadastrar fornecedor com CNPJ, adicionar item com caixa, lançar compra na caixa dele e ver na página do item; acessibilidade

## Fase 4: Docs

- [x] T014 Atualizar docs de produto e sistema; marcar tarefas
