# Instruções para agentes

- Leia `.specify/memory/constitution.md` antes de qualquer mudança. TDD é inegociável: teste
  primeiro, depois código.
- Regras de negócio: `docs/produto/`. Arquitetura e convenções: `docs/sistema/`.
- Toda feature segue o fluxo Spec Kit (`specs/NNN-nome/`).
- Documentação e textos de interface em português do Brasil; código em inglês conforme
  `docs/sistema/glossario.md`.
- Dinheiro e quantidade sempre em decimal exato; nunca `number` de ponto flutuante.
- Movimentações de estoque são só inserção; correção por estorno.
- Mudou regra ou arquitetura? Atualize `docs/` no mesmo PR.
- Antes de abrir ou atualizar um PR, leia `docs/sistema/06-ci-cd.md`: PRs pequenos (feature
  grande vira vários PRs), checagens locais antes de enviar e o que fazer com CI vermelho.
