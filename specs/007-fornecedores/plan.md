# Plano técnico: 007 — Fornecedores

**Branch**: `claude/project-thread-8lg7o1` | **Data**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Resumo

Duas tabelas editáveis (`suppliers`, `supplier_items`) com RLS e trava otimista, e uma coluna
nova `supplier_id` no livro (`stock_movements`, só na compra). Domínio puro para CNPJ (numérico e
alfanumérico), validação do fornecedor, do item do fornecedor e preço por medida. Mesma stack;
nenhuma dependência nova.

## Constituição

| Princípio | Como a 007 cumpre |
|---|---|
| I. Testes primeiro | `test(007)` antes de cada `feat(007)`: CNPJ, fornecedor, permissões, integração, formulário, e2e |
| II. Domínio puro | `src/domain/suppliers/cnpj.ts` e `supplier.ts`, sem banco |
| III. Livro imutável | `supplier_id` entra só na inserção da compra; nada é alterado no livro |
| IV. Precisão | Preço `numeric(14,4)`, pedido mínimo `numeric(14,2)`, quantidade da embalagem `numeric(14,4)` |
| V. Rastreabilidade | Auditoria em `supplier` (cadastro, bloqueio e itens); tentativa negada registrada |
| VI. Docs vivas | 03-fornecedores, 06-movimentacoes, 09-permissões, 13-decisões, modelo de dados, glossário, plano de testes |
| VII. Simplicidade | Só dados comerciais; status é ativo/bloqueado; sem histórico de preço |

## Modelo de dados (migração `0006_suppliers`)

```text
suppliers        id, restaurant_id, name, name_normalized, legal_name, cnpj (char 14) null,
                 contact_name, phone, email, delivery_days smallint[], lead_time_days smallint,
                 min_order_value numeric(14,2), payment_terms, notes, active,
                 created/updated, version
                 únicos: (restaurant_id, cnpj) onde cnpj não nulo; (restaurant_id, name_normalized) onde ativo
supplier_items   id, restaurant_id, supplier_id, item_id, package_label, package_quantity
                 numeric(14,4), price numeric(14,4), preferred, created/updated, version
                 únicos: (supplier_id, item_id); (restaurant_id, item_id) onde preferred
                 checks: price > 0; embalagem em par; quantidade > 0
stock_movements  + supplier_id uuid null fk; check: supplier_id só em PURCHASE
```

`supplier_items` é configuração (não é livro): remover um item do fornecedor apaga a linha e
registra na auditoria.

## Decisões

- **CNPJ opcional**: feirante e produtor rural muitas vezes não têm. Se informado, é validado e
  único.
- **CNPJ alfanumérico**: valor de cada caractere = código ASCII − 48; pesos e dígitos iguais ao
  numérico. Os dois dígitos verificadores são sempre números.
- **Bloqueado** em vez de inativo: o fornecedor continua visível com o selo "Bloqueado"; só some da
  escolha na compra.
- **Embalagem do fornecedor na compra**: a medida `SUPPLIER_PACKAGE` é resolvida no caso de uso
  (busca o item do fornecedor) e chega ao domínio como embalagem com nome e quantidade.
- **Preço não muda com a compra**: o preço cadastrado é o combinado; a última compra aparece ao
  lado para comparar.
- Telas: `/estoque/fornecedores` (lista com busca e filtro), `/estoque/fornecedores/novo`,
  `/estoque/fornecedores/[id]` (dados, itens que vende, bloquear, histórico); quadro
  "Fornecedores" no item; campo "Fornecedor" no lançamento de compra.

## Arquivos

```text
src/domain/suppliers/        cnpj.ts, supplier.ts (+ testes)
src/domain/access/           permissions.ts (supplier.write)
src/domain/inventory/        movement.ts (embalagem do fornecedor na compra)
src/application/suppliers/   ports.ts, suppliers.ts, supplier-input.ts
src/infra/db/                schema/suppliers.ts, migrations/0006_suppliers.sql, supplier-repository.ts
src/actions/                 suppliers.ts
src/components/suppliers/    supplier-form.tsx, supplier-items.tsx
app/(app)/estoque/           fornecedores/(page, novo, [id]); itens/[id] (quadro); lancamentos (campo)
```

## Riscos

- Duas pessoas marcando preferidos diferentes ao mesmo tempo: o índice único parcial garante um
  só; o caso de uso desmarca o anterior na mesma transação.
