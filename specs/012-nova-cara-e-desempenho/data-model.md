# Modelo de dados — 012

Nenhuma tabela nova e nenhuma coluna nova. A migração `0012_performance` só acrescenta índices e
amplia uma função. Motivo de cada um em [research.md](research.md#r2-consultas-que-leem-a-tabela-inteira).

## Índices novos

| Índice | Tabela e colunas | Consulta que passa a usar |
|---|---|---|
| `order_line_removals_line` | `order_line_removals (order_line_id)` | retiradas das linhas dos pedidos (cozinha, garçom, conta, pedidos, consumo) |
| `recipe_removables_recipe` | `recipe_removables (recipe_id, position)` | retiradas oferecidas no cardápio e no produto |
| `recipes_kind_name` | `recipes (restaurant_id, kind, name_normalized)` | produtos vendidos do cardápio, lista de produtos |
| `dining_tables_restaurant` | `dining_tables (restaurant_id, name_normalized)` | lista de mesas |
| `item_subgroups_restaurant_code` | `item_subgroups (restaurant_id, code)` | árvore de grupos |
| `suppliers_restaurant_name` | `suppliers (restaurant_id, name_normalized)` | lista de fornecedores (com inativos) |
| `addons_restaurant_name` | `addons (restaurant_id, name_normalized)` | lista de adicionais |

Os índices parciais e únicos que já existem continuam (garantem as regras de nome único e de
retirada única).

## Função ampliada

```sql
app_membership_for_user(p_user_id uuid)
  RETURNS TABLE (restaurant_id uuid, membership_id uuid, active boolean, roles text[])
```

Continua `SECURITY DEFINER`, `STABLE`, só executável por `app_user`. A coluna nova `roles` traz os
papéis do membro em ordem alfabética (`array_agg(role order by role)`), vazia se não houver.
`resolveContext` monta o contexto com essa consulta só.
