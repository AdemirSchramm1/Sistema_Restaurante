# 4. Produtos (fichas técnicas)

> **Primeira versão (feature 003, novembro de 2026).** Na tela de **Produtos** a pessoa cadastra o
> que o cliente pede (ex.: "X-Burger") e quanto de cada item vai nele (ex.: pão 1 un, carne 150 g,
> queijo 30 g). É com essas quantidades que o estoque baixa sozinho a cada pedido. A quantidade é
> digitada na medida do item ou numa menor da mesma família (g para itens em kg).
>
> **Preparos** (molho, massa, hambúrguer porcionado) são produtos do tipo "Preparo" com "quanto
> rende" (ex.: 2 kg). Outro produto usa uma parte do preparo (ex.: 50 g) e, no pedido, o estoque
> baixa a parte proporcional dos ingredientes do preparo. Não existe ordem de produção nem estoque
> de preparo pronto nesta versão.
>
> Cada edição das linhas ou do rendimento cria uma **versão** com data; o pedido usa a versão do
> dia. A tela mostra o custo pelo custo médio dos itens ("Sem custo ainda" antes da primeira
> compra). Ficam fora da primeira versão: preço de venda e % do custo no preço, FC, IC, porções,
> alérgenos, modo de preparo e foto. O resto deste documento é a referência do manual.

> Fonte: Manual de Referência, seção 3 ("A ficha técnica liga estoque, custo e venda").

A ficha técnica é o primeiro passo do controle de estoque: **sem ela não existe baixa automática
nem CMV teórico.**

## Os três índices

| Índice | Fórmula | Uso |
|---|---|---|
| Fator de correção (FC) | peso bruto ÷ peso líquido | Perda no pré-preparo; serve para **comprar** |
| Índice de cocção (IC) | peso cozido ÷ peso líquido cru | Controla o processo |
| Índice de rendimento (IR) | peso da preparação pronta ÷ soma dos pesos líquidos | Rendimento da receita |

**Exemplo:** 10 kg brutos rendem 8 kg limpos → FC = 1,25. Para obter 8 kg limpos é preciso
comprar 10 kg, e o custo do kg limpo = preço do kg bruto × 1,25.

### O FC precisa ser medido na própria cozinha

Valores medidos ficam longe das tabelas de referência:

| Hortaliça | FC medido (Aracaju) | FC de referência (Ornellas) |
|---|---|---|
| Alface lisa | 2,04 | 1,31 |
| Rúcula | 2,30 | 1,57 |
| Batata inglesa | 1,29 | 1,06 |
| Tomate | 1,08 | 1,61 |
| Cebola branca | 1,04 | 1,53 |

O IR do arroz variou de 1,69 a 2,32 em três restaurantes; o do frango grelhado, de 0,49 a 0,63.
Por isso o sistema oferece um **registro de teste de rendimento** (peso bruto, peso limpo, peso
cozido, data, responsável) que atualiza o FC/IC do item.

## Estrutura da ficha

| Parte | Campos |
|---|---|
| Cabeçalho | Código, nome, categoria do cardápio, tipo (prato final ou sub-receita), rendimento total, nº e peso das porções, IC, validade e conservação (sub-receitas), equipamentos, tempos, responsável, versão e data |
| Linhas | Insumo ou sub-receita, quantidade líquida, unidade de receita, FC, quantidade bruta (= líquida × FC), custo unitário, custo da linha. Incluir água, óleo e temperos |
| Rodapé | Custo total e por porção, embalagem (delivery), preço de venda, % de CMV, markup, modo de preparo, foto, alérgenos herdados, informação nutricional (opcional) |

## Sub-receitas

Molho de tomate, fundo, massa, hambúrguer porcionado são cadastrados como **itens produzidos** com
rendimento próprio:

- A **ordem de produção** baixa os ingredientes crus e dá entrada na sub-receita.
- A **venda** baixa a sub-receita.
- Assim não há baixa dupla.

## Transformação (desossa e porcionamento)

Um produto principal vira vários derivados com rateio de custo: peça inteira → cortes, aparas e
perda (modelo Teknisa).

## Versionamento

- A ficha é versionada. Toda alteração cria nova versão com data de vigência.
- Venda usa a versão vigente na data da venda (o CMV teórico do passado não muda).
- Ao mudar o preço de um insumo principal, o sistema sinaliza as fichas afetadas para revisão.

## Critérios de aceite (para a spec)

- Quantidade bruta da linha = quantidade líquida × FC, calculada pelo sistema.
- Custo da linha = quantidade bruta convertida para unidade de estoque × custo médio do item.
- Uma sub-receita não pode conter a si mesma, direta ou indiretamente (sem ciclos).
- Alérgenos da ficha = união dos alérgenos de todos os insumos e sub-receitas.
- % CMV da ficha = custo por porção ÷ preço de venda × 100.
