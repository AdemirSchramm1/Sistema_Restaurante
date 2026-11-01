# 13. Onde as fontes divergem e o que o sistema adota

> Fonte: Manual de Referência, seção 11. Estas escolhas são regras do produto; mudar qualquer uma
> exige atualizar este arquivo e os testes correspondentes.

## Escopo simplificado (novembro de 2026)

O dono do produto testou a primeira versão e achou o cadastro complexo demais. Decisões:

| Tema | Antes | Agora |
|---|---|---|
| Regras sanitárias (Anvisa/CVS) | Temperaturas, validades, lote, alérgenos, quarentena, registros | **Fora do escopo** |
| Fiscal | EAN, NCM, CEST, origem, grupo tributário, inventário fiscal | **Fora do escopo** |
| Contagem de estoque | Folhas de contagem, frequência, "inventariável" | **Fora do escopo.** O estoque baixa sozinho conforme os pedidos |
| Unidades do item | Três unidades (compra, estoque, receita), fator e conversão do item | **Uma medida** (kg, g, l, ml, un) e, opcionalmente, a embalagem de compra com a quantidade |
| Quanto se usa em cada produto | Unidade de receita e fator no item | Tela de **Produtos** (próxima feature) |
| Locais | Tipo, temperatura, responsável, ordem de contagem, regra de químicos | Só nome e tipo; item pode ter um local principal |
| Textos da tela | Termos técnicos (fator, FC, GTIN) | Rótulos do dia a dia, com exemplo em cada campo |

Os documentos de regras sanitárias, fiscal e rotinas foram retirados. O manual original continua em
[`fontes/`](fontes/) para consulta.

## Onde as fontes divergem

| Tema | Divergência | Escolha adotada |
|---|---|---|
| Estoque mínimo e ponto de pedido | Saipos/UFPR: mínimo = consumo × tempo de reposição. Conta Azul: mínimo = estoque de segurança, com dupla contagem no PP | ES = CMD × ciclo × margem; PP = CMD × LT + ES; o campo "mínimo" recebe o PP |
| Estoque máximo | Saipos: mínimo + lote. UFPR: consumo mensal + mínimo. Altametrics: par | Par = CMD × ciclo + ES |
| Devoluções no CMV | Saipos soma; BaresSP subtrai | Compras líquidas = compras − devoluções |
| Mão de obra no CMV | Blog Sebrae PR inclui; Stone exclui | Excluir |
| Faixa de CMV % | 25–35% × 30–40% | Depende do modelo; variância teórico × real é a meta principal |
| Valoração do estoque | Último custo (PDV Legal) × custo médio (Saipos) | Custo médio; último custo visível |

## Prioridade de implantação (conclusão do manual)

O que separa um estoque que só registra de um que gerencia é a **granularidade dos motivos**. A
ordem de prioridade:

1. Produtos cadastrados com as quantidades de cada item.
2. Baixa automática a cada pedido.
3. Motivos de perda em lista fechada.

O resto é refinamento. Essa ordem orienta o [roadmap do módulo](00-visao-geral.md#roadmap).

## Em aberto (próxima rodada de pesquisa)

- Comparação dos módulos de estoque de cada software.
