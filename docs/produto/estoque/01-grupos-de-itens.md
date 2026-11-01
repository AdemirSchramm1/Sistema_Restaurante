# 1. Grupos de itens: o que o estoque guarda

> Fonte: Manual de Referência "Estoque de Restaurante" (out/2026), seção 1.

O estoque de um restaurante guarda muito mais do que comida. O sistema classifica cada item em
três eixos independentes:

1. **Alimentar ou não alimentar.**
2. **Grupo e subgrupo pela natureza do produto** (proteínas, hortifrúti, laticínios, secos, bebidas…).
3. **Condição de armazenamento** (seco, refrigerado, congelado), que vem do **local**, não do grupo.

## Regra: grupo ≠ local ("shelf-to-sheet")

O **grupo** diz *o que o item é*. O **local** diz *onde ele está guardado*. A mesma categorização
aparece na prateleira e no relatório.

## Tipos de item

O tipo define a **regra de baixa** e a contabilização.

| Tipo | O que é | Como sai do estoque |
|---|---|---|
| Insumo | Entra no preparo (tomate, farinha, filé) | Pela ficha técnica, quando o prato é vendido |
| Revenda | Vendido como chega (refrigerante, cerveja) | Baixa direta na venda |
| Produzido | Preparação própria (molho, fundo, porcionado) | Entra por ordem de produção, sai pela venda |
| Consumo | Usado na operação (luvas, filme, detergente) | Saída lançada; vai para despesa |
| Patrimônio | Durável (panela, louça) | Saída lançada (quebra, descarte); ativo, não CMV |

## Árvore de grupos padrão

O sistema vem com esta árvore pré-cadastrada. O restaurante pode criar subgrupos, mas não deve
apagar os grupos (eles alimentam os relatórios de CMV por grupo).

| Grupo | Exemplos de subgrupos | Tipo / regra de baixa | Entra no CMV? |
|---|---|---|---|
| Hortifrúti (FLV) | folhosas, legumes, frutas, ervas | Insumo, baixa pela ficha técnica | Sim |
| Carnes e aves | bovinos, suínos, aves, embutidos | Insumo, peso variável | Sim |
| Pescados e frutos do mar | peixes por espécie, crustáceos, moluscos | Insumo, peso variável | Sim |
| Laticínios, frios e ovos | queijos, creme, manteiga, frios fatiados | Insumo | Sim |
| Congelados | proteínas, batata pré-frita, polpas, sorvetes | Insumo ou revenda | Sim |
| Secos e mercearia | grãos, farinhas, massas, açúcares, enlatados, óleos, temperos, molhos | Insumo | Sim |
| Padaria | pães, massas prontas | Insumo | Sim |
| Bebidas | não alcoólicas de revenda; cerveja (garrafa, lata, chope), vinhos, destilados; insumos de bar | Revenda ou insumo de drink | Sim |
| Produção própria | fundos, molhos, bases, porcionados, sobremesas | Produzido | Sim |
| Embalagens de delivery | potes, sacolas, talheres descartáveis | Insumo da ficha técnica de delivery | Sim |
| Descartáveis de produção | filme, papel-alumínio, luvas, toucas | Consumo | Em geral despesa |
| Higiene e limpeza | sanitizantes, detergentes, insumos de lava-louças | Consumo, guardado fora da área de alimentos | Não (despesa) |
| EPIs, uniformes, utensílios, louças, enxoval, escritório, manutenção | luvas térmicas, panelas, pratos, bobinas, lâmpadas | Consumo ou patrimônio, contagem mensal ou trimestral | Não |

Regra contábil: **consumível é despesa, durável é ativo**
([MarginEdge](https://www.marginedge.com/blog/the-complete-guide-to-non-food-restaurant-inventory)).
Entram no CMV proteínas, vegetais, grãos, temperos, óleo de fritura, bebidas e embalagens de
delivery; limpeza, aluguel, energia e salários são despesa
([Stone](https://conteudo.stone.com.br/o-que-e-cmv-restaurante-como-calcular/)).

## Casos especiais

- **Gás (GLP):** nenhuma fonte o trata como estoque. Quem quiser controlar botijões cadastra como
  item de *consumo*, fora do CMV.
- **Chope:** rendimento real do barril fica entre 85% e 95% do teórico (espuma, limpeza de linha,
  excesso no serviço — [PourIQ](https://pouriq-website-drew.pages.dev/glossary/draft-yield/)). O
  rendimento fica na tela de Produtos (feature 003), não no cadastro do item.

## Critérios de aceite (para a spec)

- Todo item tem exatamente um grupo, um subgrupo e um tipo.
- O flag "entra no CMV" vem do grupo e pode ser sobrescrito no item, com registro de quem alterou.
- Relatórios de CMV agrupam por grupo.
