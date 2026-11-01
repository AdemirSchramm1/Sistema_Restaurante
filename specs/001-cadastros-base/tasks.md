---

description: "Lista de tarefas da feature 001 — cadastros base do estoque"
---

# Tasks: Cadastros base do estoque (grupos, unidades, locais, itens)

**Input**: Design documents from `/specs/001-cadastros-base/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/use-cases.md](contracts/use-cases.md),
[quickstart.md](quickstart.md)

**Tests**: **obrigatórios**. A constituição (princípio I) exige TDD: em cada fase, as tarefas de
teste vêm antes e precisam **falhar** antes da implementação correspondente. Nomes de teste em
português; o `describe` cita o documento de produto da regra
([01-tdd](../../docs/sistema/01-tdd.md)).

**Organization**: tarefas agrupadas por história de usuário. A ordem das fases segue a prioridade da
spec (P1: US1, US2, US5; P2: US3; P3: US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: história da spec (US1 a US5)
- Caminhos relativos à raiz do repositório, conforme a estrutura do [plan.md](plan.md#project-structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: criar o projeto, as ferramentas e a CI (research R15).

- [x] T001 Criar o app Next.js (App Router, TypeScript `strict`, pnpm, Node 22) na raiz, com `package.json`, `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`) e `next.config.ts`
- [x] T002 [P] Configurar Tailwind CSS e shadcn/ui (`components.json`, `app/globals.css`, `src/components/ui/`), tema neutro, `lang="pt-BR"` em `app/layout.tsx`
- [x] T003 [P] Configurar ESLint + Prettier em `eslint.config.mjs`: `eslint-plugin-boundaries` (domínio não importa `application`, `infra`, `app`, `actions`, React), proibir `parseFloat`/`Number(`/`Date.now`/`new Date(` em `src/domain/**` e `parseFloat`/`Number(` em `src/application/**`, proibir `.only` em testes
- [x] T004 [P] Configurar Vitest em `vitest.config.ts` com projetos `unit` (`src/**/*.test.ts(x)`, jsdom para `.tsx`) e `integration` (`tests/integration/**`), cobertura v8 com limite de 90% de linhas em `src/domain/**`
- [x] T005 [P] Configurar Playwright em `playwright.config.ts` (chromium, `baseURL` local, `webServer` com `pnpm dev`) e pasta `tests/e2e/`
- [x] T006 [P] Criar `docker-compose.yml` com `postgres:17` e scripts `db:up`, `db:migrate`, `db:generate`, `test:unit`, `test:integration`, `test:e2e`, `lint`, `typecheck` em `package.json`
- [x] T007 [P] Criar `.env.example` com `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MAILER`, `RESEND_API_KEY` e garantir `.env*.local` no `.gitignore`
- [x] T008 [P] Criar a CI em `.github/workflows/ci.yml`: install → lint → typecheck → test:unit (com cobertura) → test:integration (Docker disponível no runner) → test:e2e

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test:unit` rodam (sem testes ainda) e a CI fica verde num PR vazio.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: núcleo compartilhado por todas as histórias: decimal, Result, auditoria, permissões,
banco com RLS, transação por restaurante, autenticação e criação do restaurante com dados padrão.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase terminar.

### Testes da fundação (escrever primeiro, devem falhar)

- [x] T009 [P] Testes de `d()`, `parseBrDecimal` ("1,5" → 1.5; "1.234,56" → 1234.56; "abc" → `INVALID_NUMBER`) e `formatBrDecimal` (half-up só na exibição) em `src/domain/shared/decimal.test.ts`
- [x] T010 [P] Testes de `diffFields(before, after)` (só campos alterados, `{campo: [antes, depois]}`, Decimal comparado por valor) em `src/domain/shared/audit.test.ts`
- [x] T011 [P] Testes da matriz `can(roles, action)` da [tabela de permissões](contracts/use-cases.md#matriz-de-permissões-fr-003): gerente pode tudo; chef só `catalog.read` e `item.write`; estoquista, comprador e administrativo só `catalog.read`; usuário com vários papéis soma permissões, em `src/domain/access/permissions.test.ts`
- [x] T012 [P] Testes de `convert`: 1,5 kg → 1500 g; 1000 ml → 1 l; kg → un sem conversão do item → `UNIT_DIMENSION_MISMATCH`; un → g com conversão do item "1 un = 50 g" → 3 un = 150 g; inverso g → un calculado, em `src/domain/inventory/units.test.ts`
- [x] T013 [P] Testes de `default-tree`: 13 grupos do [doc 01](../../docs/produto/estoque/01-grupos-de-itens.md#árvore-de-grupos-padrão) com códigos `01`…`13` únicos, "Higiene e limpeza" com `storageClass = CHEMICAL` e `inCogs = false`, alimentares com `FOOD`, cada grupo com ≥ 1 subgrupo de exemplo com códigos de 2 dígitos únicos no grupo, em `src/domain/inventory/default-tree.test.ts`
- [x] T014 Teste de integração do banco em `tests/integration/rls.test.ts`: com dois restaurantes A e B, uma sessão com `app.restaurant_id = A` não lê nem grava linha de B em nenhuma tabela com `restaurant_id` (lista as tabelas pelo catálogo do Postgres, para pegar tabelas novas automaticamente); sem `app.restaurant_id` nenhuma linha volta
- [x] T015 [P] Teste de integração em `tests/integration/audit-log.test.ts`: `UPDATE` e `DELETE` em `audit_log` falham com o papel da aplicação
- [x] T016 [P] Teste de integração em `tests/integration/sign-up-restaurant.test.ts` (US5.1 base): `signUpRestaurant` cria restaurante, usuário, membership ativa com `MANAGER`, a árvore padrão completa e o local "Recebimento / quarentena" com `kind = QUARANTINE` e `is_system = true`; e-mail repetido → `EMAIL_IN_USE`

### Implementação da fundação

- [x] T017 [P] Implementar `src/domain/shared/decimal.ts` (decimal.js, `d`, `parseBrDecimal`, `formatBrDecimal`) e `src/domain/shared/result.ts` (`Result<T, DomainError>` com `code`, `field?`, `details?`)
- [x] T018 [P] Implementar `src/domain/shared/audit.ts` (`diffFields`)
- [x] T019 [P] Implementar `src/domain/access/permissions.ts` (`Role`, `Action`, `can`, `assertCan` → `FORBIDDEN`)
- [x] T020 [P] Implementar `src/domain/inventory/units.ts` (`Unit` com `dimension` e `toBase`, `convert`, `toStockUnit`, `fromStockUnit`)
- [x] T021 [P] Implementar `src/domain/inventory/default-tree.ts` (constante com grupos, `storageClass`, `inCogs`, subgrupos de exemplo) e `src/domain/inventory/suggested-locations.ts` (modelos do [doc 05](../../docs/produto/estoque/05-locais.md#locais-sugeridos-no-cadastro-inicial))
- [x] T022 Criar o schema Drizzle de acesso e catálogo em `src/infra/db/schema/` (`restaurants`, `memberships`, `membership_roles`, `invitations`, `units`, `item_groups`, `item_subgroups`, `locations`, `items`, `item_unit_conversions`, `item_locations`, `audit_log`), com colunas comuns (`id uuid` v7, `restaurant_id`, `created_at`, `created_by`; `updated_at`, `updated_by`, `version` nas editáveis) e tipos exatamente como em [data-model.md](data-model.md); `numeric` em modo string
- [x] T023 Gerar a migração inicial em `src/infra/db/migrations/` e acrescentar SQL manual: papéis `app_user` (sem `BYPASSRLS`, só `INSERT`/`SELECT` em `audit_log`) e dono de migração; `enable row level security` + política `restaurant_id = current_setting('app.restaurant_id', true)::uuid` em toda tabela com `restaurant_id` (em `restaurants`: `id = …`); trigger contra `UPDATE`/`DELETE` em `audit_log`; extensão `pg_trgm`; seed de `units` (`g` MASS 1, `kg` MASS 1000, `ml` VOLUME 1, `l` VOLUME 1000, `un` COUNT 1)
- [x] T024 Implementar `src/infra/db/client.ts` e `src/infra/db/tx.ts` (`withTenantTx(restaurantId, fn)` com `set_config('app.restaurant_id', $1, true)` dentro da transação)
- [x] T025 [P] Criar o harness de integração em `tests/integration/setup.ts` (Testcontainers `postgres:17`, aplica migrações com o papel dono, conecta como `app_user`, limpa entre testes) e builders em `tests/builders/` (`restaurantBuilder`, `memberBuilder`, `itemBuilder`, `locationBuilder`)
- [x] T026 [P] Implementar portas `Clock`, `IdGenerator` (UUID v7) e `Mailer` em `src/application/ports.ts`, com `src/infra/mailer/memory.ts` e `src/infra/mailer/resend.ts`
- [x] T027 Implementar `src/application/context.ts` (`RequestContext { userId, restaurantId, roles, origin }`) e `src/infra/db/repositories/audit-repository.ts` (grava `audit_log` na transação corrente)
- [x] T028 Configurar Better Auth em `src/infra/auth/auth.ts` (e-mail e senha, senha ≥ 8 caracteres, sessão em cookie, adaptador Drizzle, recuperação de senha pelo `Mailer`) e a rota `app/api/auth/[...all]/route.ts`
- [x] T029 Implementar `src/actions/_session.ts` (`withContext(action)`: lê a sessão → `UNAUTHENTICATED`; carrega membership ativa e papéis; monta `origin` com IP e user agent; converte `Result` para a resposta da ação)
- [x] T030 Implementar o caso de uso `src/application/access/sign-up-restaurant.ts` (cria usuário via Better Auth, restaurante com `timezone = America/Sao_Paulo`, membership `MANAGER`, árvore padrão, quarentena; auditoria `CREATE`) e a ação em `src/actions/access.ts`
- [x] T031 [P] Criar as páginas `app/(auth)/criar-conta/page.tsx`, `app/(auth)/entrar/page.tsx` e `app/(auth)/recuperar-senha/page.tsx`, e o layout autenticado `app/(app)/layout.tsx` com menu (Itens, Grupos, Locais, Equipe), que redireciona para `/entrar` sem sessão
- [x] T032 [P] Implementar `src/components/forms/decimal-input.tsx` (aceita vírgula, usa `parseBrDecimal`) e `src/components/forms/form-error.tsx` (mapeia código de erro → mensagem pt-BR da [tabela de erros](contracts/use-cases.md#erros-códigos-estáveis-e-texto-da-interface)) em `src/components/forms/error-messages.ts`

**Checkpoint**: T009–T016 verdes; é possível criar conta, entrar e ver o menu vazio. A partir daqui as histórias podem andar em paralelo.

---

## Phase 3: User Story 1 - Cadastrar um item com as três unidades (Priority: P1) 🎯 MVP

**Goal**: gerente ou chef cadastra item com unidade de estoque, de receita e de compra padrão; o
sistema gera o código, mostra a equivalência e o item aparece na lista.

**Independent Test**: com a árvore padrão, cadastrar "Tomate italiano, caixa 20 kg, tipo AA" e
conferir código, equivalência (2 caixas = 40 kg = 40.000 g) e busca na lista.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem falhar)

- [x] T033 [P] [US1] Testes de `formatItemCode` em `src/domain/inventory/item-code.test.ts`: ("01","02",1) → `01.02.0001`; seq 9999 → `01.02.9999`; seq 10000 → `SUBGROUP_SEQUENCE_EXHAUSTED`
- [x] T034 [P] [US1] Testes de `normalizeDescription` em `src/domain/inventory/description.test.ts`: "tomate  ITALIANO, caixa 20 kg, tipo aa" = "Tomate italiano, caixa 20 kg, tipo AA"; "Pão francês" = "pao  FRANCES"; espaços nas pontas removidos
- [x] T035 [P] [US1] Testes de `validateItem` (parte de unidades) em `src/domain/inventory/item.test.ts`: `purchaseFactor` "Caixa com 12" fator 12 → 20 caixas = 240 un e 2 caixas = 24 un; 120 un de caixa de 240 = 0,5 caixa; fator 0 ou negativo → `INVALID_FACTOR`; estoque `un` + receita `g` sem conversão → `MISSING_ITEM_CONVERSION`; com "1 un = 50 g" passa; descrição com menos de 3 ou mais de 200 caracteres → erro
- [x] T036 [P] [US1] Testes de `canChangeStockUnit` em `src/domain/inventory/item.test.ts`: com `stockUnitLockedAt` preenchido → `ITEM_UNIT_LOCKED`; sem → ok
- [x] T037 [P] [US1] Teste de integração em `tests/integration/items/create-item.test.ts`: primeiro item do subgrupo 01.02 recebe `01.02.0001`, segundo `01.02.0002`; 10 criações concorrentes no mesmo subgrupo geram 10 códigos distintos e sequenciais; duplicidade de descrição normalizada no mesmo subgrupo → `ITEM_DUPLICATE_DESCRIPTION` com `details.existingCode`; mesma descrição em outro subgrupo passa; campos `code`, `averageCost`, `abcClass` na entrada são rejeitados; auditoria `CREATE` gravada
- [x] T038 [P] [US1] Teste de integração em `tests/integration/items/stock-unit-lock.test.ts`: com `stock_unit_locked_at` preenchido direto no banco, `updateItem` trocando a unidade → `ITEM_UNIT_LOCKED`; `UPDATE` SQL direto em `stock_unit_id` também falha (trigger)
- [x] T039 [P] [US1] Teste de integração em `tests/integration/items/permissions.test.ts`: estoquista chamando `createItem` → `FORBIDDEN` e auditoria `DENIED`; chef consegue
- [x] T040 [P] [US1] Teste de integração em `tests/integration/items/tenant-isolation.test.ts`: usuário de B chamando `getItem` com id de item de A → `NOT_FOUND`; `listItems` de B não contém itens de A (SC-003)
- [x] T041 [P] [US1] Teste de integração em `tests/integration/items/stale-record.test.ts`: dois `updateItem` com a mesma `version` → o segundo devolve `STALE_RECORD` (FR-031)
- [x] T042 [P] [US1] Teste E2E em `tests/e2e/create-item.spec.ts`: criar conta, cadastrar o tomate com kg / g / "Caixa 20 kg" fator 20, ver o código e a equivalência, buscar por "tomate" e encontrar na lista

### Implementation for User Story 1

- [x] T043 [P] [US1] Implementar `src/domain/inventory/item-code.ts` (`formatItemCode`, `nextTwoDigitCode`)
- [x] T044 [P] [US1] Implementar `src/domain/inventory/description.ts` (`normalizeDescription` com NFD, minúsculas e espaços)
- [x] T045 [US1] Implementar `src/domain/inventory/item.ts`: tipos `ItemType` (`INGREDIENT`, `RESALE`, `PRODUCED`, `CONSUMABLE`, `ASSET`), `validateItem` (unidades, "`purchase_factor` numeric(14,4) > 0, em unidades de estoque", descrição "3–200 caracteres"), `canChangeStockUnit`, `stockUnitEquivalence` (1 compra = N estoque = M receita)
- [x] T046 [US1] Implementar `src/infra/db/repositories/item-repository.ts` (inserir com `select … for update` no subgrupo para `next_item_seq`, atualizar com `where version = $v`, buscar por id, listar com filtros e paginação de 50, mapear violação do índice único parcial para `ITEM_DUPLICATE_DESCRIPTION`)
- [x] T047 [US1] Implementar casos de uso `src/application/inventory/create-item.ts`, `update-item.ts`, `get-item.ts`, `list-items.ts`, `preview-conversion.ts` (assertCan, validação de domínio, auditoria com `diffFields`)
- [x] T048 [US1] Implementar as ações em `src/actions/items.ts` com schemas Zod `strict` (rejeitam `code`, custos e `abcClass`)
- [x] T049 [P] [US1] Criar `src/components/items/item-form.tsx` (bloco identificação: descrição, grupo/subgrupo, tipo; bloco unidades: estoque, receita, compra padrão e fator, conversões específicas quando a dimensão muda; prévia da equivalência e simulador de conversão com frações) e teste de componente em `src/components/items/item-form.test.tsx` (mostra o campo de conversão quando estoque `un` e receita `g`)
- [x] T050 [US1] Criar as páginas `app/(app)/estoque/itens/page.tsx` (lista com busca por código/descrição/EAN e filtros por grupo, subgrupo, tipo e situação), `app/(app)/estoque/itens/novo/page.tsx` e `app/(app)/estoque/itens/[id]/page.tsx` (código só leitura; unidade de estoque desabilitada quando bloqueada, com a orientação de inativar e criar outro)
- [x] T051 [US1] Implementar inativar e reativar item em `src/application/inventory/set-item-active.ts` + ações, com teste de integração em `tests/integration/items/item-active.test.ts` (reativar com descrição duplicada ativa → `ITEM_DUPLICATE_DESCRIPTION`; item inativo some das listas de seleção)

**Checkpoint**: US1 funciona sozinha. Rodar os passos 5 a 8 e 11 do [quickstart](quickstart.md#roteiro-manual--15-min-mede-sc-001-e-sc-006).

---

## Phase 4: User Story 2 - Organizar itens por grupos e subgrupos (Priority: P1)

**Goal**: ver a árvore padrão, criar grupos e subgrupos, inativar o que for do restaurante e
sobrescrever "entra no CMV" no item.

**Independent Test**: criar o subgrupo "Cogumelos" em Hortifrúti, cadastrar item nele e sobrescrever
o "entra no CMV" do item, conferindo o histórico.

### Tests for User Story 2 ⚠️

- [x] T052 [P] [US2] Testes de `nextTwoDigitCode` em `src/domain/inventory/item-code.test.ts`: contador 14 → "14"; contador 100 → `GROUP_CODES_EXHAUSTED`
- [x] T053 [P] [US2] Testes de `effectiveInCogs(group, item)` em `src/domain/inventory/item.test.ts`: override `null` segue o grupo; `true`/`false` sobrescreve
- [x] T054 [P] [US2] Teste de integração em `tests/integration/groups/groups.test.ts`: `createSubgroup` em Hortifrúti recebe o próximo código livre; nome repetido entre ativos → `NAME_IN_USE`; inativar grupo `is_system` → `SYSTEM_RECORD`; inativar subgrupo com itens ativos → `SUBGROUP_HAS_ACTIVE_ITEMS`; renomear mantém o código; chef chamando `createSubgroup` → `FORBIDDEN`
- [x] T055 [P] [US2] Teste de integração em `tests/integration/groups/cogs-override.test.ts`: gerente marca item de "Higiene e limpeza" como "entra no CMV" → `effectiveInCogs = true` e auditoria com `[null, true]`; voltar para `null` volta a seguir o grupo; chef → `FORBIDDEN`

### Implementation for User Story 2

- [x] T056 [US2] Implementar `src/infra/db/repositories/group-repository.ts` (contadores com `for update`, árvore com contagem de itens ativos)
- [x] T057 [US2] Implementar casos de uso `src/application/inventory/list-group-tree.ts`, `create-group.ts`, `create-subgroup.ts`, `rename-group.ts`, `set-group-active.ts` e `set-item-cogs-override.ts`, e ações em `src/actions/groups.ts`
- [x] T058 [US2] Criar `app/(app)/estoque/grupos/page.tsx` (árvore com códigos, alimentar/químico, entra no CMV, ações só para gerente) e o controle de "entra no CMV" com "seguir o grupo" em `src/components/items/cogs-override.tsx`, usado na página do item
- [x] T059 [US2] Mostrar o histórico do registro: caso de uso `src/application/audit/get-audit-history.ts`, componente `src/components/audit/history-list.tsx` (quem, quando no fuso do restaurante, antes → depois) na aba "Histórico" do item e no detalhe de grupo; teste de integração em `tests/integration/audit/history.test.ts`

**Checkpoint**: US1 e US2 funcionam juntas e separadas.

---

## Phase 5: User Story 5 - Criar a conta do restaurante e montar a equipe (Priority: P1)

**Goal**: o gerente convida pessoas por e-mail com papéis, ajusta papéis e desativa membros, sem
nunca ficar sem gerente ativo.

**Independent Test**: convidar um chef, aceitar o convite em outra sessão, verificar as permissões;
criar dois restaurantes e confirmar o isolamento.

### Tests for User Story 5 ⚠️

- [x] T060 [P] [US5] Testes de `assertKeepsManager` em `src/domain/access/memberships.test.ts`: retirar `MANAGER` do único gerente ativo → `LAST_MANAGER`; desativar o único gerente → `LAST_MANAGER`; com dois gerentes, ok
- [x] T061 [P] [US5] Testes de convite em `src/domain/access/invitation.test.ts`: expira em 7 dias a partir do `Clock`; aceito após o prazo → `INVITATION_EXPIRED`; `roles` vazio → erro
- [x] T062 [P] [US5] Teste de integração em `tests/integration/access/invitations.test.ts`: `inviteMember` grava convite com hash do token e o mailer em memória recebe o link; convite pendente repetido → `INVITATION_PENDING`; e-mail de membro de outro restaurante → `EMAIL_BELONGS_TO_OTHER_RESTAURANT`; `acceptInvitation` cria usuário e membership com os papéis; token revogado → `INVITATION_INVALID`
- [x] T063 [P] [US5] Teste de integração em `tests/integration/access/members.test.ts`: `setMemberRoles` e `deactivateMember` respeitam `LAST_MANAGER`; membro desativado não consegue sessão válida (`withContext` → `UNAUTHENTICATED`); auditoria mantém o `user_id` dele
- [x] T064 [P] [US5] Teste E2E em `tests/e2e/invite-chef.spec.ts`: gerente convida chef, chef aceita em outro contexto do navegador, não vê o menu de grupos/locais com ações e consegue cadastrar item

### Implementation for User Story 5

- [x] T065 [P] [US5] Implementar `src/domain/access/memberships.ts` (`assertKeepsManager`) e `src/domain/access/invitation.ts` (prazo, estados `PENDING` → `ACCEPTED` | `REVOKED` | `EXPIRED`)
- [x] T066 [US5] Implementar `src/infra/db/repositories/membership-repository.ts` e `invitation-repository.ts` (token aleatório de 32 bytes, guarda só SHA-256)
- [x] T067 [US5] Implementar casos de uso `src/application/access/invite-member.ts`, `accept-invitation.ts`, `revoke-invitation.ts`, `set-member-roles.ts`, `set-member-active.ts` e ações em `src/actions/access.ts`
- [x] T068 [P] [US5] Criar o e-mail de convite em `src/infra/mailer/templates/invitation.ts` (texto pt-BR com nome do restaurante e link)
- [x] T069 [US5] Criar `app/(app)/equipe/page.tsx` (membros, papéis, convites pendentes, convidar, revogar, desativar) e `app/(auth)/convite/[token]/page.tsx` (definir nome e senha)

**Checkpoint**: todas as histórias P1 prontas. Passos 1, 4 e 13 do quickstart.

---

## Phase 6: User Story 3 - Cadastrar locais com nome real e rota de contagem (Priority: P2)

**Goal**: locais com tipo, responsável, faixa de temperatura e ordem de contagem; vínculo item-local
com local padrão e posição na folha.

**Independent Test**: cadastrar "Câmara de carnes" refrigerada 0 a 4 °C, vincular três itens nas
posições 3, 1 e 2 e ver a folha na ordem 1, 2, 3.

### Tests for User Story 3 ⚠️

- [x] T070 [P] [US3] Testes de `validateLocation` em `src/domain/inventory/location.test.ts`: `CHILLED`/`FROZEN` sem faixa → `TEMPERATURE_RANGE_REQUIRED`; mínima > máxima → `TEMPERATURE_RANGE_INVALID`; `DRY` sem faixa passa
- [x] T071 [P] [US3] Testes de `checkItemLocation` em `src/domain/inventory/location.test.ts`: `CHEMICAL` em `CHEMICALS`, `QUARANTINE`, `IN_TRANSIT` ok e em `DRY`/`CHILLED`/`FROZEN`/`STATION`/`BAR`/`NON_FOOD` → `LOCATION_INCOMPATIBLE`; `FOOD` e `OTHER_NON_FOOD` em `CHEMICALS` → `LOCATION_INCOMPATIBLE`, nos demais ok
- [x] T072 [P] [US3] Testes de `orderCountSheet` em `src/domain/inventory/location.test.ts`: posições 3, 1, 2 → 1, 2, 3; locais ordenados por `countOrder` e, no empate, por nome
- [x] T073 [P] [US3] Teste de integração em `tests/integration/locations/locations.test.ts`: check constraint recusa refrigerado sem faixa direto no SQL; quarentena não inativa (`SYSTEM_RECORD`); nome repetido entre ativos → `NAME_IN_USE`; inativar local com vínculo → `LOCATION_IN_USE`; responsável que não é membro → `RESPONSIBLE_NOT_MEMBER`; `applySuggestedLocations` cria os modelos escolhidos
- [x] T074 [P] [US3] Teste de integração em `tests/integration/locations/item-locations.test.ts`: detergente na câmara → `LOCATION_INCOMPATIBLE`; dois padrões → `MULTIPLE_DEFAULTS` (e o índice único parcial também barra no SQL); `getCountSheet` devolve itens ativos na ordem de `sheet_position`; chef chamando `setItemLocations` → `FORBIDDEN`

### Implementation for User Story 3

- [x] T075 [P] [US3] Implementar `src/domain/inventory/location.ts` (`LocationKind` com os 9 tipos, `validateLocation`, `checkItemLocation`, `orderCountSheet`)
- [x] T076 [US3] Implementar `src/infra/db/repositories/location-repository.ts` e `item-location-repository.ts` (substitui o conjunto de vínculos do item na mesma transação)
- [x] T077 [US3] Implementar casos de uso `src/application/inventory/create-location.ts`, `update-location.ts`, `set-location-active.ts`, `apply-suggested-locations.ts`, `list-locations.ts`, `get-count-sheet.ts`, `set-item-locations.ts` e ações em `src/actions/locations.ts`
- [x] T078 [US3] Criar `app/(app)/estoque/locais/page.tsx` (lista na ordem de contagem, formulário com faixa de temperatura que aparece e fica obrigatória para refrigerado/congelado, oferta dos locais sugeridos no primeiro acesso) e `app/(app)/estoque/locais/[id]/folha/page.tsx` (itens na ordem da folha, pronta para imprimir)
- [x] T079 [US3] Criar `src/components/items/item-locations.tsx` (vincular locais, marcar padrão, definir posição) na página do item, e acrescentar o filtro por local na lista de itens em `app/(app)/estoque/itens/page.tsx`

**Checkpoint**: passos 2, 3, 9 e 10 do quickstart.

---

## Phase 7: User Story 4 - Dados de conservação, sanitários e fiscais do item (Priority: P3)

**Goal**: completar o item com os campos opcionais de FR-025; custos e curva ABC só leitura.

**Independent Test**: editar um item de carne com peso variável, conservação ≤ 4 °C, recebimento 4 a
7 °C, validade após aberto de 3 dias; num queijo, alérgeno "leite".

### Tests for User Story 4 ⚠️

- [x] T080 [P] [US4] Testes da lista de alérgenos em `src/domain/inventory/allergens.test.ts`: exatamente os 18 códigos da RDC 26/2015 (R13), cada um com rótulo pt-BR; valor fora da lista → `INVALID_ALLERGEN`
- [x] T081 [P] [US4] Testes dos campos opcionais em `src/domain/inventory/item.test.ts`: "`correction_factor` numeric(8,4) ≥ 1, padrão 1" (0,9 → `INVALID_CORRECTION_FACTOR`); "`yield_factor` > 0 e ≤ 1" (0,90 ok; 0 e 1,1 → `INVALID_YIELD_FACTOR`); `receiving_temp_min_c ≤ max_c`; dias de validade e alerta ≥ 0; EAN com 8, 12, 13 ou 14 dígitos e dígito verificador válido, senão `INVALID_EAN`; `noGtin = true` exige EANs vazios; NCM com 8 dígitos (`INVALID_NCM`), CEST com 7, origem 0–8
- [x] T082 [P] [US4] Teste de integração em `tests/integration/items/item-optional-fields.test.ts`: salvar e reler todos os campos de FR-025 sem perda de precisão (ex.: `correction_factor` 1,2500; peso drenado 1,7000); tentar enviar `averageCost`, `lastCost` ou `abcClass` → rejeitado pelo schema

### Implementation for User Story 4

- [x] T083 [P] [US4] Implementar `src/domain/inventory/allergens.ts` (enum + rótulos) e `src/domain/inventory/ean.ts` (dígito verificador GTIN)
- [x] T084 [US4] Estender `validateItem` em `src/domain/inventory/item.ts`, o repositório e os schemas Zod de `src/actions/items.ts` com os campos opcionais de FR-025
- [x] T085 [US4] Acrescentar ao `src/components/items/item-form.tsx` os blocos "Conservação e validade" (temperaturas, validades, lote, alerta, peso variável, FC, rendimento), "Alérgenos" (seleção múltipla da lista fechada), "Fiscal" (EAN/SEM GTIN, NCM, CEST, origem, grupo tributário, categoria financeira) e "Contagem" (inventariável, frequência), e o bloco "Custos" só leitura (custo médio, último custo, data, curva ABC, vazios com "calculado pelas movimentações")

**Checkpoint**: todas as histórias prontas e independentes.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T086 [P] Teste de desempenho em `tests/integration/items/list-performance.test.ts`: com 2.000 itens, `listItems` com busca por trecho responde em ≤ 1 s (SC-005); criar índices `pg_trgm` em `description_normalized` e índice em `code` se faltar
- [x] T087 [P] Teste de propriedade da RLS em `tests/integration/rls.test.ts`: falhar se surgir tabela com `restaurant_id` sem política ativa
- [x] T088 [P] Atualizar [`docs/sistema/estoque/04-plano-de-testes.md`](../../docs/sistema/estoque/04-plano-de-testes.md#001--cadastros-base) com os testes acrescentados (permissões, convite, auditoria, concorrência) e conferir se `docs/produto/estoque/` precisa de ajuste pelas decisões da spec (código imutável ao mudar de subgrupo; item e local só inativam)
- [x] T089 [P] Escrever `README.md` (seção "Rodar localmente" apontando para o [quickstart](quickstart.md)) e `CONTRIBUTING.md` curto (TDD, Conventional Commits, branch `NNN-nome`)
- [x] T090 Revisão de acessibilidade e textos: todos os formulários com rótulos, mensagens de erro em pt-BR, números com vírgula decimal (FR-032)
- [x] T091 Rodar o [quickstart](quickstart.md) completo, medir SC-001 (≤ 2 min por item) e SC-006 (≤ 15 min no primeiro acesso) e registrar o resultado na descrição do PR
- [x] T092 Conferir a lista de alérgenos com o texto vigente da Anvisa antes do merge (R13)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia** todas as histórias.
- **Histórias (Phases 3–7)**: dependem só da fundação. Podem andar em paralelo ou em sequência na
  ordem US1 → US2 → US5 → US3 → US4.
- **Polish (Phase 8)**: depois das histórias desejadas.

### User Story Dependencies

- **US1 (P1)**: só a fundação (árvore padrão é criada no cadastro do restaurante, T030).
- **US2 (P1)**: só a fundação. T058 coloca o controle de CMV na página do item; se US1 não estiver
  pronta, o controle é testado só pelo caso de uso (T055).
- **US5 (P1)**: só a fundação (cadastro de restaurante já existe em T030). O E2E T064 usa a tela de
  item de US1.
- **US3 (P2)**: só a fundação; T079 se integra à página do item de US1.
- **US4 (P3)**: depende de US1 (estende o formulário e a validação do item).

### Within Each User Story

- Testes escritos e **falhando** antes da implementação.
- Domínio → repositório → caso de uso → ação → tela.
- Commit a cada ciclo verde.

### Parallel Opportunities

- Setup: T002–T008 em paralelo após T001.
- Fundação: testes T009–T013 e T015–T016 em paralelo; implementações de domínio T017–T021 em
  paralelo; T031 e T032 em paralelo com T028–T030.
- Depois da fundação, US1, US2, US5 e US3 podem ser feitas por pessoas diferentes.

---

## Parallel Example: User Story 1

```bash
# Testes de US1 juntos (todos devem falhar):
Task: "T033 Testes de formatItemCode em src/domain/inventory/item-code.test.ts"
Task: "T034 Testes de normalizeDescription em src/domain/inventory/description.test.ts"
Task: "T037 Teste de integração de criação de item em tests/integration/items/create-item.test.ts"
Task: "T040 Teste de isolamento em tests/integration/items/tenant-isolation.test.ts"

# Domínio de US1 junto:
Task: "T043 Implementar src/domain/inventory/item-code.ts"
Task: "T044 Implementar src/domain/inventory/description.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T070–T072 Testes de location.ts em src/domain/inventory/location.test.ts"
Task: "T073 Teste de integração em tests/integration/locations/locations.test.ts"
Task: "T074 Teste de integração em tests/integration/locations/item-locations.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) e Phase 2 (Fundação), que já trazem criar conta e entrar.
2. Phase 3 (US1).
3. **Parar e validar**: passos 5 a 8 do quickstart; demonstrar o cadastro de item.

### Incremental Delivery

1. Setup + Fundação → criar conta e entrar.
2. + US1 → cadastro de item (MVP).
3. + US2 → grupos próprios e CMV por item.
4. + US5 → equipe com papéis. Aqui o sistema já pode ser usado por um restaurante real.
5. + US3 → locais e folha de contagem.
6. + US4 → dados sanitários e fiscais.

Sugestão de PRs: um por fase (Setup, Fundação, cada história, Polish), todos na branch
`001-cadastros-base` ou em sub-branches dela.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Nunca usar `.skip`/`.only` nem apagar teste para passar a CI.
- Toda tarefa que muda regra ou arquitetura atualiza `docs/` no mesmo PR (princípio VI).
- Total: 92 tarefas (Setup 8 · Fundação 24 · US1 19 · US2 8 · US5 10 · US3 10 · US4 6 · Polish 7).

## Notas do implement

- **T032**: não há `decimal-input.tsx` separado. Os campos numéricos usam `Input` com
  `inputMode="decimal"` e a conversão com vírgula acontece no servidor (`parseBrDecimal` em
  `item-input.ts` e `location-input.ts`), que é onde a regra precisa valer.
- **T048 / R14**: formulários nativos com `useActionState`; `react-hook-form` não foi usado.
- **T066**: os repositórios de membros e convites ficaram juntos em
  `src/infra/db/repositories/access-repositories.ts`.
- **T068**: o texto do convite está em `src/application/access/invitation-email.ts` (texto puro, sem
  dependência de infraestrutura). Para os testes ponta a ponta existe `MAILER=file`
  (`src/infra/mailer/file.ts`).
- **T090 (01/11/2026)**: verificação automática com axe (WCAG 2.1 A e AA) em 11 telas, agora no teste
  `tests/e2e/accessibility.spec.ts`. Corrigido: links dentro de frases só se distinguiam pela cor;
  página 404 em inglês; histórico mostrava nomes internos dos campos; formulários apagavam o que a
  pessoa digitou quando o servidor recusava (reset automático do React 19, agora `useFormAction`).
- **T091 (01/11/2026)**: os 13 passos do roteiro rodaram no navegador por script (o passo 4 é o
  teste `invite-chef.spec.ts`); todos passam. Os tempos SC-001 e SC-006 com uma pessoa real ainda
  precisam ser medidos no primeiro uso com o restaurante.
- **T092 (01/11/2026)**: lista conferida com o Anexo III da RDC 727/2022 (ver research R13).
