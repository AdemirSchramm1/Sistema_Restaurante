# Documentação — Sistema Restaurante

A documentação tem duas partes:

| Parte | Pergunta que responde | Quem lê |
|---|---|---|
| [`produto/`](produto/) | **O que** o sistema faz e **por quê**: regras de negócio, fluxos, critérios de aceite | Dono do produto, quem escreve specs, quem testa |
| [`sistema/`](sistema/) | **Como** o código funciona: arquitetura, modelo de dados, TDD, convenções | Quem desenvolve |

E se liga ao fluxo **Spec Kit**:

- `.specify/memory/constitution.md` — princípios inegociáveis do projeto (TDD, livro imutável…).
- `specs/NNN-nome/` — uma pasta por feature (spec → plan → tasks), criada com `speckit specify`.
  Cada spec **referencia** os documentos de `produto/` em vez de copiá-los.

## Índice

### Produto

- Módulo de Estoque
  - [00 — Visão geral e roadmap](produto/estoque/00-visao-geral.md)
  - [01 — Grupos de itens](produto/estoque/01-grupos-de-itens.md)
  - [02 — Cadastro de itens](produto/estoque/02-cadastro-de-itens.md)
  - [03 — Fornecedores](produto/estoque/03-fornecedores.md)
  - [04 — Produtos (fichas técnicas)](produto/estoque/04-fichas-tecnicas.md)
  - [06 — Movimentações](produto/estoque/06-movimentacoes.md)
  - [08 — Ciclo operacional](produto/estoque/08-ciclo-operacional.md)
  - [09 — Controles e permissões](produto/estoque/09-controles-e-permissoes.md)
  - [10 — Indicadores](produto/estoque/10-indicadores.md)
  - [13 — Decisões adotadas](produto/estoque/13-decisoes-adotadas.md)
- Módulo de Pedidos
  - [00 — Visão geral](produto/pedidos/00-visao-geral.md)
  - [01 — Mesas e QR codes](produto/pedidos/01-mesas-e-qr-code.md)
  - [02 — Cardápio do cliente](produto/pedidos/02-cardapio-do-cliente.md)
  - [03 — Cozinha e garçom](produto/pedidos/03-cozinha-e-garcom.md)
  - [04 — Adicionar e tirar](produto/pedidos/04-adicionar-e-tirar.md)
  - [05 — Conta da mesa e caixa](produto/pedidos/05-conta-da-mesa.md)

### Sistema

- [00 — Visão geral da arquitetura](sistema/00-arquitetura.md)
- [01 — Desenvolvimento guiado por testes (TDD)](sistema/01-tdd.md)
- [02 — Convenções de código](sistema/02-convencoes.md)
- [03 — Padrões do front (cores, fontes, componentes)](sistema/03-padroes-do-front.md)
- [04 — Desempenho (regras e como medir)](sistema/04-desempenho.md)
- [06 — CI/CD e pull requests (PRs pequenos, checagens antes de enviar)](sistema/06-ci-cd.md)
- [Glossário PT → código](sistema/glossario.md)
- [ADRs (decisões de arquitetura)](sistema/adr/)
- Módulo de Estoque
  - [01 — Modelo de dados](sistema/estoque/01-modelo-de-dados.md)
  - [02 — Regras de cálculo (domínio)](sistema/estoque/02-regras-de-calculo.md)
  - [03 — Movimentações e saldo](sistema/estoque/03-movimentacoes-e-saldo.md)
  - [04 — Plano de testes](sistema/estoque/04-plano-de-testes.md)
- Módulo de Pedidos
  - [01 — Modelo de dados](sistema/pedidos/01-modelo-de-dados.md)
  - [02 — Regras (domínio)](sistema/pedidos/02-regras.md)
  - [03 — Rota pública e acesso ao cardápio](sistema/pedidos/03-rota-publica.md)
  - [04 — Plano de testes](sistema/pedidos/04-plano-de-testes.md)

## Como manter

- Mudou uma regra de negócio? Atualize `produto/` **no mesmo PR**.
- Mudou arquitetura, tabela ou convenção? Atualize `sistema/` **no mesmo PR**.
- Itens marcados *(decisão a confirmar na spec)* ainda não foram decididos; resolva no
  `speckit clarify` da feature e atualize o documento.
