# 3. Fornecedores

> **Escopo simplificado (novembro de 2026).** Na feature de fornecedores entram só os dados
> comerciais (contato, entrega, pagamento, itens e preços). Os blocos sanitário e fiscal e o de-para
> da NF-e ficam fora. Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

> Fonte: Manual de Referência, seção 3 ("Fornecedor é requisito sanitário, não só comercial").

A RDC 216/2004 (item 4.7.1) obriga o restaurante a **especificar critérios de avaliação e seleção
de fornecedores** ([Anvisa](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html)).
A CVS 3/2026 (SP) exige critérios formais que incluem a licença sanitária. Critérios comerciais:
preço, prazo, credibilidade, qualidade, conformidade fiscal, capacidade de entrega e atendimento.
Boa prática: **cotar com no mínimo três fornecedores** antes de cada pedido.

> **Primeira versão (feature 007).** Menu **Fornecedores**. Só o nome é obrigatório; o resto é
> opcional: razão social, CNPJ (validado, aceita o CNPJ com letras), vendedor, telefone, e-mail,
> dias de entrega, prazo de entrega em dias, pedido mínimo e como paga. Em "Itens que vende" entra
> cada item com o preço e, se houver, a embalagem desse fornecedor ("Caixa" com 18 kg); a tela
> mostra o preço por medida para comparar, e cada item tem no máximo um fornecedor **preferido**.
> A página do item mostra quem vende e quem é o mais barato por medida. A compra pode dizer de
> qual fornecedor foi e ser lançada na embalagem dele; o preço cadastrado não muda sozinho. O
> fornecedor pode ser **bloqueado** (some da compra) e nunca é apagado. Cadastram: gerente e
> comprador. Status "em avaliação", indicadores de desempenho, sanitário, fiscal e de-para da NF-e
> ficam fora.

## Campos do cadastro

| Bloco | Campos |
|---|---|
| Legal e fiscal | Razão social, fantasia, CNPJ, IE, situação cadastral, regime tributário |
| Contato e canal | Vendedor, financeiro, SAC; WhatsApp, portal ou EDI |
| Sanitário | Licença sanitária; SIF/SIE/SIM para produtos de origem animal |
| Logística | Categorias atendidas, dias e janela de entrega, lead time, pedido mínimo, frete |
| Financeiro | Formas e prazos de pagamento, PIX, dados bancários |
| Itens fornecidos | Código do fornecedor, embalagem, unidade, fator, preço vigente, última compra, preferencial |
| Desempenho | % entregas no prazo, % não conformidades e devoluções, variação de preço, nota de atendimento |
| Status | Homologado, em avaliação ou bloqueado; substitutos |

## Vínculo item-fornecedor

É aqui que mora o **fator de conversão de compra** e o **de-para da NF-e**: o código que o
fornecedor usa na nota aponta para o item interno, com a embalagem e o fator daquele fornecedor.

## Avaliação de desempenho (proposta)

Nenhuma fonte brasileira traz pesos. Proposta inicial, calculada automaticamente a partir dos
recebimentos:

- **Pontualidade:** entregas dentro da janela ÷ total de entregas.
- **Conformidade:** recebimentos sem não conformidade ÷ total.
- **Preço:** variação do preço pago contra o preço vigente cadastrado.
- **Atendimento:** nota manual do gerente.

## Critérios de aceite (para a spec)

- CNPJ é validado (dígitos verificadores) e único por restaurante.
- Fornecedor **bloqueado** não pode receber pedido nem ter recebimento lançado.
- Fornecedor de produto de origem animal sem SIF/SIE/SIM gera alerta no cadastro e no recebimento.
- Indicadores de desempenho são recalculados a cada recebimento.
