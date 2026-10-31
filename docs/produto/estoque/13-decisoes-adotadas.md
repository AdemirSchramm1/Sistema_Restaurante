# 13. Onde as fontes divergem e o que o sistema adota

> Fonte: Manual de Referência, seção 11. Estas escolhas são regras do produto; mudar qualquer uma
> exige atualizar este arquivo e os testes correspondentes.

| Tema | Divergência | Escolha adotada |
|---|---|---|
| Estoque mínimo e ponto de pedido | Saipos/UFPR: mínimo = consumo × tempo de reposição. Conta Azul: mínimo = estoque de segurança, com dupla contagem no PP | ES = CMD × ciclo × margem; PP = CMD × LT + ES; o campo "mínimo" recebe o PP |
| Estoque máximo | Saipos: mínimo + lote. UFPR: consumo mensal + mínimo. Altametrics: par | Par = CMD × ciclo + ES |
| Devoluções no CMV | Saipos soma; BaresSP subtrai | Compras líquidas = compras − devoluções |
| Mão de obra no CMV | Blog Sebrae PR inclui; Stone exclui | Excluir |
| Vigência da CVS 3/2026 | 04/10/2026 × 01/02/2027 | 01/02/2027; CVS 5/2013 vale em SP até lá |
| Refrigeração | Saipos 0–5 °C; CVS por produto; RDC < 5 °C; SC ≤ 4 °C para preparados | < 5 °C como regra, ≤ 4 °C para preparados e carnes, tabela CVS por produto |
| Cocção na CVS 3 | 74 °C × 75 °C | 75 °C; a RDC 216 exige 70 °C |
| Guarda de registros | RDC 216: 30 dias; CVS 3: 180 dias | 180 dias |
| Faixa de CMV % | 25–35% × 30–40% | Depende do modelo; variância teórico × real é a meta principal |
| Valoração do estoque | Último custo (PDV Legal) × custo médio (Saipos) | Custo médio; último custo visível |

## Prioridade de implantação (conclusão do manual)

O que separa um estoque que só registra de um que gerencia é a **granularidade dos motivos**. A
ordem de prioridade:

1. Fichas técnicas com FC medido e sub-receitas cadastradas.
2. Motivos de saída em lista fechada.
3. Contagem diária dos itens A.
4. Revisão semanal da variância.

O resto é refinamento. Essa ordem orienta o [roadmap do módulo](00-visao-geral.md#roadmap).

## Em aberto (próxima rodada de pesquisa)

- Comparação dos módulos de estoque de cada software.
- Tratamento fiscal de perdas, cortesias e refeições de funcionários no Simples Nacional.
- NF-e de transferência entre cozinha central e filiais.
- Efeito da Reforma Tributária.
- Texto vigente da lista de verificação sanitária de SC.
