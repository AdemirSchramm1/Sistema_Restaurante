# Módulo de Estoque — Visão geral

> Fonte principal: Manual de Referência "Estoque de Restaurante — O que armazenar, como cadastrar
> e como fazer funcionar" (outubro de 2026). O manual consolida material acadêmico (UFPR, UFPB,
> UFMS, Demetra/UERJ), Sebrae, normas sanitárias (Anvisa, CVS/SP), fontes contábeis e fiscais e
> documentação de sistemas de gestão. **As estruturas propostas são sínteses das fontes, não
> padrões oficiais.** Conteúdo de fornecedores de software serve como retrato da prática, não norma.

> **Escopo simplificado (novembro de 2026).** O sistema não controla temperatura, validade,
> alérgenos, fiscal nem contagem de estoque. O estoque **baixa sozinho conforme os clientes pedem
> os produtos**. Detalhes em
> [13-decisoes-adotadas](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

## Para que serve

O estoque responde a uma pergunta gerencial: **por que o CMV real ficou diferente do CMV
teórico?** Os melhores operadores mantêm essa diferença em ~1 p.p.; 3 p.p. já pede investigação.
A faixa de CMV mais citada no Brasil vai de 25% a 35% do faturamento (até 40% à la carte). Em 2026,
23% dos bares e restaurantes operavam no prejuízo (Abrasel) — controle de custo é urgente.

## Os cinco dados mestres

| Dado mestre | Documento |
|---|---|
| Itens (nome, grupo, medida, embalagem de compra, custos) | [01-grupos-de-itens](01-grupos-de-itens.md), [02-cadastro-de-itens](02-cadastro-de-itens.md) |
| Fornecedores | [03-fornecedores](03-fornecedores.md) |
| Produtos (o que o cliente pede e quanto de cada item usa) | [04-fichas-tecnicas](04-fichas-tecnicas.md) |
| Movimentações | [06-movimentacoes](06-movimentacoes.md) |

## O ciclo fechado

Produto cadastrado com as quantidades → compra → entrada no estoque → **baixa automática a cada
pedido** → registro de perdas. Detalhes em [08-ciclo-operacional](08-ciclo-operacional.md)
(as etapas de contagem e conferência sanitária desse documento estão fora do escopo).

## Demais documentos

- [09-controles-e-permissoes](09-controles-e-permissoes.md) — papéis e segregação de funções.
- [10-indicadores](10-indicadores.md) — CMV, variância, giro, acurácia e outros.
- [13-decisoes-adotadas](13-decisoes-adotadas.md) — onde as fontes divergem e o que adotamos.

## Roadmap

Ordem sugerida, seguindo a prioridade de implantação do manual. Cada linha vira uma feature no
Spec Kit (`specs/NNN-nome/`).

| # | Feature | Depende de | Entrega |
|---|---|---|---|
| 001 | Cadastros base: grupos, locais, itens | – | Feito |
| 002 | Simplificar o cadastro e retirar os locais | 001 | Feito: só nome, grupo, medida e embalagem; sem locais |
| 003 | **Produtos**: o que o cliente pede e quanto de cada item usa | 002 | Feito: produtos vendidos e preparos, versões e custo |
| 004 | Entradas, perdas e saldo (livro imutável) + custo médio | 002 | Feito: compra entra, perda sai com motivo, acerto com aprovação, estorno |
| 005 | Baixa automática por pedido | 003, 004 | Estoque diminui conforme os clientes pedem. **Espera o cardápio do cliente** (QR code na mesa) |
| 006 | Alerta de reposição | 004, 005 | Aviso quando o item está acabando |
| 007 | Fornecedores | 004 | Em revisão ([specs/007](../../../specs/007-fornecedores/spec.md)): cadastro comercial, itens e preços, preferido, compra com fornecedor, bloqueio |
| 008 | Painel de custo dos produtos | 003, 004 | Quanto custa cada produto vendido |

Fora do roadmap por decisão do dono: contagem de estoque (inventário), registros sanitários,
conferência cega, fiscal e locais de armazenamento (o saldo é um só por item).
