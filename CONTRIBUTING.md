# Como contribuir

1. **Leia a [constituição](.specify/memory/constitution.md).** TDD é inegociável: o teste vem
   primeiro, falha, e só então o código. Nunca pule, marque `.only` ou apague um teste para passar.
2. **Toda feature segue o Spec Kit** em `specs/NNN-nome/` (spec → plan → tasks → implement). A
   branch tem o mesmo nome da pasta, por exemplo `001-cadastros-base`.
3. **Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/)**, com o
   número da feature no escopo: `feat(001): …`, `fix(001): …`, `docs(001): …`.
4. **Camadas** (`domain` → `application` → `infra`/`actions` → `components`) são checadas pelo ESLint.
   O domínio é puro: sem banco, sem `Date.now()`, sem `number` para dinheiro ou quantidade.
5. **Mudou regra ou arquitetura?** Atualize `docs/` no mesmo PR.
6. Antes do PR: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`. A
   cobertura de `src/domain` precisa ficar em 90% ou mais.

Textos de interface e documentação em português do Brasil; nomes no código em inglês, conforme o
[glossário](docs/sistema/glossario.md).
