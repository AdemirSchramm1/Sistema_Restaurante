# Feature 002 — Simplificar o cadastro de itens e locais

**Branch**: `002-simplificar-cadastro` · **Criada**: 2026-11-01 · **Status**: em revisão

## Contexto

O dono do produto testou a feature 001 e achou o cadastro "complexo demais": a tela pedia
temperatura, validade, alérgenos, dados fiscais e contagem, e a parte de unidades (compra, estoque,
receita, fator, conversão) era confusa. Decisão registrada em
[13-decisoes-adotadas](../../docs/produto/estoque/13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

Regras de negócio: [02-cadastro-de-itens](../../docs/produto/estoque/02-cadastro-de-itens.md) e
[05-locais](../../docs/produto/estoque/05-locais.md).

## Histórias

### US1 — Cadastrar um item entendendo cada campo de primeira (P1)

Como dono do restaurante, quero cadastrar um item respondendo três perguntas simples, para não
precisar saber termos técnicos.

**Cenários**

1. Dado o formulário de novo item, então vejo os blocos "O que é", "Em que medida você controla
   este item?" e "Como você compra? (opcional)", e cada campo tem rótulo e exemplo.
2. Dado "Tomate" controlado em kg, sem embalagem, quando salvo, então o item é criado.
3. Dado "Arroz" em kg comprado em "Saco" com 5, então a tela mostra "1 Saco = 5 kg" e salva.
4. Dado embalagem "Caixa" sem quantidade, quando salvo, então aparece o erro no campo da
   quantidade (e vice-versa).
5. O formulário não tem temperatura, validade, alérgenos, EAN, NCM, CEST, origem, contagem,
   unidade de receita nem fator de conversão.

### US2 — Locais sem burocracia (P2)

1. O local tem só nome e tipo.
2. No item, marco em quais locais ele fica e qual é o principal. Não há posição na folha.
3. Não existe mais a folha de contagem impressa nem o local de quarentena criado sozinho.

## Requisitos

- **FR-001** O item guarda: nome, grupo/subgrupo, tipo, medida (kg, g, l, ml, un) e,
  opcionalmente, embalagem de compra com a quantidade na medida do item.
- **FR-002** Embalagem e quantidade andam juntas; quantidade > 0.
- **FR-003** Mantidas da 001: código gerado e imutável, nome único por subgrupo entre ativos,
  medida bloqueada após a 1ª movimentação, trava otimista, auditoria, permissões.
- **FR-004** Removidos do banco (migração `0002`): campos sanitários, fiscais, de contagem,
  unidade de receita e conversões do item; temperatura, responsável e ordem dos locais; posição na
  folha.
- **FR-005** Textos da tela em linguagem do dia a dia, sem siglas (FC, GTIN, NCM, CMV aparecem só
  onde inevitável e explicados).

## Fora do escopo

Grupos (classe de armazenagem e "entra no CMV") ficam como estão. A tela de Produtos é a
feature 003.
