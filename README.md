# Sistema Restaurante

ERP para restaurantes, entregue como SaaS. O primeiro módulo é o de **Estoque**.

## Stack

Next.js · React · TypeScript · PostgreSQL · Vercel · Tailwind CSS · shadcn/ui — com
**Desenvolvimento Guiado por Testes (TDD)** obrigatório.

## Como o projeto está organizado

| Pasta                                                     | Conteúdo                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| [`docs/produto/`](docs/produto/estoque/00-visao-geral.md) | Como o sistema funciona para o usuário (regras de negócio)        |
| [`docs/sistema/`](docs/sistema/00-arquitetura.md)         | Como o código funciona (arquitetura, TDD, modelo de dados)        |
| [`.specify/`](.specify/memory/constitution.md)            | Spec Kit: constituição do projeto, templates e scripts            |
| `specs/`                                                  | Uma pasta por feature (spec → plan → tasks), criada pelo Spec Kit |

Índice completo da documentação: [`docs/README.md`](docs/README.md).

## Fluxo de trabalho (Spec Kit)

1. `speckit specify <descrição da feature>` → cria `specs/NNN-nome/spec.md`
2. `speckit clarify` (opcional) → resolve dúvidas da spec
3. `speckit plan <stack e restrições>` → plano técnico, modelo de dados, contratos
4. `speckit tasks` → tarefas ordenadas, testes antes do código
5. `speckit implement` → implementa seguindo TDD

A ordem das features do módulo de estoque está no
[roadmap](docs/produto/estoque/00-visao-geral.md#roadmap).

## Rodar localmente

Precisa de Node 22 ou mais novo, pnpm 10 e Docker (para o PostgreSQL).

```bash
pnpm install
cp .env.example .env.local   # ajuste segredos se quiser
pnpm db:up && pnpm db:migrate && pnpm db:dev-login
pnpm dev                     # http://localhost:3000 → "Criar conta"
```

Os scripts de banco leem o `.env.local`. Em desenvolvimento os e-mails (convite, recuperação de
senha) aparecem no terminal do `pnpm dev`.

### No Windows (Prompt de Comando)

Instale as ferramentas uma vez e depois **feche e abra o Prompt de novo**:

```bat
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
```

Abra o Docker Desktop e espere aparecer "Engine running" (na primeira vez ele pode pedir para
reiniciar o computador ou instalar o WSL). Depois, num Prompt novo:

```bat
npm install -g pnpm@10
git clone https://github.com/AdemirSchramm1/Sistema_Restaurante.git
cd Sistema_Restaurante
pnpm install
copy .env.example .env.local
pnpm db:up
pnpm db:migrate
pnpm db:dev-login
pnpm dev
```

Testes: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:e2e`.
O passo a passo completo, com o roteiro manual, está no
[quickstart da feature 001](specs/001-cadastros-base/quickstart.md). Regras para contribuir:
[CONTRIBUTING.md](CONTRIBUTING.md).

O cardápio (feature 013) tem mais três: `pnpm test:menu` (100% de cobertura do código do
cardápio), `pnpm test:mutation` (teste de mutação do domínio do cardápio) e `pnpm test:screens`
(cardápio em 9 tamanhos de tela, claro e escuro, Chromium e WebKit; precisa de Docker e de
`pnpm build`). Ver [testes de tela](docs/sistema/05-testes-de-tela.md).

### Fotos do cardápio no deploy

Em desenvolvimento as fotos ficam na pasta `.menu-photos` (`MENU_PHOTOS=file`). Na Vercel:

1. No projeto da Vercel, em **Storage**, crie uma loja **Blob** e ligue ao projeto (a Vercel cria
   `BLOB_READ_WRITE_TOKEN` sozinha).
2. Em **Environment Variables**, defina `MENU_PHOTOS=vercel-blob`.
3. Faça o deploy de novo. Ver [ADR 0006](docs/sistema/adr/0006-fotos-do-cardapio.md).
