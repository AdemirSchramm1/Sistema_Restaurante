# 10. Indicadores

> Fonte: Manual de Referência, seção 8.

**A variância entre CMV teórico e real é o indicador que mais pesa.** Os operadores mais
eficientes mantêm essa diferença em ~1 p.p. ou menos; 3 p.p. já pede investigação.

## CMV

**CMV = Estoque inicial + (Compras − Devoluções de compras) − Estoque final**

- Devoluções **subtraem** das compras (compras líquidas).
- Mão de obra **não** entra no CMV (é despesa de pessoal).
- Entram só mercadorias, insumos e embalagens de delivery.
- Exige **contagem física** no início e no fim do período.

**Exemplos (casos de teste):**

- 4.000 + 2.000 − 3.000 = R$ 3.000 → 30% de faturamento de R$ 10.000.
- Com R$ 200 devolvidos: 4.000 + (2.000 − 200) − 3.000 = R$ 2.800 → 28%.

## Painel de indicadores

| Indicador | Fórmula | Meta / referência |
|---|---|---|
| CMV % | CMV ÷ faturamento bruto × 100 | 25%–35% em geral; até 40% à la carte; > 40% margem em risco |
| CMV teórico % | Σ (custo da ficha × unidades vendidas) ÷ receita | Referência do período |
| **Variância real − teórico** | CMV% real − CMV% teórico | ≤ 1 p.p. excelente; < 2 bom; ≥ 3 investigar; 4–5 por semanas = sistêmico |
| Variância por item | (uso real − uso teórico) ÷ uso teórico | > 10% = investigar |
| Giro | CMV ÷ estoque médio | Alimentos: 4 a 8 giros/mês, média ~5 |
| Cobertura (dias) | Estoque ÷ consumo médio diário | ~5 a 7 dias com 1–2 entregas/semana |
| Acurácia do inventário | Itens com físico = sistema ÷ itens auditados × 100 | > 95% geral; ≥ 98% classe A |
| Ruptura | Itens em falta ÷ total de itens × 100 | Perto de 0%; 4–5% grave |
| Índice de perdas | Perdas registradas ÷ compras de alimentos × 100 | < 2%–4% |
| Divergência de recebimento | Divergências não resolvidas ÷ compras × 100 | < 1% |
| FC | Peso bruto ÷ peso líquido | Medido na casa |
| IC | Peso cozido ÷ peso líquido cru | Medido na casa |
| Curva ABC | Itens ordenados por valor consumido, % acumulado | A ≈ 20% itens / 80% valor; B ≈ 30% / 15%; C ≈ 50% / 5% |

**Não existe meta universal de CMV.** Por isso a meta principal do painel é a variância.

Em restaurante a curva ABC é mais concentrada que 80/20: num brunch de Campo Grande, 3 itens (8,8%)
responderam por 62% do consumo. Um punhado de proteínas e bebidas define o resultado.

## Investigação quando a variância sobe

O painel guia esta sequência:

1. Quebrar a variância por ingrediente.
2. Checar reajustes de preço não aplicados à ficha.
3. Procurar perdas sem registro.
4. Pesar as porções servidas.
5. Ver se o desvio é constante (ficha desatualizada) ou intermitente (evento pontual).

Em rede, ler a variância **loja a loja**: uma média boa pode esconder uma unidade 14,7 p.p. acima.

## Critérios de aceite (para a spec)

- Cada fórmula acima tem teste com os exemplos numéricos deste documento.
- Curva ABC é recalculada no fechamento do período, nunca digitada.
- Variância por item > 10% e por categoria > 3% aparecem destacadas.
