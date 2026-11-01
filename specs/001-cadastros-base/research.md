# Research: Cadastros base do estoque (feature 001)

**Data**: 2026-10-31 · **Spec**: [spec.md](spec.md) · **Plano**: [plan.md](plan.md)

Esta é a primeira feature do projeto, então ela fecha as decisões que
[`docs/sistema/00-arquitetura.md`](../../docs/sistema/00-arquitetura.md#decisões-em-aberto) deixou
para "o `speckit plan` da feature 001". Cada decisão de arquitetura vira um ADR curto em
`docs/sistema/adr/`.

## R1. ORM e migrações

- **Decision**: Drizzle ORM + drizzle-kit (migrações SQL versionadas no repositório).
- **Rationale**: o schema fica em TypeScript, mas as migrações geradas são SQL legível, o que
  importa aqui porque a feature depende de recursos do PostgreSQL que o ORM não modela bem
  (políticas RLS, índice único parcial, check constraints, trigger de bloqueio da unidade). Drizzle
  aceita SQL escrito à mão na mesma pasta de migrações sem atrito. Tem suporte direto a `numeric`
  como `string`, o que evita conversão acidental para `number` (princípio IV). Sem engine binária,
  bom para funções serverless na Vercel.
- **Alternatives considered**: Prisma (bom DX, mas `Decimal` próprio, engine maior, e RLS por
  transação exige extensões de cliente; SQL manual nas migrações é mais trabalhoso); Kysely puro
  (ótimo controle, mas sem gerador de migração).

## R2. Provedor PostgreSQL

- **Decision**: Neon (PostgreSQL 17 gerenciado, integração nativa com a Vercel, branch de banco por
  preview de PR). Testes usam `postgres:17` em container (Testcontainers), sem nada específico do
  Neon.
- **Rationale**: é o Postgres que a Vercel oferece pelo marketplace; branch por PR combina com o
  preview da Vercel; o código não depende de nenhuma API do provedor, então trocar depois é só
  mudar a string de conexão.
- **Alternatives considered**: Supabase (bom, mas empurra para Supabase Auth e para o schema
  `auth`, que não existe no Postgres do container de teste); RDS/Cloud SQL (mais operação para um
  time pequeno).

## R3. Autenticação, convites e recuperação de senha

- **Decision**: Better Auth com e-mail e senha, sessão em cookie e tabelas próprias no nosso
  PostgreSQL (adaptador Drizzle). Restaurante, vínculo do usuário e papéis ficam em **tabelas do
  domínio**, não em plugin de terceiros. E-mails (convite, recuperação) saem por uma porta
  `Mailer`; em produção, Resend; nos testes, um mailer em memória.
- **Rationale**: a spec pede e-mail e senha, recuperação de senha, convite e desativação (FR-002).
  Better Auth cobre isso pronto e guarda os usuários no mesmo banco, então o teste de integração
  com Postgres real exercita login e tenant juntos, sem serviço externo. Manter papéis no domínio
  deixa a regra de permissões (FR-003) e "sempre um gerente ativo" testáveis como funções puras.
- **Alternatives considered**: Auth.js (o provedor de credenciais é desencorajado pela própria
  documentação, sem fluxo de recuperação de senha); Clerk (completo, inclusive organizações e
  convites, mas dados de usuário fora do nosso banco, custo por usuário ativo e testes de
  integração dependentes de serviço externo); Supabase Auth (ver R2).

## R4. Isolamento entre restaurantes (RLS)

- **Decision**: duas barreiras.
  1. **Aplicação**: todo repositório recebe `restaurantId` do contexto da sessão (nunca do cliente)
     e filtra por ele.
  2. **Banco**: Row Level Security em todas as tabelas com `restaurant_id`. A aplicação conecta com
     um papel sem `BYPASSRLS` e, em cada transação, executa
     `select set_config('app.restaurant_id', $1, true)`. A política é
     `restaurant_id = current_setting('app.restaurant_id')::uuid`. Migrações rodam com outro papel
     (dono das tabelas).
- **Rationale**: a constituição (princípio V) proíbe consultas cruzando tenants; um `where`
  esquecido vira vazamento entre clientes. O `set_config(..., true)` vale só para a transação, o que
  funciona com pool de conexões em modo transação (Neon/PgBouncer). O teste de isolamento (SC-003)
  roda contra as duas barreiras: uma vez pelo caso de uso e outra direto no SQL, sem o filtro.
- **Alternatives considered**: só filtro na aplicação (mais simples, mas uma barreira só); schema
  por restaurante (migrações N vezes, não escala bem em SaaS).

## R5. Decimal exato

- **Decision**: `decimal.js` no TypeScript, envolvido em `src/domain/shared/decimal.ts` (`d("1.5")`).
  No banco, `numeric(14,4)` para quantidades e fatores, conforme
  [convenções](../../docs/sistema/02-convencoes.md#números). Drizzle lê `numeric` como `string` e o
  repositório converte para `Decimal` na fronteira. Na tela, entrada e exibição com vírgula decimal
  (FR-032), convertidas por um único par de funções `parseBrDecimal` / `formatBrDecimal`.
- **Rationale**: princípio IV; regra de lint (`no-restricted-syntax`) proíbe `parseFloat` e
  `Number(` em `src/domain` e `src/application`.
- **Alternatives considered**: `big.js` (menor, mas sem algumas operações úteis para frações);
  inteiros em milésimos (quebra com fatores de conversão arbitrários).

## R6. Geração do código do item `GG.SS.NNNN` sem colisão

- **Decision**: cada subgrupo guarda `next_item_seq`. O caso de uso "criar item" faz
  `select ... for update` na linha do subgrupo, usa o número, incrementa e insere o item na mesma
  transação. O código é montado por função pura `formatItemCode(groupCode, subgroupCode, seq)`;
  seq > 9999 devolve `SUBGROUP_SEQUENCE_EXHAUSTED`. Índice único `(restaurant_id, code)` como rede
  de segurança. Mesma técnica para o código de 2 dígitos de grupos (contador no restaurante) e de
  subgrupos (contador no grupo).
- **Rationale**: sequência do PostgreSQL não serve, porque a numeração é por subgrupo e por
  restaurante; o lock de linha serializa só cadastros no mesmo subgrupo.
- **Alternatives considered**: `max(seq) + 1` com retry em violação de unicidade (funciona, mas gera
  erros sob concorrência); sequência por subgrupo criada dinamicamente (DDL em tempo de execução).

## R7. Duplicidade por descrição normalizada

- **Decision**: função pura `normalizeDescription` (minúsculas, remove acentos via NFD, junta espaços,
  `trim`). O valor é guardado em `items.description_normalized` e protegido por índice único parcial
  `(restaurant_id, subgroup_id, description_normalized) where active`. A violação vira
  `ITEM_DUPLICATE_DESCRIPTION`, com o código do item existente (cenário 1.4).
- **Rationale**: a regra vive no domínio (testável) e o banco garante sob concorrência. Normalizar no
  TypeScript, e não com a extensão `unaccent`, evita diferença entre o que o domínio e o banco
  consideram igual.

## R8. Bloqueio da unidade de estoque (FR-023) antes de existir movimentação

- **Decision**: coluna `items.stock_unit_locked_at timestamptz null`. A feature 003 preenche na
  primeira movimentação. Nesta feature: (a) o caso de uso recusa a troca com `ITEM_UNIT_LOCKED` se a
  coluna estiver preenchida; (b) um trigger `before update` no banco recusa a mudança de
  `stock_unit_id` quando `stock_unit_locked_at is not null` (segunda barreira). O teste de
  integração preenche a coluna diretamente para simular a movimentação.
- **Rationale**: a regra fica especificada e testada agora, sem antecipar a tabela de movimentações.

## R9. Edição concorrente (FR-031)

- **Decision**: trava otimista. Tabelas editáveis têm `version integer`. O formulário envia a versão
  que carregou; o `update ... where id = $1 and version = $2` que afeta zero linhas devolve
  `STALE_RECORD`, e a tela mostra o aviso e os valores atuais.

## R10. Auditoria (FR-004)

- **Decision**: tabela `audit_log` só de inserção (mesmas proteções do livro: sem `UPDATE`/`DELETE`
  para o papel da aplicação). Cada caso de uso grava, **na mesma transação** da escrita: entidade,
  id, ação (`CREATE`, `UPDATE`, `DEACTIVATE`, `REACTIVATE`, `DENIED`), usuário, data/hora, origem
  (`web`, IP e user agent), e `changes` em JSON com `{campo: [antes, depois]}` só dos campos
  alterados. O diff é calculado por função pura `diffFields`. Retenção: indefinida nesta feature.
- **Alternatives considered**: trigger genérico de auditoria no banco (não sabe o usuário sem
  `set_config` extra e não registra tentativas negadas).

## R11. Permissões (FR-003)

- **Decision**: matriz de permissões como dado puro em `src/domain/access/permissions.ts`
  (`can(roles, action)`), com ações como `item.create`, `location.update`, `item.cogs_override`,
  `user.invite`. Todo caso de uso chama `assertCan` antes de qualquer leitura de escrita; Server
  Actions não decidem permissão. Tentativa negada gera `FORBIDDEN` e registro `DENIED` na auditoria.
  A interface esconde botões sem permissão, mas isso é só conforto.
- **Rationale**: cumpre "as permissões valem também para acesso direto (sem passar pela tela)".

## R12. Regra de compatibilidade item × local (FR-029)

- **Decision**: grupos ganham `storage_class` com três valores: `FOOD`, `CHEMICAL`, `OTHER_NON_FOOD`
  (a árvore padrão marca "Higiene e limpeza" como `CHEMICAL`, os alimentares como `FOOD`, os demais
  como `OTHER_NON_FOOD`). Função pura `checkItemLocation(storageClass, locationKind)`:
  `CHEMICAL` só em `CHEMICALS`, `QUARANTINE`, `IN_TRANSIT`; `FOOD` em qualquer tipo menos
  `CHEMICALS`; `OTHER_NON_FOOD` em qualquer tipo menos `CHEMICALS`. Isso substitui o booleano
  `is_food` do modelo inicial (ele passa a ser derivado: `storage_class = FOOD`).

## R13. Alérgenos (lista fechada da Anvisa)

- **Decision**: enum de 18 valores do Anexo III da RDC 727/2022, que consolidou a RDC 26/2015:
  trigo/centeio/cevada/aveia e híbridos, crustáceos, ovos, peixes, amendoim, soja, leites de todas as
  espécies de animais mamíferos, amêndoa, avelã, castanha-de-caju, castanha-do-brasil, macadâmia,
  nozes, pecã, pistache, pinoli, castanhas, látex natural. Guardado como `text[]` com check contra a
  lista. Rótulos em português na interface (texto do anexo); códigos em inglês no código
  (`WHEAT_GLUTEN_CEREALS`, `CRUSTACEANS`, …), definidos em `src/domain/inventory/allergens.ts`.
- **Conferência (T092, 01/11/2026)**: a lista bate com o Anexo III da RDC 727/2022; só o rótulo
  do leite foi ajustado ao texto oficial. A Consulta Pública 1.357/2025 (contribuições até
  09/03/2026) revisa a rotulagem geral e muda o formato do aviso ("Contém …"), sem incluir item na
  lista até onde foi possível verificar. Se uma norma nova acrescentar alérgeno (por exemplo,
  gergelim), a mudança é só no enum, no check do banco e no teste.

## R14. Interface e lista de itens

- **Decision**: páginas do App Router com Server Components para listas e Server Actions para
  escrita; formulários HTML nativos com `useActionState` e Zod no servidor (o schema estrito recusa
  campos desconhecidos, como custos). **Revisado no implement**: `react-hook-form` saiu, porque o
  formulário nativo já dá a validação do servidor e funciona sem JavaScript. Lista de
  itens com busca e filtros por parâmetros de URL, paginada no servidor (50 por página), índice
  `pg_trgm` em descrição para a busca por trecho. Meta SC-005 (2.000 itens, resposta ≤ 1 s) medida
  por um teste de integração com 2.000 itens.

## R15. Primeira feature = criar o projeto

- **Decision**: a 001 também cria o esqueleto do repositório: Next.js com TypeScript `strict`,
  Tailwind + shadcn/ui (componentes copiados à mão em `src/components/ui`, no estilo shadcn, porque o
  registro do shadcn não estava acessível no ambiente de desenvolvimento), Vitest, Testcontainers, Playwright, ESLint com regra de fronteiras
  (`eslint-plugin-boundaries`) e GitHub Actions (lint → typecheck → unit → integration → e2e).
  Isso aparece em `tasks.md` como fase "Setup".
