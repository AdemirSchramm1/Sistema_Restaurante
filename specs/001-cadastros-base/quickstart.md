# Quickstart: validar a feature 001 (cadastros base)

Guia para provar, de ponta a ponta, que a feature funciona. Detalhes de dados em
[data-model.md](data-model.md) e de entradas/erros em [contracts/use-cases.md](contracts/use-cases.md).

## Pré-requisitos

- Node.js 22 LTS e pnpm 9
- Docker (para o PostgreSQL dos testes de integração via Testcontainers)
- Navegadores do Playwright (`pnpm exec playwright install chromium`)
- `.env.local` a partir de `.env.example`: `DATABASE_URL` (papel da aplicação, sem `BYPASSRLS`),
  `DATABASE_MIGRATION_URL` (papel dono), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `MAILER=memory` em desenvolvimento

## Rodar

```bash
pnpm install
pnpm db:up          # sobe PostgreSQL 17 local em container
pnpm db:migrate     # aplica migrações (tabelas, RLS, triggers, seed de unidades)
pnpm dev            # http://localhost:3000
```

## Checagens automáticas

```bash
pnpm lint && pnpm typecheck
pnpm test:unit          # domínio: conversões, código, normalização, permissões (cobertura ≥ 90% em src/domain)
pnpm test:integration   # banco real: duplicidade, RLS, quarentena, unidade bloqueada, auditoria
pnpm test:e2e           # Playwright: cadastro de item com três unidades
```

Todos devem passar. Os testes obrigatórios estão em
[04-plano-de-testes](../../docs/sistema/estoque/04-plano-de-testes.md#001--cadastros-base).

## Roteiro manual (≈ 15 min, mede SC-001 e SC-006)

| # | Passo | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Criar conta "Restaurante Teste" | Entra como gerente; árvore padrão de grupos e local "Recebimento / quarentena" existem | US5.1, US2.1, US3.1 |
| 2 | Tentar inativar o grupo "Bebidas" e a quarentena | Recusado nos dois casos | US2.2, US3.1 |
| 3 | Aplicar locais sugeridos; criar "Câmara de carnes" refrigerada sem faixa | Recusa pedindo a faixa; com 0 a 4 °C salva | US3.2 |
| 4 | Convidar um chef (ver e-mail no log do mailer em memória) e aceitar em janela anônima | Chef entra; não vê botões de grupos/locais; tentar a ação direto devolve `FORBIDDEN` | US5.2, FR-003 |
| 5 | Como chef, cadastrar "Tomate italiano, caixa 20 kg, tipo AA" (kg / g / Caixa 20 kg, fator 20) cronometrando | Código `01.xx.0001`, equivalência 1 caixa = 20 kg = 20.000 g; tempo ≤ 2 min | US1.1, SC-001 |
| 6 | Simular 2 caixas e 0,5 caixa | 40 kg e 10 kg | FR-022 |
| 7 | Cadastrar de novo "tomate  ITALIANO, caixa 20 kg, tipo aa" no mesmo subgrupo | Recusa mostrando o código do item existente | US1.4 |
| 8 | Cadastrar "Ovo branco" em un com receita em g sem conversão; depois com 1 un = 50 g | Primeiro recusa, depois salva | US1.5 |
| 9 | Como gerente, vincular "Detergente" à câmara | Recusa `LOCATION_INCOMPATIBLE` | US3.4 |
| 10 | Abrir a folha da câmara com itens nas posições 3, 1, 2 | Lista em 1, 2, 3 | US3.6 |
| 11 | Abrir o mesmo item em duas abas, salvar nas duas | A segunda avisa que o registro mudou | FR-031 |
| 12 | Ver o histórico do item | Mostra quem criou, quem alterou, antes e depois | FR-004, SC-007 |
| 13 | Criar um segundo restaurante e abrir o link do item do primeiro | "Registro não encontrado" | SC-003 |
