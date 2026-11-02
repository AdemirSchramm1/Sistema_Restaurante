# Tarefas — 007 Fornecedores

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Cada tarefa de código vem depois do teste que
a exige (TDD).

## Fase 1: Domínio

- [ ] T001 [teste] `cnpj.test.ts`: CNPJ numérico válido e inválido, com e sem pontuação; dígitos repetidos; CNPJ alfanumérico válido e inválido; formatação
- [ ] T002 `src/domain/suppliers/cnpj.ts`
- [ ] T003 [teste] `supplier.test.ts`: nome obrigatório; e-mail; dias de entrega; prazo; pedido mínimo; item do fornecedor (preço > 0, embalagem em par, quantidade > 0); preço por medida; mais barato
- [ ] T004 `src/domain/suppliers/supplier.ts`
- [ ] T005 [teste] `permissions.test.ts`: `supplier.write` só gerente e comprador
- [ ] T006 `permissions.ts`
- [ ] T007 [teste] `movement.test.ts`: compra na embalagem do fornecedor
- [ ] T008 `movement.ts`

## Fase 2: Banco e casos de uso

- [ ] T009 [teste] Integração: criar, editar (trava otimista), CNPJ e nome repetidos, bloquear; itens do fornecedor com preferido único; item inativo recusado; compra com fornecedor e com a embalagem dele; fornecedor bloqueado recusado; fornecedor só na compra (banco); RLS; permissões e auditoria
- [ ] T010 Schema, migração `0006_suppliers`, repositório, casos de uso e entrada

## Fase 3: Telas

- [ ] T011 [teste] `supplier-form.test.tsx`: campos, dias da semana, mantém o digitado no erro; itens do fornecedor com preço por medida
- [ ] T012 Páginas de fornecedores, quadro no item, campo "Fornecedor" na compra, menu
- [ ] T013 [teste] E2E: cadastrar fornecedor com CNPJ, adicionar item com caixa, lançar compra na caixa dele e ver na página do item; acessibilidade

## Fase 4: Docs

- [ ] T014 Atualizar docs de produto e sistema; marcar tarefas
