# Contrato: portões de validação da 018

Cada portão é um comando que falha (código de saída diferente de 0) se a régua não for cumprida.

| Comando | Régua | Escopo (arquivos medidos) | Testes que roda |
|---|---|---|---|
| `pnpm test:mutation` | 100% (`break: 100`) | `src/domain/**/*.ts` sem testes | `src/domain/**/*.test.ts` |
| `pnpm test:billing` | 100% linhas, desvios, funções, instruções | `src/domain/billing/**`, `src/application/billing/**`, `src/components/billing/**`, `src/infra/db/repositories/billing-repository.ts` | unidade + integração de `billing` |
| `pnpm test:stock` | idem | `src/domain/inventory/**`, `src/application/inventory/**`, componentes `items`, `groups`, `movements`, `recipes`, `costs`, `reorder`, `reports`, `audit`, repositórios `item`, `group`, `movement`, `recipe`, `report` | unidade + integração de estoque |
| `pnpm test:orders` | idem | `src/domain/{ordering,suppliers,shared}/**` fora das réguas da 013 a 016, `src/application/{ordering,suppliers}/**` fora delas, componentes `ordering` fora delas, `suppliers`, `layout`, repositórios `ordering`, `addon`, `supplier` | unidade + integração de pedidos e fornecedores |
| `scripts/screens.sh tests/screens/operations.spec.ts` | sem falha | Cozinha, Garçom, Conta da mesa, Lançamentos | testes de tela |

Arquivo que já está em `test:menu`, `test:cash` ou `test:staff` continua lá; pode aparecer em dois
portões. A lista exata de cada portão fica no `vitest.config.mts`, com comentário apontando para
esta spec.

Proibido em qualquer portão: `exclude` de arquivo de produção, `/* v8 ignore */`,
`// Stryker disable`, `ignoreStatic`, baixar `thresholds`.
