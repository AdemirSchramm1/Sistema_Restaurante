# Módulo de Estoque — Visão geral

> Fonte principal: Manual de Referência "Estoque de Restaurante — O que armazenar, como cadastrar
> e como fazer funcionar" (outubro de 2026). O manual consolida material acadêmico (UFPR, UFPB,
> UFMS, Demetra/UERJ), Sebrae, normas sanitárias (Anvisa, CVS/SP), fontes contábeis e fiscais e
> documentação de sistemas de gestão. **As estruturas propostas são sínteses das fontes, não
> padrões oficiais.** Conteúdo de fornecedores de software serve como retrato da prática, não norma.

## Para que serve

O estoque responde a uma pergunta gerencial: **por que o CMV real ficou diferente do CMV
teórico?** Os melhores operadores mantêm essa diferença em ~1 p.p.; 3 p.p. já pede investigação.
A faixa de CMV mais citada no Brasil vai de 25% a 35% do faturamento (até 40% à la carte). Em 2026,
23% dos bares e restaurantes operavam no prejuízo (Abrasel) — controle de custo é urgente.

## Os cinco dados mestres

| Dado mestre | Documento |
|---|---|
| Itens (unidades, conversões, custos, validades, fiscal) | [01-grupos-de-itens](01-grupos-de-itens.md), [02-cadastro-de-itens](02-cadastro-de-itens.md) |
| Fornecedores | [03-fornecedores](03-fornecedores.md) |
| Fichas técnicas | [04-fichas-tecnicas](04-fichas-tecnicas.md) |
| Locais | [05-locais](05-locais.md) |
| Movimentações | [06-movimentacoes](06-movimentacoes.md) |

## O ciclo fechado

Ficha técnica → planejamento → compra → recebimento → armazenagem → requisição → produção →
baixa por venda → registro de perdas → contagem → ajuste. Detalhes em
[08-ciclo-operacional](08-ciclo-operacional.md).

## Demais documentos

- [07-regras-sanitarias](07-regras-sanitarias.md) — temperaturas, validades, etiquetas, registros.
- [09-controles-e-permissoes](09-controles-e-permissoes.md) — papéis e segregação de funções.
- [10-indicadores](10-indicadores.md) — CMV, variância, giro, acurácia e outros.
- [11-fiscal](11-fiscal.md) — avaliação, inventário anual, perdas, NF-e.
- [12-rotinas](12-rotinas.md) — checklists diário a anual.
- [13-decisoes-adotadas](13-decisoes-adotadas.md) — onde as fontes divergem e o que adotamos.

## Contexto regulatório

Restaurante em **Santa Catarina**: a norma obrigatória é a **RDC Anvisa 216/2004**, com a lista de
verificação estadual e exigências municipais. As portarias paulistas CVS 5/2013 e CVS 3/2026 entram
como referência técnica porque trazem os números que a norma federal não fixa.

## Roadmap

Ordem sugerida, seguindo a prioridade de implantação do manual. Cada linha vira uma feature no
Spec Kit (`specs/NNN-nome/`).

| # | Feature | Depende de | Entrega |
|---|---|---|---|
| 001 | Cadastros base: grupos, unidades, locais, itens | – | Itens com três unidades e conversão |
| 002 | Fornecedores e vínculo item-fornecedor | 001 | De-para e fator de compra |
| 003 | Movimentações e saldo (livro imutável) + custo médio | 001 | Entradas, saídas com motivo, saldo por local |
| 004 | Fichas técnicas e sub-receitas | 001, 003 | Custo por porção, alérgenos, ordem de produção |
| 005 | Recebimento com conferência cega | 002, 003 | Pedido × NF × físico, quarentena |
| 006 | Contagem (inventário) às cegas e ajuste aprovado | 003 | Folhas por local, acurácia |
| 007 | Planejamento: PP, par, pedido sugerido | 003, 002 | Alertas de reposição |
| 008 | Baixa por venda (importação/manual; PDV depois) | 004 | CMV teórico |
| 009 | Painel de indicadores e variância | 006, 008 | CMV real × teórico |
| 010 | Registros sanitários (temperatura, etiquetas) | 001 | Leituras 2×/dia, etiquetas |
| 011 | Requisição, cotação e pedido com alçadas | 002, 007 | Fluxo de compras |
| 012 | Transferências entre unidades | 003 | Multiunidade |
