# 2. Cadastro do item

> Revisado em novembro de 2026 a pedido do dono do produto: o cadastro ficou **simples**. Quem
> olha a tela precisa entender na hora o que cada campo pede. Ver
> [13-decisoes-adotadas](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

O item é tudo o que o restaurante guarda: ingredientes, bebidas para revenda, descartáveis,
material de limpeza. O cadastro responde a três perguntas, nesta ordem:

1. **O que é?** Nome, grupo e tipo.
2. **Em que medida você controla?** Quilo, grama, litro, mililitro ou unidade.
3. **Como você compra?** (opcional) A embalagem e quanto vem nela.

## 1. O que é

| Campo na tela | O que pede | Exemplo |
|---|---|---|
| Nome do item | Como a equipe chama o item | "Tomate", "Coca-Cola lata 350 ml" |
| Grupo | Onde o item aparece na lista | Hortifrúti › Legumes |
| Tipo | Para que o item serve | Ingrediente, Revenda, Feito na cozinha, Material de uso, Equipamento |

- **Código interno** no formato grupo.subgrupo.número (ex.: `01.03.0045`) é gerado pelo sistema e
  nunca muda.
- Não pode haver dois itens ativos com o mesmo nome no mesmo grupo.

## 2. Em que medida você controla

Uma pergunta só: **"Em que medida você controla este item?"**

| Opção | Use para |
|---|---|
| Quilo (kg) ou grama (g) | O que se pesa: carne, arroz, queijo |
| Litro (l) ou mililitro (ml) | O que se mede: leite, óleo, chope |
| Unidade (un) | O que se conta: ovo, lata, pão |

- O saldo do item fica nessa medida, e é nela que o estoque **baixa sozinho quando os pedidos dos
  clientes saem** (ver [produtos](04-fichas-tecnicas.md)).
- Na tela de produtos, a quantidade usada pode ser digitada em medida menor da mesma família
  (gramas de um item controlado em kg; ml de um item em litros). A conversão é automática.
- **Depois da primeira movimentação a medida não muda.** Para mudar, inative o item e crie outro.
- **Item que um produto, preparo ou adicional usa só muda de medida dentro da família** (kg e g,
  l e ml), mesmo antes da primeira movimentação. Vale também para versões antigas do produto, que
  os pedidos já enviados usam na baixa. A tela diz em quais produtos e adicionais o item está; para
  trocar de família (kg para un), crie outro item. Decisão de novembro de 2026: sem isso, a
  quantidade da linha (150 g) não convertia e o "Começar preparo" daquele produto falhava.

## 3. Como você compra (opcional)

Preencha só se o item chega em embalagem fechada.

| Campo na tela | O que pede | Exemplo |
|---|---|---|
| Embalagem | Nome da embalagem | Caixa, Saco, Fardo |
| Quanto vem em cada embalagem | Quantidade, na medida do item | 20 (kg) |

- A tela mostra a frase pronta: **"1 Caixa = 20 kg"**.
- Os dois campos andam juntos: ou os dois vazios, ou os dois preenchidos com quantidade maior que
  zero.

## Custo do item

- **Custo médio** e **último custo** são calculados pelas entradas de estoque e só aparecem na
  tela, sem edição. Desde a feature 004: a compra (valor total pago ÷ quantidade) recalcula o custo
  médio ponderado; perdas e acertos saem pelo custo médio e não o mudam; estorno de compra desfaz
  a compra na média.

## Fora do cadastro

Estes campos existiam e foram retirados por não serem usados pelo restaurante: temperaturas,
validades, lote, alérgenos, peso líquido/drenado, peso variável, fator de correção, rendimento,
EAN, NCM, CEST, origem, grupo tributário, categoria financeira, unidade de receita, conversão do
item, "inventariável" e frequência de contagem.

## Critérios de aceite (para a spec)

- O formulário tem três blocos, com os títulos "O que é", "Em que medida você controla" e "Como
  você compra (opcional)".
- Todo campo tem rótulo em linguagem do dia a dia e um exemplo.
- Não é possível salvar dois itens ativos com o mesmo nome normalizado no mesmo subgrupo.
- Código é gerado pelo sistema e não pode ser editado.
- A medida do item não pode ser alterada depois da primeira movimentação.
- Item usado em produto, preparo ou adicional (em qualquer versão) só muda de medida dentro da
  família, e a recusa diz onde ele está.
- Embalagem sem quantidade (ou quantidade sem embalagem) não salva e aponta o campo que falta.
