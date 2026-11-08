# 4. Adicionar e tirar por botão

Spec [010](../../../specs/010-adicionais-retiradas/spec.md). Decisão do dono: **só botões**, sem
observação livre no cardápio. Assim a cozinha sabe exatamente o que mudou e quanto custa.

## Adicionais

Tela **Pedidos → Adicionais**. Cadastrar e mudar: só gerente. Ver: gerente e chef.

- Nome do botão (até 40 letras, não repete entre os ativos): "Fatia de queijo".
- O que vai: um **item** ou um **preparo**, com quantidade e medida por vez ("Queijo mussarela,
  20 g"). Mesmas regras de medida da linha do produto.
- Preço (zero ou mais). Zero aparece como **Grátis**.
- A página mostra o custo de uma vez, quanto do preço vai em ingredientes (faixa da feature 008) e
  em quais produtos o adicional está ligado.
- Adicional não é apagado: é inativado. Inativo some do cardápio; pedidos antigos não mudam.
  Adicional com item ou preparo inativo também some, com aviso na página.

## Quadro "Adicionar e tirar" do produto

Na página de cada produto vendido. Só gerente muda.

- **Adicionar**: liga adicionais ao produto, cada um com o máximo de vezes por prato (1 a 5).
- **Tirar**: escolhe ingredientes da versão mais nova do produto que o cliente pode tirar, com o
  texto do botão (padrão "Sem {nome}").
- Até 10 de cada. Salvar o quadro não cria versão nova do produto; vai para o histórico do produto
  ("Adicionar: Fatia de queijo (até 3). Tirar: Sem cebola.").
- Se uma versão nova do produto tira o ingrediente, o quadro avisa ("Cebola saiu do produto…") e o
  botão some do cardápio.

## No cardápio e na cozinha

- O cliente toca "+" até o máximo; o preço do prato soma os adicionais:
  preço do prato = preço do produto + Σ(preço do adicional × vezes); total = preço × quantidade.
- Exemplo: 2 × X-Burger (R$ 28,00) com + 2 Fatia de queijo (R$ 3,00) e sem cebola = 2 × R$ 34,00 =
  **R$ 68,00**.
- A cozinha, o garçom, "Meus pedidos" e a consulta mostram "+ 2 Fatia de queijo" e "**SEM** cebola"
  embaixo do prato.
- O pedido guarda cópia do nome, preço, item e quantidade de cada adicional no envio: mudar o
  adicional depois não muda pedido enviado.

## Consumo (para a baixa automática, feature 005)

Uma linha do pedido usa: a ficha da versão do envio, **sem** os ingredientes retirados, **mais**
cada adicional × vezes, tudo × quantidade. No exemplo: pão 2 un, carne 0,3 kg, queijo 0,14 kg
(2 × (30 g + 2 × 20 g)), nenhuma cebola.
