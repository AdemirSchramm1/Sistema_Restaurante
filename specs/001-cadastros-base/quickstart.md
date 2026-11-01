# Quickstart: validar a feature 001 (cadastros base)

> Atualizado com a [feature 002](../002-simplificar-cadastro/spec.md): cadastro simples, sem
> quarentena, temperatura, unidade de receita nem folha de contagem.

Guia para provar, de ponta a ponta, que a feature funciona. Detalhes de dados em
[data-model.md](data-model.md) e de entradas/erros em [contracts/use-cases.md](contracts/use-cases.md).

## Pré-requisitos

- Node.js 22 LTS e pnpm 9
- Docker (para o PostgreSQL dos testes de integração via Testcontainers)
- Navegadores do Playwright (`pnpm exec playwright install chromium`)
- `.env.local` a partir de `.env.example`: `DATABASE_URL` (papel da aplicação, sem `BYPASSRLS`),
  `DATABASE_MIGRATION_URL` (papel dono), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `MAILER=memory` em desenvolvimento (o e-mail aparece no log) ou `MAILER=file` com `MAIL_DIR=.mail`
  (cada e-mail vira um arquivo; é o que os testes ponta a ponta usam)
- Sem Docker: defina `TEST_DATABASE_URL` com um PostgreSQL 16+ local para os testes de integração

## Rodar

```bash
pnpm install
pnpm db:up          # sobe PostgreSQL 17 local em container
pnpm db:migrate     # aplica migrações (tabelas, RLS, triggers, seed de unidades)
pnpm db:dev-login   # cria o login app_login (sem BYPASSRLS) usado em DATABASE_URL
pnpm dev            # http://localhost:3000
```

## Checagens automáticas

```bash
pnpm lint && pnpm typecheck
pnpm test:unit          # domínio: conversões, código, normalização, permissões (cobertura ≥ 90% em src/domain)
pnpm test:integration   # banco real: duplicidade, RLS, embalagem incompleta, medida bloqueada, auditoria
pnpm test:e2e           # Playwright: cadastro de item e convite do chef (MAILER=file)
```

Todos devem passar. Os testes obrigatórios estão em
[04-plano-de-testes](../../docs/sistema/estoque/04-plano-de-testes.md#001--cadastros-base).

## Roteiro manual (≈ 15 min, mede SC-001 e SC-006)

| # | Passo | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Criar conta "Restaurante Teste" | Entra como gerente; árvore padrão de grupos existe | US5.1, US2.1 |
| 2 | Tentar inativar o grupo "Bebidas" | Recusado | US2.2 |
| 3 | Aplicar locais sugeridos; criar "Câmara de carnes" do tipo Geladeira | Salva só com nome e tipo | 002 US2.1 |
| 4 | Convidar um chef (ver e-mail no log do mailer em memória) e aceitar em janela anônima | Chef entra; não vê botões de grupos/locais; tentar a ação direto devolve `FORBIDDEN` | US5.2, FR-003 |
| 5 | Como chef, cadastrar "Tomate italiano" em kg, sem embalagem, cronometrando | Código `01.xx.0001`; tempo ≤ 2 min | 002 US1.2, SC-001 |
| 6 | Cadastrar "Arroz" em kg comprado em "Saco" com 5 | A tela mostra "1 Saco = 5 kg" e salva | 002 US1.3 |
| 7 | Cadastrar de novo "tomate  ITALIANO" no mesmo subgrupo | Recusa mostrando o código do item existente | US1.4 |
| 8 | Preencher embalagem "Caixa" sem a quantidade | Erro no campo da quantidade; o resto do que foi digitado continua na tela | 002 US1.4 |
| 9 | Como gerente, ligar o arroz a dois locais e marcar um como principal | Só um fica principal | US3.5 |
| 10 | Abrir o formulário de item e de local | Não aparece temperatura, validade, alérgeno, EAN, NCM, contagem, receita nem fator | 002 US1.5, US2 |
| 11 | Abrir o mesmo item em duas abas, salvar nas duas | A segunda avisa que o registro mudou | FR-031 |
| 12 | Ver o histórico do item | Mostra quem criou, quem alterou, antes e depois | FR-004, SC-007 |
| 13 | Criar um segundo restaurante e abrir o link do item do primeiro | "Registro não encontrado" | SC-003 |