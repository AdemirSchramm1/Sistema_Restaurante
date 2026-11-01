# 2. Cadastro do item

> Fonte: Manual de Referência, seção 2.

O cadastro do item é o alicerce de custo, compra e segurança sanitária. Ele tem quatro blocos:
**identificação**, **unidades e conversões**, **reposição e conservação** e **custo e fiscal**.

## Descrição padronizada e código

- **Descrição em quatro partes:** nome básico, modificador, especificação técnica e referência do
  fornecedor. Ex.: "Tomate italiano, caixa 20 kg, tipo AA". Evita comprar item "parecido, mas
  inadequado" ([UFPR](https://docs.ufpr.br/~monica.anjos/apostila/01_materiais.pdf)).
- **Código interno único e imutável** no formato grupo.subgrupo.número (ex.: `01.03.0045`). Depois
  de criado, o código não muda; ele sustenta todo o histórico.

## As três unidades

O ponto técnico mais sensível do cadastro.

| Unidade | Exemplo | Usada em |
|---|---|---|
| Compra | saco de 50 kg, caixa com 12 | Pedido e nota fiscal |
| Estoque (contagem) | kg, un. | Saldo, contagem, valoração |
| Receita | g, ml | Ficha técnica |

- **Fator de conversão** = quantas unidades de estoque cabem em uma unidade de compra. Caixa com 12
  → fator 12; 20 caixas = 240 unidades.
- O fator de compra fica no **vínculo item-fornecedor**, não só no item: fornecedores diferentes
  vendem embalagens diferentes.
- Na entrada por XML de NF-e, cada item da nota precisa de um **de-para** com o item interno e a
  conversão de unidade (2 caixas × 12 = 24 un.).
- **Mudar a unidade de estoque de um item já movimentado é bloqueado.** Afeta histórico e SPED
  ([Alterdata](https://ajuda.alterdata.com.br/x/cwH0Ag)). O caminho é inativar e criar outro item.

## Campos do cadastro

| Campo | Exemplo | Por que importa |
|---|---|---|
| Código interno único e imutável | 01.03.0045 | Evita duplicidade, sustenta o histórico |
| Descrição padronizada | "Tomate italiano, caixa 20 kg, tipo AA" | Impede compra de item errado |
| EAN/GTIN da unidade e da embalagem | 789… / "SEM GTIN" | Coletor e conferência de nota |
| Tipo | insumo, revenda, produzido, consumo, patrimônio | Regra de baixa e contabilização |
| Grupo, subgrupo, categoria financeira | Proteínas > Bovinos; "CMV alimentos" | CMV por grupo e ligação com o DRE |
| Unidades de compra, estoque e receita, com fatores | caixa 12 un. → un. → g | Converte nota, contagem e receita |
| Apresentação e peso líquido/drenado | lata 2,8 kg; drenado 1,7 kg | Custo real por kg |
| Peso variável (*catch weight*) | carnes, peixes | Recebe pelo peso real, não pelo rótulo |
| FC padrão e rendimento | 1,25 | Custo do kg limpo e compra pelo bruto |
| Último custo, custo médio, data de atualização | R$ 23,33/un. | Valoração e alerta de reajuste |
| Tolerância de variação de custo no recebimento | ±5% | Detecta cobrança acima do combinado |
| Estoque de segurança, ponto de pedido, par, lead time, dias entre entregas | ver [planejamento](08-ciclo-operacional.md#planejamento) | Gera o pedido sugerido |
| Fornecedores (preferencial e alternativos) com código, unidade e preço | – | De-para do XML e cotação |
| Locais (padrão e alternativos) e posição na folha | Câmara 1, prateleira B | Contagem da prateleira para a planilha |
| Temperatura de conservação e faixa de recebimento | ≤ 4 °C; recebe entre 4 e 7 °C | Aceite ou recusa na doca |
| Validade fechado e após aberto; controle de lote; dias de alerta | 3 dias após aberto | PVPS, etiqueta, rastreio |
| Alérgenos (lista da RDC 727/2022, antiga RDC 26/2015) | leite, trigo, castanhas | Herdados pela ficha técnica |
| NCM, CEST, origem, CST/CSOSN | 2202.10.00 | Erro de NCM gera multa de 1%; validar com contador |
| Curva ABC/XYZ | A | **Calculada** pelo consumo, nunca digitada |
| Flags: ativo, inventariável, frequência de contagem | contar diariamente | Monta as folhas de contagem por ciclo |

## Custo do item

- **Custo médio ponderado** = (valor em estoque + valor da compra) ÷ (quantidade em estoque +
  quantidade comprada). Ex.: 10 un. a R$ 20 + 20 un. a R$ 25 = R$ 23,33.
- O sistema **valora o estoque pelo custo médio** (aceito pela legislação; UEPS não é —
  [Omie](https://www.omie.com.br/blog/custo-medio-ponderado-como-funciona-essa-administracao-de-estoques/index.md)).
- O **último custo** fica sempre visível para negociação.
- Entrada com custo fora da tolerância (ex.: ±5% do último custo) gera alerta no recebimento.

## Critérios de aceite (para a spec)

- Não é possível salvar dois itens ativos com a mesma descrição normalizada no mesmo subgrupo.
- Código é gerado pelo sistema e não pode ser editado.
- Unidade de estoque não pode ser alterada depois da primeira movimentação.
- Curva ABC não é editável na tela; é recalculada (ver [indicadores](10-indicadores.md)).
- Alérgenos do item são herdados por toda ficha técnica que o usa.
