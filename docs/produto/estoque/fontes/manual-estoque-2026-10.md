> Conversão automática (pandoc) do arquivo original "Estoque de Restaurante - Manual Completo.docx", mantida como fonte. Os documentos 00–13 desta pasta são a versão organizada para o produto.

**MANUAL DE REFERÊNCIA**

**Estoque de Restaurante**

O que armazenar, como cadastrar e como fazer funcionar: dados, regras
sanitárias, processos, controles e indicadores

Outubro de 2026

**Sumário**

Um estoque de restaurante bem montado guarda muito mais do que comida.
Ele organiza **cinco conjuntos de dados mestres**: itens (com unidades,
conversões, custos, validades e dados fiscais), fornecedores, fichas
técnicas, locais e movimentações. Sobre esses dados roda um ciclo
fechado: ficha técnica, planejamento, compra, recebimento, armazenagem,
requisição, produção, baixa por venda, registro de perdas, contagem e
ajuste. Esse ciclo responde a uma única pergunta gerencial: **por que o
CMV real ficou diferente do CMV teórico?** Os operadores mais eficientes
mantêm essa diferença em cerca de **1 ponto percentual ou menos**, e uma
diferença de 3 p.p. já pede investigação
([<u>Restaurant365</u>](https://www.restaurant365.com/blog/closing-the-gap-between-actual-and-theoretical-food-costs);
[<u>Supy</u>](https://supy.io/blog/learn-theoretical-vs-actual-food-cost-variance)).
A faixa de CMV mais citada no Brasil vai de **25% a 35% do
faturamento**, chegando a 40% em operações à la carte
([<u>Stone</u>](https://conteudo.stone.com.br/o-que-e-cmv-restaurante-como-calcular/);
[<u>Central do Varejo</u>](https://centraldovarejo.com.br/?p=45839)). No
plano sanitário, para um restaurante em Santa Catarina, a norma
obrigatória continua sendo a **RDC Anvisa 216/2004**, com a lista de
verificação estadual e as exigências municipais. As portarias paulistas
CVS 5/2013 e CVS 3/2026 entram neste manual como referência técnica,
porque trazem os números (temperaturas, prazos, afastamentos) que a
norma federal não fixa. A pressão por controle é real: segundo a
Abrasel, **23% dos bares e restaurantes operavam no prejuízo** no início
de 2026, contra 16% no fim de 2025 ([<u>Bloomberg
Línea</u>](https://www.bloomberglinea.com.br/negocios/contra-conta-de-padaria-foodtech-fatura-r-24-mi-com-corte-em-custo-de-restaurantes/)).

**Sobre as fontes e o escopo.** Este manual consolida material acadêmico
de administração de UAN (UFPR, UFPB, UFMS, Demetra/UERJ), Sebrae e
Sebraetec, normas sanitárias (Anvisa e CVS/SP), fontes contábeis e
fiscais e documentação ou blogs de sistemas de gestão. Os sistemas
nacionais citados são Saipos, Stone, PDV Legal/Tablet Cloud, Suitable,
Teknisa, Alterdata e Omie; os internacionais, Compeat,
Fourth/HotSchedules, Restaurant365, Toast, MarketMan, MarginEdge, Supy e
Altametrics. A maior parte do conteúdo de mercado é marketing de
fornecedores de software: serve como retrato da prática, não como norma.
**Esta rodada não comparou os módulos de cada software.** Os
fornecedores aparecem aqui só como fonte de campos, fluxos e benchmarks.
Também não foi encontrado material da Abrasel nacional nem do Sebrae com
uma lista oficial de campos ou uma árvore de categorias para
restaurantes. Por isso, as estruturas propostas abaixo são sínteses das
fontes, não padrões oficiais.

# 1. O estoque guarda treze grupos de itens, não só alimentos

Fontes brasileiras e internacionais convergem em três eixos de
classificação. O primeiro separa **alimentares** de **não alimentares**.
O segundo cria **grupos e subgrupos por natureza do produto**
(proteínas, hortifrúti, laticínios, secos, bebidas). O terceiro agrupa
por **condição de armazenamento** (seco, refrigerado, congelado). A
apostila de administração de materiais em UAN da UFPR divide os não
alimentares em diretos (copos, guardanapos, embalagens de marmita),
indiretos (papel-alumínio, filme PVC, luvas descartáveis), higiene e
limpeza e EPIs
([<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)).
A mesma disciplina acrescenta a **reserva operacional**, com lâmpadas e
fixadores ([<u>UFPR, aula
04</u>](https://docs.ufpr.br/~monica.anjos/resumos/resumo_aula_04.pdf)).
A Saipos separa **insumos** (entram no preparo) de **itens de revenda**
(vendidos como chegam, como refrigerante ou cerveja)
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/cadastro-de-produtos)).
Teknisa e Fourth tratam as **preparações próprias** (molhos, bases,
porcionados, receitas de lote) como itens estocáveis distintos
([<u>Teknisa</u>](https://universidade.teknisa.com/wp-content/uploads/2025/04/06_MANUAL_ESTOQUE-WEB_PRODUTOS-PROCESSADOS_v2.pdf);
[<u>Fourth/HotSchedules</u>](https://help.hotschedules.com/hc/en-us/articles/360055940652-Inventory-Restaurants-Ingredient-and-Recipe-Fields-for-Inventory)).

A regra prática mais repetida é o **"shelf-to-sheet"**: a mesma
categorização deve aparecer na prateleira, na folha de contagem e no
relatório. A MarketMan conta o caso de batatas-doces guardadas atrás de
barris que ficavam fora de toda contagem
([<u>MarketMan</u>](https://marketman.com/blog/restaurant-inventory-categories)).
Em um restaurante de João Pessoa, depósito, software, relatórios e
listas de compra eram organizados pelos mesmos grupos, como cervejas,
destilados, congelados, carnes e limpeza ([<u>Langguth,
UFPB</u>](https://repositorio.ufpb.br/jspui/bitstream/123456789/3976/1/GASL17042018.pdf)).
Por isso os bons sistemas separam o **grupo** (o que o item é) do
**local** (onde ele está guardado).

A tabela a seguir propõe uma árvore de grupos para o Brasil. As
frequências de contagem de não alimentares vêm da MarginEdge, e a regra
contábil "consumível é despesa, durável é ativo" também
([<u>MarginEdge</u>](https://www.marginedge.com/blog/the-complete-guide-to-non-food-restaurant-inventory)).

| **Grupo**                                                            | **Exemplos de subgrupos**                                                                                                       | **Tipo de item / regra de baixa**                       | **Entra no CMV?**    |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|----------------------|
| Hortifrúti (FLV)                                                     | folhosas, legumes, frutas, ervas                                                                                                | Insumo, baixa pela ficha técnica                        | Sim                  |
| Carnes e aves                                                        | bovinos, suínos, aves, embutidos                                                                                                | Insumo, peso variável                                   | Sim                  |
| Pescados e frutos do mar                                             | peixes por espécie, crustáceos, moluscos                                                                                        | Insumo, peso variável                                   | Sim                  |
| Laticínios, frios e ovos                                             | queijos, creme, manteiga, frios fatiados                                                                                        | Insumo                                                  | Sim                  |
| Congelados                                                           | proteínas, batata pré-frita, polpas, sorvetes                                                                                   | Insumo ou revenda                                       | Sim                  |
| Secos e mercearia                                                    | grãos, farinhas, massas, açúcares, enlatados, óleos, temperos, molhos industrializados                                          | Insumo                                                  | Sim                  |
| Padaria                                                              | pães, massas prontas                                                                                                            | Insumo                                                  | Sim                  |
| Bebidas                                                              | não alcoólicas de revenda; cerveja (garrafa, lata, chope em barril), vinhos, destilados; insumos de bar (xaropes, frutas, gelo) | Revenda (baixa direta) ou insumo de drink               | Sim                  |
| Produção própria                                                     | fundos, molhos, bases, porcionados, sobremesas                                                                                  | Produzido: entra por ordem de produção e sai pela venda | Sim                  |
| Embalagens de delivery                                               | potes, sacolas, talheres descartáveis                                                                                           | Insumo da ficha técnica de delivery                     | Sim (a Stone inclui) |
| Descartáveis de produção                                             | filme, papel-alumínio, luvas, toucas                                                                                            | Consumo                                                 | Em geral despesa     |
| Higiene e limpeza                                                    | sanitizantes, detergentes, insumos de lava-louças                                                                               | Consumo, guardado fora da área de alimentos             | Não (despesa)        |
| EPIs, uniformes, utensílios, louças, enxoval, escritório, manutenção | luvas térmicas, panelas, pratos, bobinas, lâmpadas                                                                              | Consumo ou patrimônio, contagem mensal ou trimestral    | Não                  |

A Stone define que entram no CMV proteínas, vegetais, grãos, temperos,
óleo de fritura, bebidas e **embalagens descartáveis de delivery**, e
que limpeza, aluguel, energia e salários são despesa
([<u>Stone</u>](https://conteudo.stone.com.br/o-que-e-cmv-restaurante-como-calcular/)).
Nenhuma fonte consultada trata o **gás (GLP)** como item de estoque; a
Stone só o cita como custo a considerar na ficha técnica ([<u>Stone,
dicas</u>](https://conteudo.stone.com.br/controle-de-estoque-de-restaurante-dicas-e-melhores-praticas/)).
Quem quiser controlar o consumo de botijões pode cadastrá-lo como item
de consumo, fora do CMV. No chope, a referência disponível é americana:
o rendimento real de um barril fica entre 85% e 95% do teórico, com
perdas por espuma, limpeza de linha e excesso no serviço
([<u>PourIQ</u>](https://pouriq-website-drew.pages.dev/glossary/draft-yield/)).
Não há equivalente brasileiro publicado em litros e tulipas.

# 2. O cadastro do item é o alicerce de custo, compra e segurança sanitária

Um cadastro completo de insumo tem quatro blocos: **identificação**,
**unidades e conversões**, **parâmetros de reposição e conservação** e
**custo e fiscal**. A UFPR recomenda uma descrição padronizada em quatro
partes (nome básico, modificador, especificação técnica e referência do
fornecedor) e um código que indique grupo, subgrupo e número, para
evitar duplicidades e compras de itens "parecidos, mas inadequados"
([<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)).
O manual do PDV Legal mostra como isso aparece num sistema brasileiro de
food service. O cadastro traz grupo, categoria financeira, unidades de
venda, estoque e compra com fator de conversão, EAN, tipo de baixa
("baixa ele mesmo", "baixa composição", "estocável"), local, dias de
validade, NCM e CEST, último custo, estoques mínimo e máximo e controle
de validade com dias de alerta ([<u>PDV
Legal</u>](https://ajuda.pdvlegal.com.br/retaguarda/produtos/cadastro-de-produtos.md)).

O ponto técnico mais sensível são as **três unidades**. Uma é a de
compra (saco de 50 kg), outra a de estoque e contagem (kg), e a terceira
a de receita (g). Sem as conversões, o sistema não consegue traduzir o
saco comprado nos gramas da ficha técnica
([<u>Mosaic</u>](https://support.mosaic-solutions.com/knowledge/guide-to-stock-recipe-and-purchasing-unit-conversions)).
O fator de conversão é o número de unidades de estoque contidas em uma
unidade de compra: caixa com 12 tem fator 12, e 20 caixas viram 240
unidades. A Alterdata alerta que **mudar a unidade de um item já em uso
pode afetar o SPED**
([<u>Alterdata</u>](https://ajuda.alterdata.com.br/x/cwH0Ag)). Na
entrada por XML de NF-e, cada item da nota precisa de um "de-para" com o
insumo interno e da conversão de unidade, por exemplo 2 caixas × 12 = 24
unidades
([<u>Suitable</u>](https://intercom.help/suitableapp/pt-BR/articles/12131928-entrada-de-produtos-insumos-no-estoque)).
Por isso o fator deve ficar no **vínculo item-fornecedor**, e não só no
item: fornecedores diferentes vendem embalagens diferentes.

| **Campo do cadastro**                                                                  | **Exemplo**                                     | **Por que importa**                                                                                                                                                       |
|----------------------------------------------------------------------------------------|-------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Código interno único e imutável                                                        | 01.03.0045                                      | Evita duplicidade e sustenta todo o histórico ([<u>Compeat</u>](https://cloud.compeat.com/CompeatBackOffice/Help/Inventory/Master_Inventory_Items.htm))                   |
| Descrição padronizada                                                                  | "Tomate italiano, caixa 20 kg, tipo AA"         | Impede compra de item semelhante, mas errado ([<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/resumos/resumo_aula_04.pdf))                                               |
| EAN/GTIN da unidade e da embalagem                                                     | 789… / "SEM GTIN"                               | Leitura por coletor e conferência de nota                                                                                                                                 |
| Tipo                                                                                   | insumo, revenda, produzido, consumo, patrimônio | Define a regra de baixa (pela ficha técnica, direta ou nenhuma) e a contabilização                                                                                        |
| Grupo, subgrupo e categoria financeira                                                 | Proteínas \> Bovinos; conta "CMV alimentos"     | CMV por grupo e ligação com o DRE                                                                                                                                         |
| Unidades de compra, estoque e receita, com fatores                                     | caixa 12 un. → un. → g                          | Converte nota, contagem e receita                                                                                                                                         |
| Apresentação e peso líquido/drenado                                                    | lata 2,8 kg; drenado 1,7 kg                     | Custo real por kg                                                                                                                                                         |
| Peso variável (*catch weight*)                                                         | carnes, peixes                                  | Recebe pelo peso real, não pelo rótulo                                                                                                                                    |
| FC padrão e rendimento                                                                 | 1,25                                            | Custo do kg limpo e compra pelo peso bruto                                                                                                                                |
| Último custo, custo médio ponderado, data de atualização                               | R\$ 23,33/un.                                   | Valoração do estoque e alerta de reajuste                                                                                                                                 |
| Tolerância de variação de custo no recebimento                                         | ±5%                                             | Detecta cobrança acima do combinado ([<u>Compeat</u>](https://cloud.compeat.com/CompeatBackOffice/Help/Inventory/Restaurant_Inventory_Items.htm))                         |
| Estoque de segurança, ponto de pedido, par/máximo, lead time, dias entre entregas      | ver seção 6                                     | Gera o pedido sugerido                                                                                                                                                    |
| Fornecedores (preferencial e alternativos), com código, unidade e preço por fornecedor | –                                               | De-para do XML e cotação ([<u>Fourth</u>](https://help.hotschedules.com/hc/en-us/articles/360055940652-Inventory-Restaurants-Ingredient-and-Recipe-Fields-for-Inventory)) |
| Locais (padrão e alternativos) e posição na folha de contagem                          | Câmara 1, prateleira B                          | Contagem "da prateleira para a planilha"                                                                                                                                  |
| Temperatura de conservação e faixa de recebimento                                      | ≤ 4 °C; recebe entre 4 e 7 °C                   | Aceite ou recusa na doca                                                                                                                                                  |
| Validade fechado e após aberto; controle de lote; dias de alerta                       | 3 dias após aberto                              | PVPS, etiqueta e rastreio                                                                                                                                                 |
| Alérgenos (lista da RDC 26/2015)                                                       | leite, trigo, castanhas                         | São herdados pela ficha técnica ([<u>RDC 26/2015</u>](https://saude.campinas.sp.gov.br/saude/lista_legislacoes/legis_2015/U_RS-MS-ANVISA-RDC-26_020715.pdf))              |
| NCM, CEST, origem, grupo tributário (CST/CSOSN)                                        | 2202.10.00                                      | Erro de NCM gera multa de 1% do valor ([<u>Saipos, NCM</u>](https://saipos.com/ncm/tabela-ncm-2018)); valide com o contador                                               |
| Curva ABC/XYZ                                                                          | A                                               | **Calculada** pelo consumo, nunca digitada                                                                                                                                |
| Flags: ativo, inventariável, frequência de contagem                                    | contar diariamente                              | Monta as folhas de contagem por ciclo                                                                                                                                     |

Os sistemas brasileiros usam tanto o **último custo** (PDV Legal) quanto
o **custo médio** (Saipos). O custo médio ponderado é (valor anterior +
valor da compra) ÷ (quantidade anterior + quantidade comprada). Por
exemplo, 10 un. a R\$ 20 mais 20 un. a R\$ 25 dão R\$ 23,33. É um método
aceito pela legislação brasileira; o UEPS não é
([<u>Omie</u>](https://www.omie.com.br/blog/custo-medio-ponderado-como-funciona-essa-administracao-de-estoques/index.md)).
A recomendação deste manual é **valorar o estoque pelo custo médio** e
manter o último custo visível para negociação. A Saipos destaca que o
último preço pago cria histórico e argumento de negociação
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/cadastro-de-produtos)).

# 3. Fornecedores, fichas técnicas e locais completam os dados mestres

## Fornecedor é requisito sanitário, não só comercial

A RDC 216/2004 (item 4.7.1) obriga o serviço de alimentação a
**especificar critérios de avaliação e seleção de fornecedores** de
matérias-primas, ingredientes e embalagens ([<u>Anvisa RDC
216</u>](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html)).
A CVS 3/2026 paulista vai além e passa a exigir critérios formais que
incluem a licença sanitária
([<u>ANR</u>](https://anrbrasil.org.br/nova-portaria-cvs-no3-de-03-07-2026-boas-praticas-pra-estabelecimentos-comerciais-de-alimentos-e-servicos-de-alimentacao-novo-prazo-fev-2007/)).
Os critérios comerciais citados são preço, prazo, credibilidade,
qualidade, conformidade fiscal (CNPJ e situação na Receita), capacidade
de entrega e atendimento ([<u>Conta
Azul</u>](https://contaazul.com/blog/avaliacao-de-fornecedores/)). A
Saipos recomenda **cotar com no mínimo três atacadistas** da região
antes de cada pedido ([<u>Saipos,
fornecedores</u>](https://saipos.com/gestao/controle-de-estoque/fornecedores-para-restaurantes)).
Nenhuma fonte brasileira trouxe um modelo de pontuação com pesos, então
os indicadores abaixo são uma proposta.

| **Bloco do cadastro de fornecedor** | **Campos**                                                                                                                                                                                                                                                                        |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Legal e fiscal                      | Razão social, fantasia, CNPJ, IE, situação cadastral, regime tributário                                                                                                                                                                                                           |
| Contato e canal                     | Vendedor, financeiro, SAC; WhatsApp, portal ou EDI                                                                                                                                                                                                                                |
| Sanitário                           | Licença sanitária; SIF/SIE/SIM para produtos de origem animal (o guia Sebrae/Abrasel manda conferir esses selos no recebimento ([<u>Sebrae/Abrasel</u>](https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/cb4460b653b2600c58a378f38f92ef7a/$File/5837.pdf))) |
| Logística                           | Categorias atendidas, dias e janela de entrega, lead time, pedido mínimo (ex.: R\$ 300 com entrega em 24 h), frete                                                                                                                                                                |
| Financeiro                          | Formas e prazos de pagamento, PIX e dados bancários                                                                                                                                                                                                                               |
| Itens fornecidos                    | Código do fornecedor, embalagem, unidade, fator, preço vigente, última compra, preferencial (sim/não)                                                                                                                                                                             |
| Desempenho                          | % de entregas no prazo, % de não conformidades e devoluções, variação de preço, nota de atendimento                                                                                                                                                                               |
| Status                              | Homologado, em avaliação ou bloqueado; substitutos                                                                                                                                                                                                                                |

## A ficha técnica liga estoque, custo e venda

A ficha técnica é o primeiro passo do controle de estoque
([<u>Pluxee</u>](https://www.pluxee.com.br/blog/controle-de-estoque-para-restaurantes/)):
sem ela não existe baixa automática nem CMV teórico. Três índices
sustentam a ficha. O **fator de correção (FC) = peso bruto ÷ peso
líquido** mede a perda no pré-preparo e serve para comprar. O **índice
de cocção (IC) = peso cozido ÷ peso líquido cru** controla o processo
([<u>UFPR, aula
01</u>](https://docs.ufpr.br/~monica.anjos/resumos/resumo_aula_01.pdf)).
O **índice de rendimento (IR)** compara o peso da preparação pronta com
a soma dos pesos líquidos
([<u>Demetra</u>](https://www.e-publicacoes.uerj.br/demetra/article/download/3597/4355/22135)).
Na prática: se 10 kg brutos rendem 8 kg limpos, o FC é 1,25. Para obter
8 kg limpos é preciso comprar 10 kg, e o custo do kg limpo é o preço do
kg bruto × 1,25.

O FC **precisa ser medido na própria cozinha**. Em uma UAN de Aracaju,
os valores medidos ficaram longe das tabelas de referência
([<u>Estácio/Ciência in
Cena</u>](https://estacio.periodicoscientificos.com.br/index.php/cienciaincenabahia/article/download/13/9/27)):

| **Hortaliça**  | **FC medido (Aracaju)** | **FC de referência (Ornellas)** |
|----------------|-------------------------|---------------------------------|
| Alface lisa    | 2,04                    | 1,31                            |
| Rúcula         | 2,30                    | 1,57                            |
| Batata inglesa | 1,29                    | 1,06                            |
| Tomate         | 1,08                    | 1,61                            |
| Cebola branca  | 1,04                    | 1,53                            |

Em três restaurantes por quilo, o IR do arroz variou de 1,69 a 2,32, e o
do frango grelhado de 0,49 a 0,63
([<u>Demetra</u>](https://www.e-publicacoes.uerj.br/demetra/article/download/3597/4355/22135)).
Em um restaurante português, as perdas médias de pré-preparo foram de
32% em frutas, 26% em hortaliças e 18% em carnes ([<u>Silvestre &
Silvestre,
2026</u>](https://revistas.rcaap.pt/thij/article/view/47934)). Usar FC
de tabela distorce o custo e o preço do cardápio.

| **Parte da ficha técnica** | **Campos**                                                                                                                                                                                                                                             |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Cabeçalho                  | Código, nome, categoria do cardápio, tipo (prato final ou sub-receita), rendimento total, nº e peso das porções, IC, validade e conservação (para sub-receitas), equipamentos, tempos, responsável, versão e data                                      |
| Linhas                     | Insumo ou sub-receita, quantidade líquida, unidade de receita, FC, quantidade bruta (= líquida × FC), custo unitário, custo da linha. Incluir água, óleo e temperos ([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/produtos-acabados)) |
| Rodapé                     | Custo total e por porção, embalagem (delivery), preço de venda, % de CMV, markup, modo de preparo, foto, alérgenos herdados e, opcionalmente, informação nutricional                                                                                   |

O escopo de fichas técnicas do Sebraetec inclui peso bruto, fator de
perda, peso líquido, tempos, valor por ingrediente e total, rendimento,
foto do prato servido e lista de fornecedores
([<u>Sebraetec</u>](https://datasebrae.com.br/wp-content/uploads/2025/06/Elaboracao-de-Cardapio-e-ou-fichas-tecnicas-para-segmentos-de-alimentacao-MMP14062-9.pdf)).
Atualize a ficha **sempre que mudar o preço de um insumo principal**
([<u>Ledware</u>](https://www.ledware.com.br/2026/05/21/cmv-restaurante-ficha-tecnica-2026-guia/)).
Cadastre as **sub-receitas** (molho de tomate, fundo, massa, hambúrguer
porcionado) como itens produzidos com rendimento próprio. Assim a ordem
de produção baixa os ingredientes crus e dá entrada na sub-receita, e a
venda baixa a sub-receita, sem baixa dupla. A Fourth exige o peso cozido
e o tamanho da porção nas receitas de lote
([<u>Fourth</u>](https://help.hotschedules.com/hc/en-us/articles/360055940652-Inventory-Restaurants-Ingredient-and-Recipe-Fields-for-Inventory)).
A Teknisa registra a transformação de um produto principal em vários
derivados, com rateio de custo. É o modelo para desossa e porcionamento:
peça inteira → cortes, aparas e perda
([<u>Teknisa</u>](https://universidade.teknisa.com/wp-content/uploads/2025/04/06_MANUAL_ESTOQUE-WEB_PRODUTOS-PROCESSADOS_v2.pdf)).

## Locais devem ter o nome do espaço físico real

No Restaurant365, cada local recebe o nome que a equipe usa (câmara,
estoque do bar, depósito dos fundos), e a folha de contagem segue a
ordem das prateleiras
([<u>Restaurant365</u>](https://docs.restaurant365.com/docs/set-up-storage-locations)).
A Compeat permite vários locais por item, com local padrão e posição na
folha
([<u>Compeat</u>](https://cloud.compeat.com/CompeatBackOffice/Help/Inventory/Restaurant_Inventory_Items.htm)).
Locais recomendados para cadastro:

| **Local**                                          | **Função**                                                              | **Atributos**                                                                                               |
|----------------------------------------------------|-------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Recebimento / quarentena                           | Itens em conferência e reprovados aguardando devolução (RDC 216, 4.7.4) | Identificado e segregado                                                                                    |
| Almoxarifado ou despensa seca                      | Secos, enlatados, bebidas não refrigeradas                              | Ventilado, sem sol direto, telado                                                                           |
| Câmara ou geladeira de carnes                      | Proteínas cruas                                                         | Temperatura-alvo, termômetro externo                                                                        |
| Câmara ou geladeira de hortifrúti e laticínios     | FLV, laticínios, ovos                                                   | Temperatura-alvo                                                                                            |
| Freezer ou câmara de congelados                    | Congelados                                                              | ≤ -18 °C                                                                                                    |
| Geladeiras de praça (quente, fria, confeitaria)    | Estoque de uso do turno                                                 | Só faz sentido se houver requisição registrada                                                              |
| Bar (adega, geladeira, chopeira)                   | Bebidas                                                                 | Separado do estoque da cozinha ([<u>Cuboh</u>](https://www.cuboh.com/blog/restaurant-inventory-categories)) |
| Armário de limpeza e químicos                      | Saneantes                                                               | Exclusivo, fora da área de alimentos                                                                        |
| Depósito de descartáveis e embalagens              | Não alimentares                                                         | –                                                                                                           |
| Redes: cozinha central, cada filial, "em trânsito" | Transferências                                                          | Status da transferência                                                                                     |

Cada local deve ter um responsável, uma faixa de temperatura (os
refrigerados) e uma ordem de contagem.

# 4. Treze tipos de movimentação explicam para onde foi cada grama

Separar as saídas é o que torna o estoque gerencial. Se tudo que sai
vira "consumo", a diferença entre o teórico (vendas × fichas) e o real
(EI + compras − EF) vira uma caixa-preta, e fica impossível distinguir
erro de ficha, desperdício e furto. A Saipos recomenda registrar toda
entrada e saída **com o motivo**
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/produtos-acabados)).
A planilha de CMV real da Stone traz campos próprios para **desperdício,
consumo interno e cortesias**
([<u>Stone</u>](https://conteudo.stone.com.br/material/planilha-calculo-de-cmv-real-food-service/)).
A Altametrics distingue *waste* (perda conhecida e registrada) de
*variance* (diferença não explicada) e propõe três famílias de motivo:
perda de preparo, deterioração e erro operacional
([<u>Altametrics</u>](https://altametrics.com/blog/a-practical-waste-and-variance-tracking-system-for-restaurants.html)).

| **\#** | **Movimentação**                                                  | **Documento / referência**                                                                                        | **Dados específicos**                                                                                                                                                                           |
|--------|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | Entrada por compra                                                | NF-e (chave/XML), pedido de compra                                                                                | Lote, validade, temperatura medida, conferente                                                                                                                                                  |
| 2      | Entrada por bonificação ou troca                                  | Nota ou observação                                                                                                | Custo zero ou de reposição                                                                                                                                                                      |
| 3      | Devolução ao fornecedor                                           | NF de devolução, ficha de devolução ([<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)) | Motivo: temperatura, validade, avaria, fora do padrão                                                                                                                                           |
| 4      | Requisição ou transferência interna (almoxarifado → praça ou bar) | Requisição                                                                                                        | Solicitante, aprovador, origem e destino                                                                                                                                                        |
| 5      | Transferência entre unidades ou cozinha central                   | Guia de transferência e NF quando houver                                                                          | Status: solicitada → expedida → em trânsito → recebida; divergência ([<u>Restaurant Revolution</u>](https://restaurant-revolution-docs-dev.pages.dev/owner/multi-location/inventory-transfers)) |
| 6      | Produção (baixa dos ingredientes e entrada da sub-receita)        | Ordem de produção                                                                                                 | Rendimento previsto × real, lote interno, validade da etiqueta                                                                                                                                  |
| 7      | Venda com ficha técnica                                           | Pedido ou cupom do PDV                                                                                            | Baixa teórica, incluindo adicionais e retiradas ([<u>Supy</u>](https://supy.io/blog/learn-theoretical-vs-actual-food-cost-variance))                                                            |
| 8      | Venda de item de revenda                                          | Cupom                                                                                                             | Baixa direta                                                                                                                                                                                    |
| 9      | Perda ou quebra                                                   | Registro de perda; NF CFOP 5.927 quando exigida                                                                   | Motivo, responsável, turno                                                                                                                                                                      |
| 10     | Consumo interno / refeição de funcionários                        | Lançamento no PDV                                                                                                 | Quem consumiu                                                                                                                                                                                   |
| 11     | Cortesia                                                          | Mesa ou pedido                                                                                                    | Quem autorizou                                                                                                                                                                                  |
| 12     | Degustação, marketing ou doação                                   | Registro                                                                                                          | Finalidade                                                                                                                                                                                      |
| 13     | Ajuste de inventário (sobra ou falta)                             | Contagem de referência                                                                                            | Justificativa e aprovador                                                                                                                                                                       |

**Campos mínimos de todo registro:** ID; tipo; data e hora do fato e do
lançamento; usuário que lançou e que aprovou; item; quantidade e
unidade, convertidas para a unidade de estoque; lote e validade, quando
controlados; custo unitário e total no momento; local de origem e
destino; **motivo em lista fechada** com campo de observação; documento
de referência; centro de custo. Motivos em texto livre não geram
indicadores. Para o registro de desperdício, Restaurant365 e Altametrics
pedem que seja feito na hora: o quê, quanto, por quê e quem
([<u>Restaurant365</u>](https://restaurant365.com/?p=39638)).

# 5. A RDC 216 obriga em todo o país; a CVS paulista fornece os números

## Qual norma vale para um restaurante em Santa Catarina

| **Norma**                                       | **Abrangência**                           | **Status em out/2026**                                                                                                                                                                                                                                                                                                                                                                | **O que traz para o estoque**                                                                                             |
|-------------------------------------------------|-------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| RDC Anvisa 216/2004 (alterada pela RDC 52/2014) | Nacional, serviços de alimentação         | Vigente; revisão na Agenda Regulatória 2024-2025, tema 3.2, sem norma nova publicada ([<u>Anvisa</u>](https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2024-2025/arquivos/lista-resumida-ar-24_25_portal.pdf))                                                                                                                                       | Princípios: recebimento inspecionado, estrados, saneantes separados, ≤ -18 °C e \< 5 °C, etiquetas, Manual de BP e 4 POPs |
| RN 003/DIVS/2010 (SC)                           | Lista de verificação de BP de SC          | Citada na literatura; a vigência não foi confirmada ([<u>Redalyc</u>](https://www.redalyc.org/pdf/5705/570561428015.pdf))                                                                                                                                                                                                                                                             | Mais restritiva para preparados: refrigerado ≤ 4 °C, congelado ≤ -18 °C                                                   |
| RN 01/DIVS/SUV/SES/2025 (SC)                    | Classificação de risco para licenciamento | Vigente ([<u>Joinville</u>](https://www.joinville.sc.gov.br/wp-content/uploads/2025/10/Resolucao-Normativa-n°-01DIVSSUVSES-01outubro2025.pdf))                                                                                                                                                                                                                                        | Não traz regras técnicas de armazenamento                                                                                 |
| Portaria CVS 5/2013 (SP)                        | Estado de SP                              | Vigente em SP até 31/01/2027                                                                                                                                                                                                                                                                                                                                                          | Tabelas de temperatura e validade, POP de recebimento                                                                     |
| Portaria CVS 3/2026 (SP)                        | Estado de SP; substitui a CVS 5           | Publicada em 06/07/2026; vigência adiada pela CVS 9/2026 para **01/02/2027** ([<u>CRN-3</u>](https://www.crn3.org.br/noticia/crn-3-destaca-conquista-com-prorrogacao-da-portaria-cvs-no-32026); [<u>ANR</u>](https://anrbrasil.org.br/nova-portaria-cvs-no3-de-03-07-2026-boas-praticas-pra-estabelecimentos-comerciais-de-alimentos-e-servicos-de-alimentacao-novo-prazo-fev-2007/)) | Primeira a fixar **10 cm das paredes e 60 cm do forro**; registro de temperatura 2×/dia; guarda de registros por 180 dias |

**Divergência sobre datas:** Prefeitura de Atibaia e Estado de Minas
noticiaram que a CVS 3/2026 entraria em vigor em 04/10/2026, mas esses
textos são anteriores ao adiamento pela CVS 9/2026
([<u>Atibaia</u>](https://www.atibaia.sp.gov.br/noticias/saude/nova-norma-estadual-atualiza-regras-para-servicos-de-alimentacao-em-sao-paulo)).
A própria página da ANR tem uma tabela que dá a CVS 5 como válida até
30/10/2026, o que contradiz o texto da mesma página. Este manual adota
**01/02/2027**, data confirmada por CRN-3, ANR e consultorias. O texto
oficial da CVS 9/2026 não foi lido. Para SC, a leitura prática é esta: a
RDC 216 é a norma que obriga, e os números paulistas são a melhor
referência técnica para preencher o que ela deixa em aberto. A RDC 216
manda apenas "verificar a temperatura" e manter "espaçamento que garanta
ventilação e limpeza". Confirme com a Vigilância Sanitária do seu
município as exigências da lista de verificação local.

## Temperaturas de recebimento

| **Categoria**                                                   | **Aceitar até (CVS 5/2013 art. 24 e CVS 3/2026 art. 30)**         | **Referência Unilever Food Solutions** |
|-----------------------------------------------------------------|-------------------------------------------------------------------|----------------------------------------|
| Congelados                                                      | ≤ -12 °C, ou conforme o fabricante, sem sinais de descongelamento | ≤ -12 °C                               |
| Pescados refrigerados                                           | 2 a 3 °C                                                          | ≤ 3 °C                                 |
| Preparações com carne ou pescado crus (só na CVS 3)             | 0 a 5 °C                                                          | –                                      |
| Carnes refrigeradas                                             | 4 a 7 °C                                                          | ≤ 7 °C                                 |
| Demais refrigerados (laticínios, ovos, FLV higienizado, polpas) | 4 a 10 °C                                                         | ≤ 10 °C                                |
| Prontos refrigerados                                            | –                                                                 | ≤ 5 °C                                 |
| Produtos quentes                                                | \> 60 °C (CVS 3)                                                  | ≥ 60 °C                                |

Fontes: [<u>CVS
5/2013</u>](https://www.normasbrasil.com.br/norma/portaria-5-2013-sp_253536.html);
[<u>CVS
3/2026</u>](https://cmscientifica.com.br/wp-content/uploads/2026/07/portaria-cvs-3-de-julho-de-2026-20260708.pdf);
[<u>Unilever Food
Solutions</u>](https://www.unileverfoodsolutions.com.br/dam/global-ufs/mcos/sla/brazil/mstb/food-safety/downaloads/Tabela%20temperatura%20recebimento.pdf).

## Temperaturas e prazos de armazenamento (quando o fabricante não define outro)

Pela norma federal, congelados ficam a **≤ -18 °C** e refrigerados
**abaixo de 5 °C**. Alimento preparado mantido a ≤ 4 °C deve ser
consumido em até **5 dias**, e entre 4 e 5 °C o prazo deve ser menor
([<u>RDC
216</u>](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html)).
A tabela paulista detalha por categoria e é mais conservadora (3 dias
para preparados):

| **Produto**                                            | **Temp. máx.** | **Validade** | **Observação**                            |
|--------------------------------------------------------|----------------|--------------|-------------------------------------------|
| Pescados crus e manipulados crus                       | 2 °C           | 3 dias       | Igual na CVS 3                            |
| Pescados cozidos                                       | 2 °C           | 1 dia        | Igual                                     |
| Carnes cruas (bovina, suína, aves) e preparações       | 4 °C           | 3 dias       | Igual                                     |
| Espetinhos, bife rolê, empanados crus, carne moída     | 4 °C           | 2 dias       | Igual                                     |
| Frios e embutidos fatiados ou moídos                   | 4 °C           | 3 dias       | Igual                                     |
| Alimentos cozidos (exceto pescado) e demais preparados | 4 °C           | 3 dias       | Igual                                     |
| Maionese e misturas com maionese                       | 4 °C           | 2 dias       | Igual                                     |
| Sobremesas e preparações com laticínios                | 4 °C           | 3 dias       | Igual                                     |
| Confeitaria com recheio ou cobertura                   | 5 °C           | 5 dias       | **CVS 3 passa para 4 °C / 3 dias**        |
| FLV higienizado, cortado ou descascado; sucos e polpas | 5 °C           | 3 dias       | Igual                                     |
| Leite e derivados                                      | 7 °C           | 5 dias       | Não aparece na tabela da CVS 3 consultada |
| Ovos                                                   | 10 °C          | 7 dias       | Não aparece na tabela da CVS 3 consultada |

| **Congelado sem indicação do fabricante** | **Validade** |
|-------------------------------------------|--------------|
| 0 a -5 °C                                 | 10 dias      |
| -6 a -10 °C                               | 20 dias      |
| -11 a -18 °C                              | 30 dias      |
| Abaixo de -18 °C                          | 90 dias      |

Fontes: [<u>CVS
5/2013</u>](https://www.normasbrasil.com.br/norma/portaria-5-2013-sp_253536.html);
[<u>CVS
3/2026</u>](https://cmscientifica.com.br/wp-content/uploads/2026/07/portaria-cvs-3-de-julho-de-2026-20260708.pdf);
[<u>VittaCheck</u>](https://vittacheck.com/guias/cvs-3-2026-o-que-muda-cvs-5-2013).
A Saipos usa uma faixa genérica de refrigeração de 0 °C a 5 °C
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/como-organizar-um-estoque-de-restaurante)).
Este manual adota a regra federal (\< 5 °C, idealmente ≤ 4 °C, como
exige a lista de SC para preparados) e usa a tabela acima para
equipamentos dedicados.

**Regras de processo que afetam o estoque.** O descongelamento é feito
sob refrigeração abaixo de 5 °C, ou em micro-ondas quando a cocção é
imediata, e o produto descongelado não pode ser recongelado ([<u>RDC
216</u>](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html)).
A CVS 3 exige etiqueta com a data de início do descongelamento. O
resfriamento de preparados vai de 60 °C a 10 °C em até 2 h. A
conservação a quente é a mais de 60 °C por no máximo 6 h. A cocção
atinge pelo menos 70 °C no centro pela RDC 216, e 74 ou 75 °C pela CVS
3. As fontes divergem sobre o número exato da CVS 3, e este manual adota
75 °C como margem segura. Por fim, a CVS 3 proíbe **revalidar ou
estender validade** ([<u>CVS
3/2026</u>](https://cmscientifica.com.br/wp-content/uploads/2026/07/portaria-cvs-3-de-julho-de-2026-20260708.pdf)).

## Etiquetagem: o que a etiqueta precisa ter

A RDC 216 (4.8.6) exige que todo insumo aberto e não usado por inteiro
seja identificado com **designação, data de fracionamento e validade
após a abertura**. O alimento preparado leva designação, data de preparo
e validade (4.8.18 e 4.9.1). A CVS 3/2026 (arts. 37 a 39) acrescenta,
para produto transferido de embalagem, fornecedor ou fabricante, marca e
modo de conservação. Também proíbe guardar alimentos em sacolas de
supermercado ou sacos de lixo. Nenhuma norma traz uma tabela de
"validade após aberto" por produto: vale a indicação do fabricante, e,
na falta dela, o prazo definido no Manual de Boas Práticas, tendo a
tabela acima como teto.

| **Campo da etiqueta padrão**                                | **Exigido por**                                                                                                     |
|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| Nome do produto e marca                                     | RDC 216 (designação); CVS 3 (marca)                                                                                 |
| Fornecedor ou fabricante                                    | CVS 5 art. 30 / CVS 3 art. 37                                                                                       |
| Modo de conservação (temperatura)                           | CVS 5 / CVS 3                                                                                                       |
| Data de abertura, fracionamento, preparo ou descongelamento | RDC 216; CVS 3 art. 53                                                                                              |
| Validade após abertura ou preparo                           | RDC 216                                                                                                             |
| Responsável                                                 | Boa prática; não confirmado como obrigatório                                                                        |
| Lote, quando houver rastreio                                | Opcional ([<u>Stone</u>](https://conteudo.stone.com.br/como-organizar-o-estoque-de-um-restaurante-com-eficiencia/)) |

## Organização física: checklist de conformidade

> ☐ Recebimento em área protegida de chuva, sol e poeira; mercadoria
> nunca deixada no piso ou no pátio além do tempo da inspeção (RDC 216
> 4.7.2; CVS 3 arts. 26 e 32).
>
> ☐ Ordem de conferência e guarda: resfriados de origem animal primeiro,
> depois congelados, hortifrúti e, por último, secos
> ([<u>Sebrae/Abrasel</u>](https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/cb4460b653b2600c58a378f38f92ef7a/$File/5837.pdf)).
>
> ☐ Recusar embalagens amassadas, estufadas, enferrujadas, trincadas,
> furadas, vazando ou abertas, e limpar as embalagens antes de abrir
> ([<u>Anvisa,
> cartilha</u>](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/alimentos/cartilha-boas-praticas-para-servicos-de-alimentacao.pdf/@@display-file/file)).
>
> ☐ Nada em contato com o piso; estrados e prateleiras lisos,
> impermeáveis e laváveis (RDC 216 4.7.6), adotando **10 cm das paredes
> e 60 cm do forro** como referência (obrigatório em SP a partir de
> 01/02/2027).
>
> ☐ Estoque seco limpo, ventilado, sem sol direto, isolado do exterior e
> com **telas milimétricas** em portas, janelas e exaustores ([<u>lista
> SC</u>](https://atalanta.sc.gov.br/uploads/sites/311/2023/03/547872_RDC_275_1.doc)).
>
> ☐ **PVPS** (primeiro que vence, primeiro que sai), e PEPS para itens
> sem validade (CVS 3 art. 33 VIII; RDC 216 4.7.5). O que vence antes
> fica na frente, e os itens de maior giro, perto da saída.
>
> ☐ Em equipamento compartilhado: **prontos em cima, pré-preparados no
> meio, crus embaixo**, com o equipamento regulado pelo item mais
> exigente. Nada sob condensadores ou evaporadores (CVS 5 art. 31; CVS 3
> arts. 40 e 42).
>
> ☐ Saneantes em local exclusivo, fora das áreas de alimentos (RDC 216
> 4.2.5; CVS 3 art. 117).
>
> ☐ Caixas de madeira proibidas, salvo as exceções de pescado seco e
> salgado e de hortifrúti. Papelão retirado ou coberto com plástico
> transparente, e nunca dentro da área de preparo (CVS 3 arts. 34, 35 e
> 49).
>
> ☐ Vencidos e reprovados identificados e segregados fora da área de
> manipulação, até a devolução ou o descarte (RDC 216 4.7.4).
>
> ☐ Câmara fria com termômetro calibrado de visor externo, interruptor
> externo, abertura interna da porta e prateleiras laváveis (CVS 5 art.
> 84; CVS 3 art. 152).
>
> ☐ Proibido desligar equipamentos para economizar energia, usar
> termômetro de vidro e deixar gelo acumular (CVS 3 art. 43).

## Registros sanitários obrigatórios

| **Registro**                                                                                                                        | **Base**                                                                                                                                                             | **Frequência ou guarda**       |
|-------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|
| Manual de Boas Práticas e POPs                                                                                                      | RDC 216 4.11: 4 POPs (higienização, pragas, reservatório, saúde dos manipuladores). CVS 5: 7 POPs; CVS 3: 9 POPs, incluindo **controle de qualidade no recebimento** | Atualizados e acessíveis       |
| Planilha de recebimento (data, fornecedor, NF, produto, temperatura, embalagem, veículo, validade, aceito ou recusado, responsável) | CVS 5 art. 24; RDC 216 4.7.3                                                                                                                                         | Cada entrega                   |
| Planilha de temperatura de cada geladeira, câmara e freezer                                                                         | RDC 216 4.10.3 ("regular"); CVS 3 art. 48                                                                                                                            | **Pelo menos 2 vezes por dia** |
| Não conformidades e devoluções                                                                                                      | RDC 216 4.7.4                                                                                                                                                        | Cada ocorrência                |
| Comprovante do controle de pragas por empresa licenciada                                                                            | RDC 216 4.3; CVS 3 arts. 134-135                                                                                                                                     | Cada serviço                   |
| Limpeza do estoque e das câmaras; troca de filtros da climatização                                                                  | RDC 216 4.1.11                                                                                                                                                       | Conforme o POP                 |
| Calibração de termômetros e balanças                                                                                                | Sebrae/Abrasel; CVS 3 (POP de manutenção)                                                                                                                            | Periódica                      |
| **Guarda dos registros**                                                                                                            | RDC 216: mínimo de 30 dias; CVS 3: mínimo de 180 dias, aceito em meio eletrônico                                                                                     | Adotar **180 dias**            |

Fontes: [<u>RDC
216</u>](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html);
[<u>CVS 3/2026,
LegisWeb</u>](https://www.legisweb.com.br/legislacao/?id=497703). O
controle de acesso ao estoque (chave, responsável único) não aparece
como exigência nas normas sanitárias lidas. Ele é um controle de gestão
(seção 7), mas ajuda na rastreabilidade e no PVPS.

# 6. O ciclo operacional tem doze etapas, da ficha técnica ao ajuste

A sequência que as fontes descrevem, reunidas: (1) ficha técnica com FC
e rendimento; (2) parâmetros de reposição por item; (3) requisição
interna e aprovação; (4) cotação com três ou mais fornecedores e pedido
formal; (5) recebimento com conferência cega, pesagem, temperatura e
validade; (6) entrada da NF-e e armazenagem em PVPS; (7) requisição ou
transferência para as praças; (8) produção registrada; (9) baixa
automática por venda; (10) registro de perdas, consumo interno e
cortesias; (11) contagem; (12) comparação teórico × real e ajuste formal
([<u>Pluxee</u>](https://www.pluxee.com.br/blog/controle-de-estoque-para-restaurantes/);
[<u>BaresSP</u>](https://www.baressp.com.br/noticias/controle-de-estoque-de-restaurante-o-guia-definitivo);
[<u>Supy</u>](https://supy.io/blog/restaurant-requisitions-the-missing-link-in-smarter-procurement)).

## Planejamento: uma definição única para mínimo, ponto de pedido e máximo

As fontes **divergem sobre o que é "estoque mínimo"**. Para a Saipos e a
UFPR, é o consumo durante o tempo de reposição
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/indicadores-de-estoque);
[<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)).
Para a Conta Azul, é sinônimo de estoque de segurança, e o artigo acaba
contando a demanda do lead time duas vezes no ponto de pedido ([<u>Conta
Azul</u>](https://contaazul.com/blog/como-calcular-ponto-de-pedido-e-estoque-de-seguranca/)).
A Saipos ainda define o máximo como mínimo + lote de reposição. Este
manual adota as definições abaixo, coerentes com o modelo de par da
Altametrics
([<u>Altametrics</u>](https://altametrics.com/blog/how-to-set-up-par-levels-in-a-restaurant.html)).
A recomendação para quem configura um sistema é **preencher o campo
"estoque mínimo" com o valor do ponto de pedido**, porque é esse campo
que dispara o alerta de reposição em sistemas como PDV Legal e Saipos.

| **Parâmetro**                                          | **Fórmula adotada**                                                         | **Observação**                                                                                                                                                  |
|--------------------------------------------------------|-----------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Consumo médio diário (CMD)                             | Consumo do período ÷ dias, separando dia útil e fim de semana se necessário | Use as vendas por dia da semana e as datas de pico ([<u>Stone</u>](https://conteudo.stone.com.br/os-10-erros-mais-comuns-na-gestao-de-estoque-de-restaurante/)) |
| Lead time (LT)                                         | Dias entre o pedido e a entrega                                             | No cadastro do fornecedor                                                                                                                                       |
| Ciclo de reposição (C)                                 | Dias entre duas entregas                                                    | Definido pela agenda de pedidos                                                                                                                                 |
| Estoque de segurança (ES)                              | CMD × C × margem de 10% a 25%                                               | Margem maior para itens críticos ou fornecedor instável                                                                                                         |
| **Ponto de pedido (PP)** = "estoque mínimo" no sistema | CMD × LT + ES                                                               | Ao atingir o PP, gerar o pedido                                                                                                                                 |
| **Par / estoque máximo**                               | CMD × C + ES                                                                | Nível desejado logo após a entrega, limitado por espaço, caixa e validade                                                                                       |
| Quantidade a pedir                                     | Par − (saldo atual − CMD × LT) − pedidos em trânsito                        | Converter para a unidade de compra e, se o par for em peso limpo, multiplicar pelo FC                                                                           |

**Exemplo:** filé mignon com CMD de 6 kg, LT de 1 dia, entregas a cada 3
dias e margem de 20%. ES = 6 × 3 × 0,2 = 3,6 kg. PP = 6 × 1 + 3,6 = 9,6
kg. Par = 6 × 3 + 3,6 = 21,6 kg. Ao atingir 9,6 kg, o restaurante pede
21,6 − (9,6 − 6) = **18 kg**. O par pode variar por dia da semana: a
Compeat admite até 7 níveis
([<u>Compeat</u>](https://cloud.compeat.com/CompeatBackOffice/Help/Inventory/Restaurant_Inventory_Items.htm)).
Perecíveis devem ser planejados à parte dos itens de longa duração
([<u>BaresSP</u>](https://www.baressp.com.br/noticias/controle-de-estoque-de-restaurante-o-guia-definitivo)).
Nos estudos de caso, a curva ABC define a política. Em João Pessoa, a
proposta foi compra semanal para os itens A, ponto de pedido para os B
e, nos C, separação entre validade curta (compra semanal) e longa (lote
econômico)
([<u>UFPB</u>](https://repositorio.ufpb.br/jspui/bitstream/123456789/3976/1/GASL17042018.pdf)).

## Cotação, requisição e pedido

O fluxo recomendado é **requisição → aprovação → pedido**. Chef ou
gerente abre a requisição, compras ou financeiro aprova dentro de
alçadas por valor, e só então ela vira pedido ao fornecedor. Redes usam
um horário de corte diário para consolidar pedidos e eliminar
duplicidades
([<u>Supy</u>](https://supy.io/blog/restaurant-requisitions-the-missing-link-in-smarter-procurement)).
Um blog de software estima que compras emergenciais saem cerca de **20%
mais caras**, mas o dado não tem metodologia informada
([<u>Ledware</u>](https://www.ledware.com.br/2026/05/21/cmv-restaurante-ficha-tecnica-2026-guia/)).
Cotações periódicas evitam depender de um único fornecedor acima do
preço de mercado ([<u>Central do
Varejo</u>](https://centraldovarejo.com.br/?p=45839)).

## Recebimento: conferência cega e cruzamento pedido × NF × físico

Na **conferência cega**, quem recebe registra as quantidades sem ver a
NF nem o pedido, e uma segunda pessoa compara com a nota. Havendo
divergência, faz-se recontagem e aciona-se o comprador. Em empresas
pequenas, quem recebe pode conferir, mas a NF passa pelo administrativo
antes da entrada
([<u>Qive</u>](https://qive.com.br/blog/conferencia-cega)). A sequência
internacional detalhada tem sete passos. Primeiro, conferir linha a
linha contra o pedido. Depois, cruzar físico, NF e pedido (falta, preço
acima do combinado, avaria, temperatura, item errado). Em seguida,
**pesar tudo o que é vendido por peso**, porque uma caixa "de 40 kg"
pode pesar 36 kg. Na sequência, medir a temperatura, registrar as
divergências **com o entregador presente** e classificá-las (crédito
emitido, disputado). Só então fechar o recebimento. A meta é manter a
divergência não resolvida **abaixo de 1% das compras**
([<u>Supy</u>](https://supy.io/ar/blog/learn-restaurant-food-receiving-procedure)).
Itens recusados vão para a ficha de devolução e o local de quarentena.

## Armazenagem, requisição às praças e produção

Depois da guarda (seção 5), toda retirada do almoxarifado para cozinha
ou bar é registrada com item, data, quantidade, valor e motivo
([<u>BaresSP</u>](https://www.baressp.com.br/noticias/controle-de-estoque-de-restaurante-o-guia-definitivo)).
A requisição à despensa reduz desperdício e furto e permite analisar o
consumo
([<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)).
A produção de sub-receitas gera uma ordem de produção que baixa os
insumos e dá entrada no produto, com rendimento real e etiqueta de
validade. Na cozinha central, **transferência não registrada faz uma
loja parecer com sobra e outra com falta** ([<u>Stocktake
Online</u>](https://blog.stocktake-online.com/central-and-commissary-kitchen-stock-control-that-scales)).
Centralizar a produção exige PCP, sistema de qualidade e, para manipular
carne crua, SIF, e não serve para todo o cardápio ([<u>Mercado &
Consumo</u>](https://mercadoeconsumo.com.br/17/08/2021/artigos/centralizacao-da-producao-sucesso-ou-derrocada/)).

## Baixa por venda e registro de perdas

Com o PDV integrado ao estoque, cada venda baixa os insumos da ficha
técnica, ajustados pelo rendimento e pelos modificadores
([<u>Suitable</u>](https://intercom.help/suitableapp/pt-BR/articles/8909021-cadastro-de-ficha-tecnica);
[<u>Supy</u>](https://supy.io/blog/learn-theoretical-vs-actual-food-cost-variance)).
O elo fraco é humano: **se o cozinheiro não lança a proteína queimada, o
sistema superestima o lucro** ([<u>Bloomberg
Línea</u>](https://www.bloomberglinea.com.br/negocios/contra-conta-de-padaria-foodtech-fatura-r-24-mi-com-corte-em-custo-de-restaurantes/)).
Excedentes ainda utilizáveis podem virar refeição de funcionários, prato
do dia ou fundo, desde que lançados como tal
([<u>Toast</u>](https://pos.toasttab.com/es-us/blog/on-the-line/restaurant-food-inventory-101)).

## Inventário: frequência por risco e contagem às cegas

O **inventário permanente** é atualizado a cada movimentação. O
**periódico** é a contagem física em intervalos
([<u>BaresSP</u>](https://baressp.com.br/noticias/cmv-como-calcular-o-custo-de-mercadoria-vendida-em-bares-e-restaurantes)).
O **rotativo** conta lotes parciais sem parar a operação
([<u>Omie</u>](https://www.omie.com.br/blog/inventario-rotativo/)). Para
restaurantes, contagem só mensal ou anual "não é recomendada"
([<u>Sculpture
Hospitality</u>](https://sculpturehospitality.com/blog/how-often-should-you-perform-restaurant-inventory-counts)).
As frequências de varejo da Omie, com classe A a cada 2 semanas e C a
cada 4 a 6 meses, são espaçadas demais para perecíveis.

| **Itens**                                                                                  | **Frequência**                            | **Fonte**                                                                                                |
|--------------------------------------------------------------------------------------------|-------------------------------------------|----------------------------------------------------------------------------------------------------------|
| Carne bovina, frutos do mar, aves, queijos caros, destilados e vinhos premium (A-críticos) | **Diária ou por turno**                   | [<u>MarketMan</u>](https://www.marketman.com/resources/restaurant-inventory-count-schedule-guide)        |
| Proteínas, laticínios, hortifrúti e preparados (perecíveis)                                | **Semanal completa**, base do CMV semanal | MarketMan; [<u>Restroworks</u>](https://www.restroworks.com/blog/?p=4900)                                |
| Curva ABC no rotativo                                                                      | A semanal, B quinzenal, C mensal          | Restroworks                                                                                              |
| Secos, enlatados, óleos, descartáveis                                                      | Mensal                                    | MarketMan                                                                                                |
| Descartáveis e limpeza                                                                     | Semanal (MarginEdge) ou mensal            | [<u>MarginEdge</u>](https://www.marginedge.com/blog/the-complete-guide-to-non-food-restaurant-inventory) |
| Utensílios, louças, uniformes, primeiros socorros                                          | Trimestral                                | MarginEdge                                                                                               |
| Estoque completo valorizado                                                                | **Mensal**, fecha o CMV contábil          | [<u>Restaurant365</u>](https://restaurant365.com/?p=39638)                                               |
| Inventário fiscal                                                                          | **Anual, em 31/12**                       | RIR/2018; Res. CGSN 140/2018                                                                             |

Regras de execução:

- Contar com o estoque parado, antes de abrir ou depois de fechar,
  sempre no mesmo dia e horário.

- Seguir a rota física da folha (câmara → seco → bar).

- Contar às cegas, sem ver o saldo do sistema.

- Converter frações para a unidade correta: 120 limões de uma caixa de
  240 = 0,5 caixa.

- Pesar as garrafas abertas de destilados.

- Separar avariados e vencidos.

- Fazer dupla contagem nos itens de alto valor e colher a assinatura do
  gerente.

([<u>Restroworks</u>](https://www.restroworks.com/blog/?p=4900);
[<u>Toast</u>](https://pos.toasttab.com/zh-us/blog/on-the-line/shelf-to-sheet-inventory-counts)).
Quando houver divergência, recontar com outro conferente, procurar NF
não lançada e transferências não registradas, achar a causa raiz e **só
então** lançar um ajuste formal justificado
([<u>Omie</u>](https://www.omie.com.br/blog/inventario-rotativo/)). O
gatilho de investigação varia entre as fontes: a MarketMan usa variação
acima de 3% por categoria, e a Supy, uso real mais de 10% acima do
teórico por item. Este manual adota os dois níveis, categoria e item.

# 7. Os controles contra perdas e furtos dependem de separar funções

Os controles mais citados reforçam uns aos outros. São eles:

- um ou dois responsáveis treinados pelo estoque
  ([<u>Pluxee</u>](https://www.pluxee.com.br/blog/controle-de-estoque-para-restaurantes/);
  [<u>BaresSP</u>](https://www.baressp.com.br/noticias/controle-de-estoque-de-restaurante-o-guia-definitivo));

- estoque com acesso controlado;

- conferência cega;

- contagem dupla e assinada;

- política escrita de cortesias e porcionamento, porque **generosidade
  não autorizada conta como furto**;

- trilha de auditoria de quem fez o quê e quando;

- análise da variância por local, turno e categoria;

- relatórios do PDV com cancelamentos, estornos e descontos fora do
  padrão
  ([<u>NetSuite</u>](https://www.netsuite.co.uk/portal/uk/resource/articles/inventory-management/restaurant-stock-theft.shtml)).

A Saipos acrescenta que as permissões de desconto e de retirar item da
conta devem ficar só com pessoas de confiança. Também recomenda
conciliar pedidos com o caixa, registrar qual funcionário atendeu cada
pedido e oferecer refeição aos funcionários
([<u>Saipos</u>](https://saipos.com/gestao-de-restaurante/furto-de-funcionarios)).
Separar "perda" de "consumo" no sistema ajuda a identificar desvios
([<u>Saipos, CMV real</u>](https://saipos.com/sistema/cmv-real)).

| **Função**                                                    | **Quem**                     | **Não deve acumular com**                 |
|---------------------------------------------------------------|------------------------------|-------------------------------------------|
| Cotação e pedido                                              | Comprador ou gerente         | Recebimento e aprovação do próprio pedido |
| Recebimento e contagem às cegas                               | Estoquista ou almoxarife     | Lançamento da NF e ajuste                 |
| Conferência com a NF e lançamento                             | Administrativo ou financeiro | Contagem física                           |
| Fichas técnicas, porcionamento, registro de perdas e produção | Chef                         | Aprovação dos próprios ajustes            |
| Aprovação de ajustes, análise de CMV e variância              | Gerente ou proprietário      | –                                         |

Em operação pequena, quando não dá para separar todas as funções,
compense com contagem periódica feita pelo dono e revisão semanal da
variância. Não há estatística brasileira confiável sobre furto interno
em restaurantes.

# 8. Nos indicadores, a variância entre CMV teórico e real é o que mais pesa

**CMV.** Este manual adota CMV = Estoque inicial + (Compras − Devoluções
de compras) − Estoque final. As fontes divergem no sinal das devoluções.
A Saipos apresenta a devolução de compra somando
([<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/calculo-cmv-para-seu-restaurante)),
e a BaresSP a subtrai
([<u>BaresSP</u>](https://baressp.com.br/noticias/cmv-como-calcular-o-custo-de-mercadoria-vendida-em-bares-e-restaurantes)).
O tratamento contábil correto é subtrair, porque a devolução reduz as
compras líquidas. Exemplo do Sebrae PR: 4.000 + 2.000 − 3.000 = R\$
3.000, ou seja, 30% de um faturamento de R\$ 10.000 ([<u>Sebrae
PR</u>](https://sebraepr.com.br/comunidade/artigo/entendendo-o-cmv-de-restaurante-como-fazer-o-calculo-e-sua-importancia)).
Com R\$ 200 devolvidos ao fornecedor, o CMV cai para R\$ 2.800 (28%). Há
uma segunda divergência: o blog colaborativo do Sebrae PR inclui mão de
obra no CMV, e a Stone a trata como despesa. Este manual segue a Stone e
deixa no CMV só mercadorias, insumos e embalagens de delivery. O cálculo
exige **contagem física** no início e no fim do período ([<u>Central do
Varejo</u>](https://centraldovarejo.com.br/?p=45839)).

| **Indicador**                | **Fórmula**                                               | **Meta / referência**                                                                                                            | **Fonte**                                                                                                                                                                                                                                                   |
|------------------------------|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CMV %                        | CMV ÷ faturamento bruto × 100                             | 25%–35% em geral; até 40% em à la carte e cardápios elaborados; acima de 40%, margem em risco; média setorial de ~33% em insumos | [<u>Stone</u>](https://conteudo.stone.com.br/o-que-e-cmv-restaurante-como-calcular/); [<u>Central do Varejo</u>](https://centraldovarejo.com.br/?p=45839); [<u>Ledware</u>](https://www.ledware.com.br/2026/05/21/cmv-restaurante-ficha-tecnica-2026-guia/) |
| CMV teórico %                | Σ (custo da ficha × unidades vendidas) ÷ receita          | Referência do período                                                                                                            | [<u>MarginEdge</u>](https://www.marginedge.com/blog/a-restaurant-operators-guide-to-actual-vs-theoretical-food-costs-and-usage)                                                                                                                             |
| **Variância real − teórico** | CMV% real − CMV% teórico                                  | ≤ 1 p.p. excelente; \< 2 p.p. bom; ≥ 3 p.p. investigar; 4–5 p.p. por semanas = problema sistêmico                                | [<u>Restaurant365</u>](https://www.restaurant365.com/blog/closing-the-gap-between-actual-and-theoretical-food-costs); [<u>Supy</u>](https://supy.io/blog/learn-theoretical-vs-actual-food-cost-variance)                                                    |
| Variância por item           | (Uso real − uso teórico) ÷ uso teórico                    | \> 10% = investigar o item                                                                                                       | Supy                                                                                                                                                                                                                                                        |
| Giro                         | CMV ÷ estoque médio                                       | Alimentos: 4 a 8 giros por mês, média ~5                                                                                         | [<u>Saipos</u>](https://saipos.com/gestao/controle-de-estoque/indicadores-de-estoque); [<u>Toast</u>](https://pos.toasttab.com/zh-us/blog/on-the-line/shelf-to-sheet-inventory-counts)                                                                      |
| Cobertura (dias)             | Estoque ÷ consumo médio diário                            | ~5 a 7 dias com 1 a 2 entregas por semana                                                                                        | [<u>Omie</u>](https://www.omie.com.br/blog/cobertura-de-estoque-o-que-e-e-como-calcular/); Toast                                                                                                                                                            |
| Acurácia do inventário       | Itens com físico = sistema ÷ itens auditados × 100        | \> 95% no geral; ≥ 98% na classe A                                                                                               | [<u>Omie</u>](https://www.omie.com.br/blog/inventario-rotativo/)                                                                                                                                                                                            |
| Ruptura                      | Itens em falta ÷ total de itens × 100                     | Perto de 0%; 4%–5% = grave                                                                                                       | Saipos                                                                                                                                                                                                                                                      |
| Índice de perdas             | Valor das perdas registradas ÷ compras de alimentos × 100 | \< 2%–4% das compras                                                                                                             | [<u>Toast</u>](https://pos.toasttab.com/es-us/blog/on-the-line/restaurant-inventory-sheet-template)                                                                                                                                                         |
| Divergência de recebimento   | Divergências não resolvidas ÷ compras × 100               | \< 1%                                                                                                                            | [<u>Supy</u>](https://supy.io/ar/blog/learn-restaurant-food-receiving-procedure)                                                                                                                                                                            |
| FC                           | Peso bruto ÷ peso líquido                                 | Medido na casa e revisado periodicamente                                                                                         | [<u>UFPR</u>](https://docs.ufpr.br/~monica.anjos/resumos/resumo_aula_01.pdf)                                                                                                                                                                                |
| IC                           | Peso cozido ÷ peso líquido cru                            | Medido na casa                                                                                                                   | UFPR                                                                                                                                                                                                                                                        |
| Curva ABC                    | Itens ordenados pelo valor consumido, com % acumulado     | A ≈ 20% dos itens e 80% do valor; B ≈ 30% e 15%; C ≈ 50% e 5%                                                                    | [<u>Omie</u>](https://www.omie.com.br/blog/inventario-rotativo/)                                                                                                                                                                                            |

**Não existe meta universal de CMV.** Fast food e self-service ficam na
parte baixa da faixa, à la carte na alta, e o número muda conforme se
incluem bebidas e embalagens. Os números de ABC em restaurante são mais
concentrados que a regra 80/20. Num brunch de Campo Grande, **3 itens
(filé mignon, bife ancho, salmão; 8,8% do total) responderam por 62% do
consumo**, e 22 itens de classe C (condimentos, farinhas, açúcares)
somaram só 10,8%
([<u>UFMS</u>](https://repositorio.ufms.br/retrieve/610469c3-cdea-4a90-afce-856ac17e6907/5457.pdf)).
Em João Pessoa, cerveja e picanha (15,8% dos itens) concentraram 61%
([<u>UFPB</u>](https://repositorio.ufpb.br/jspui/bitstream/123456789/3976/1/GASL17042018.pdf)).
Na prática, um punhado de proteínas e bebidas define o resultado, e a
contagem diária desses itens rende mais que qualquer outra rotina.
Quando a variância sobe, a sequência de investigação recomendada é esta:

1.  Quebrar a variância por ingrediente.

2.  Checar reajustes de preço não aplicados à ficha.

3.  Procurar perdas sem registro.

4.  Pesar as porções servidas.

5.  Ver se o desvio é constante (ficha desatualizada) ou intermitente
    (evento pontual).

([<u>Supy</u>](https://supy.io/blog/learn-theoretical-vs-actual-food-cost-variance);
[<u>Restaurant365</u>](https://www.restaurant365.com/blog/closing-the-gap-between-actual-and-theoretical-food-costs)).
Em rede, uma média consolidada boa pode esconder uma unidade 14,7 p.p.
acima do teórico, por isso a variância deve ser lida loja a loja (Supy).

# 9. As obrigações fiscais tocam o estoque em quatro pontos

O primeiro é a **avaliação**. O RIR/2018 (arts. 304 a 308) obriga a
levantar e avaliar os estoques ao fim de cada período de apuração, pelo
custo de aquisição, aceitando custo médio ou PEPS
([<u>TOTVS/RIR</u>](https://tdn.totvs.com.br/download/attachments/172300617/Orienta%C3%A7%C3%B5es%20Consultoria%20de%20Segmentos%20%E2%80%93%20TQSUYJ%20-%20Arbitramento%20do%20custo%20de%20estoque%20-%20v2.pdf?api=v2)).
O UEPS não é aceito para IR e CSLL
([<u>Nuvemshop</u>](https://www.nuvemshop.com.br/blog/peps-ueps/)). O
segundo é o **inventário anual**. A ME/EPP do Simples que é contribuinte
do ICMS mantém o Livro Registro de Inventário com os estoques de 31/12
(Res. CGSN 140/2018; a numeração do artigo, 63 ou 64, diverge entre as
fontes) ([<u>Rotina
Fiscal</u>](https://www.rotinafiscal.com.br/tributos-e-declaracoes/estadual/livros-fiscais);
[<u>NetCPA</u>](https://netcpa.com.br/colunas/icms-sn-livros-obrigatorios/1099)).
Quem entrega a EFD ICMS/IPI informa o inventário no **Bloco H**,
registro H010
([<u>Omie</u>](https://www.omie.com.br/blog/bloco-h-saiba-tudo-sobre-essa-obrigacao/index.md)).
Em regra, a EFD não é obrigatória para o Simples, salvo quando o
sublimite estadual é ultrapassado ([<u>Ideal
Softwares</u>](https://idealsoftwares.com.br/tabelas/tabela.php?id=899)).

O terceiro ponto é a **baixa de perdas**. Perda, deterioração ou consumo
próprio, no regime normal, exige NF com **CFOP 5.927** e estorno dos
créditos de ICMS, PIS e COFINS. A fonte é baseada no RICMS/SP, não trata
do Simples e deixou de ser atualizada no fim de 2024, então confirme com
o contador ([<u>Rotina
Fiscal</u>](https://www.rotinafiscal.com.br/operacoes-fiscais/baixa-de-estoque)).
O quarto é a **entrada de NF-e**. A manifestação do destinatário é
voluntária para a maioria dos restaurantes, mas confirmar ou desconhecer
a operação é um bom controle contra notas emitidas indevidamente contra
o CNPJ. Os prazos da fonte consultada são de 2012 e podem ter mudado
([<u>SEFAZ-GO</u>](https://goias.gov.br/economia/manifestacao-do-destinatario/)).
A recomendação prática é que inventário gerencial e inventário fiscal
**saiam da mesma base valorizada pelo custo médio**, para que o CMV
gerencial e o contábil conversem. Os efeitos da Reforma Tributária
(IBS/CBS) e a NF-e de transferência entre a cozinha central e as filiais
não foram pesquisados nesta rodada.

# 10. Rotinas: checklists diário, semanal, mensal e anual

## Diário

> ☐ Registrar a temperatura de cada geladeira, câmara e freezer, **no
> mínimo 2 vezes** (abertura e fechamento).
>
> ☐ Receber com conferência cega, pesagem, temperatura, validade,
> integridade da embalagem e do veículo; preencher a planilha de
> recebimento; recusar ou segregar os não conformes.
>
> ☐ Guardar imediatamente, nesta ordem: refrigerados, congelados,
> hortifrúti, secos. Aplicar PVPS.
>
> ☐ Lançar a NF-e com de-para e conversão de unidades; conferir pedido ×
> NF × físico.
>
> ☐ Etiquetar tudo o que foi aberto, fracionado, produzido ou posto para
> descongelar.
>
> ☐ Atender as requisições das praças e do bar com registro.
>
> ☐ Registrar as ordens de produção das sub-receitas, com o rendimento
> real.
>
> ☐ Contar os itens A-críticos (proteínas nobres, frutos do mar,
> destilados premium) por turno.
>
> ☐ Lançar perdas (com motivo), consumo de funcionários e cortesias.
>
> ☐ Verificar os itens abaixo do ponto de pedido e gerar requisições e
> pedidos; checar a validade dos itens perto do vencimento e
> direcioná-los ao prato do dia.

## Semanal

> ☐ Contagem completa dos perecíveis, às cegas, na mesma hora e dia.
>
> ☐ Calcular o CMV real × teórico da semana; investigar categorias com
> variação \> 3% e itens com uso \> 10% acima do teórico.
>
> ☐ Revisar o par e o ponto de pedido conforme a previsão (eventos,
> feriados, clima).
>
> ☐ Consolidar as cotações (≥ 3 fornecedores) e a agenda de pedidos.
>
> ☐ Contar os descartáveis e os produtos de limpeza.
>
> ☐ Limpar o estoque seco e as câmaras conforme o POP; verificar sinais
> de pragas.

## Mensal

> ☐ Inventário completo valorizado pelo custo médio; aprovar os ajustes
> com justificativa (gerente ou proprietário).
>
> ☐ CMV contábil e CMV % por grupo (alimentos, bebidas, embalagens).
>
> ☐ Atualizar as fichas técnicas com os preços novos; recalcular a curva
> ABC.
>
> ☐ Painel: giro, cobertura, acurácia, ruptura, índice de perdas,
> divergência de recebimento.
>
> ☐ Avaliar fornecedores (pontualidade, não conformidades, preço).
>
> ☐ Contar papelaria e enxoval; conferir o comprovante do controle de
> pragas e os registros de calibração.

## Trimestral e anual

> ☐ Trimestral: auditoria de utensílios, louças (taxa de quebra),
> uniformes e kit de primeiros socorros.
>
> ☐ Anual (31/12): inventário fiscal para o Livro Registro de Inventário
> ou o Bloco H.
>
> ☐ Anual: refazer os testes de rendimento (FC e IC) dos itens A;
> revisar o Manual de BP e os POPs; rehomologar fornecedores.

# 11. Onde as fontes divergem e o que este manual adota

| **Tema**                         | **Divergência**                                                                                                         | **Escolha adotada**                                                                    |
|----------------------------------|-------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Estoque mínimo e ponto de pedido | Saipos/UFPR: mínimo = consumo × tempo de reposição. Conta Azul: mínimo = estoque de segurança, com dupla contagem no PP | ES = CMD × ciclo × margem; PP = CMD × LT + ES; o campo "mínimo" do sistema recebe o PP |
| Estoque máximo                   | Saipos: mínimo + lote. UFPR: consumo mensal + mínimo. Altametrics: par                                                  | Par = CMD × ciclo + ES                                                                 |
| Devoluções no CMV                | Saipos soma a devolução de compra; BaresSP subtrai                                                                      | Compras líquidas = compras − devoluções                                                |
| Mão de obra no CMV               | Blog Sebrae PR inclui; Stone exclui                                                                                     | Excluir (é despesa de pessoal)                                                         |
| Vigência da CVS 3/2026           | 04/10/2026 (Atibaia, EM) × 01/02/2027 (CVS 9/2026, segundo ANR e CRN-3); tabela interna da ANR inconsistente            | 01/02/2027; a CVS 5/2013 vale em SP até lá                                             |
| Refrigeração                     | Saipos: 0–5 °C genérico; CVS: por produto; RDC: \< 5 °C; SC: ≤ 4 °C para preparados                                     | \< 5 °C como regra, ≤ 4 °C para preparados e carnes, tabela CVS por produto            |
| Cocção na CVS 3                  | 74 °C × 75 °C conforme a fonte                                                                                          | 75 °C (mais conservador); a RDC 216 exige 70 °C                                        |
| Guarda de registros              | RDC 216: 30 dias; CVS 3: 180 dias                                                                                       | 180 dias                                                                               |
| Faixa de CMV %                   | 25–35% (Sebrae PR, Stone) × 30–40% (Saipos, BaresSP)                                                                    | Depende do modelo; usar a variância teórico × real como meta principal                 |

# Conclusão

O que separa um estoque que só registra de um estoque que gerencia é a
**granularidade dos motivos**, mais do que o software. Um restaurante
pode ter o melhor sistema e ainda assim operar às cegas se toda saída
vira "consumo", se o FC vem de uma tabela de livro e não do teste da
própria cozinha, ou se a NF entra sem conferência cega. Os dados
reunidos aqui mostram onde mora o risco. FCs medidos chegam a ser o
dobro da referência. Três ou quatro proteínas e bebidas concentram mais
de 60% do valor consumido. E a diferença entre um operador excelente e
um descontrolado está em 1 a 3 pontos percentuais de variância. A
prioridade de implantação, portanto, é esta: fichas técnicas com FC
medido e sub-receitas cadastradas, motivos de saída em lista fechada,
contagem diária dos itens A e revisão semanal da variância. O resto é
refinamento.

Para Santa Catarina, o quadro regulatório pede uma postura prudente. A
RDC 216 é a obrigação, mas está em revisão na Anvisa. A norma paulista,
mais detalhada, vira referência de mercado em 2027. Montar desde já o
estoque pelos números da CVS 3/2026 (afastamento de 10/60 cm,
temperatura registrada duas vezes ao dia, registros guardados por 180
dias, proibição de revalidar) custa pouco e antecipa o rumo provável da
norma federal. Ficam em aberto, para uma próxima rodada: a comparação
dos módulos de estoque de cada software, o tratamento fiscal de perdas,
cortesias e refeições de funcionários no Simples Nacional, a NF-e de
transferência entre cozinha central e filiais, o efeito da Reforma
Tributária e a confirmação do texto vigente da lista de verificação
sanitária de SC.
