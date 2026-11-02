# 8. Ciclo operacional: da ficha técnica ao ajuste

> **Escopo simplificado (novembro de 2026).** O ciclo do sistema é: produtos com as quantidades →
> compra → entrada → **baixa automática a cada pedido** → perdas → acerto manual quando preciso.
> Ficam fora: conferência cega, temperatura e validade no recebimento, PVPS, quarentena e todo o
> inventário (contagem). As seções abaixo vêm do manual e ficam como referência. Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

> Fonte: Manual de Referência, seção 6.

## As doze etapas

1. Ficha técnica com FC e rendimento.
2. Parâmetros de reposição por item.
3. Requisição interna e aprovação.
4. Cotação com três ou mais fornecedores e pedido formal.
5. Recebimento com conferência cega, pesagem, temperatura e validade.
6. Entrada da NF-e e armazenagem em PVPS.
7. Requisição ou transferência para as praças.
8. Produção registrada.
9. Baixa automática por venda.
10. Registro de perdas, consumo interno e cortesias.
11. Contagem.
12. Comparação teórico × real e ajuste formal.

## Planejamento

As fontes divergem sobre o que é "estoque mínimo". O sistema adota as definições abaixo e usa o
**ponto de pedido** como gatilho do alerta de reposição.

| Parâmetro | Fórmula | Observação |
|---|---|---|
| Consumo médio diário (CMD) | Consumo do período ÷ dias | Pode separar dia útil e fim de semana |
| Lead time (LT) | Dias entre pedido e entrega | Vem do fornecedor |
| Ciclo de reposição (C) | Dias entre duas entregas | Agenda de pedidos |
| Estoque de segurança (ES) | CMD × C × margem (10% a 25%) | Margem maior para itens críticos |
| **Ponto de pedido (PP)** | CMD × LT + ES | Ao atingir, gerar pedido |
| **Par / máximo** | CMD × C + ES | Nível desejado logo após a entrega |
| Quantidade a pedir | Par − (saldo atual − CMD × LT) − pedidos em trânsito | Converter para unidade de compra; se par em peso limpo, × FC |

**No sistema (feature 006):** cada item tem "Avisar quando chegar em" (PP) e "Comprar até" (par),
digitados pela equipe. O sistema sugere os dois pelo consumo dos últimos 30 dias, pelo prazo e pelos
dias de entrega do fornecedor preferido, com margem de 20%. Itens no ponto aparecem em **Repor**,
com quanto comprar (arredondado para cima na embalagem) e de quem. Não há pedido em trânsito.

**Exemplo (caso de teste):** filé mignon, CMD 6 kg, LT 1 dia, entregas a cada 3 dias, margem 20%.

- ES = 6 × 3 × 0,2 = **3,6 kg**
- PP = 6 × 1 + 3,6 = **9,6 kg**
- Par = 6 × 3 + 3,6 = **21,6 kg**
- Ao atingir 9,6 kg, pedir 21,6 − (9,6 − 6) = **18 kg**

O par pode variar por dia da semana (até 7 níveis). Perecíveis são planejados à parte dos itens de
longa duração. Política por curva ABC (sugestão): A com compra semanal, B por ponto de pedido, C
separando validade curta (semanal) e longa (lote econômico).

## Cotação, requisição e pedido

Fluxo: **requisição → aprovação → pedido**.

- Chef ou gerente abre a requisição.
- Compras ou financeiro aprova dentro de **alçadas por valor**.
- Só então vira pedido ao fornecedor.
- Redes usam **horário de corte diário** para consolidar pedidos e eliminar duplicidades.
- Cotação com ≥ 3 fornecedores; o sistema compara preço por unidade de estoque (já convertido).

## Recebimento

**Conferência cega:** quem recebe registra as quantidades **sem ver a NF nem o pedido**; uma segunda
pessoa compara com a nota. Divergência → recontagem e aviso ao comprador.

Sequência no app:

1. Selecionar fornecedor / pedido (as quantidades esperadas ficam ocultas para o conferente).
2. Registrar linha a linha: quantidade, **peso real** (itens por peso), temperatura, validade, lote,
   integridade da embalagem e do veículo.
3. Sistema cruza **pedido × NF × físico**: falta, preço acima da tolerância, avaria, temperatura,
   item errado.
4. Divergências registradas **com o entregador presente** e classificadas (crédito emitido,
   disputado).
5. Itens recusados vão para a ficha de devolução e o local **Quarentena**.
6. Fechar recebimento → gera movimentações de entrada e atualiza custo médio.

Meta: divergência não resolvida **< 1% das compras**.

## Armazenagem, requisição às praças e produção

- Toda retirada do almoxarifado para cozinha ou bar é registrada (item, data, quantidade, valor,
  motivo).
- Ordem de produção baixa insumos e dá entrada na sub-receita, com **rendimento real** e etiqueta de
  validade.
- Na cozinha central, transferência não registrada faz uma loja parecer com sobra e outra com falta.

## Baixa por venda

Com o PDV integrado, cada venda baixa os insumos da ficha técnica, ajustados por rendimento e por
**modificadores** (adicionais e retiradas). Excedentes ainda utilizáveis podem virar refeição de
funcionários, prato do dia ou fundo, **desde que lançados como tal**.

> A integração com PDV fica fora do primeiro corte do módulo; até lá a venda pode ser importada
> (arquivo) ou lançada manualmente. *(Decisão a confirmar na spec.)*

## Inventário (contagem)

- **Permanente:** atualizado a cada movimentação (o saldo do sistema).
- **Periódico:** contagem física em intervalos.
- **Rotativo:** conta lotes parciais sem parar a operação.

| Itens | Frequência |
|---|---|
| Carne bovina, frutos do mar, aves, queijos caros, destilados e vinhos premium (A-críticos) | **Diária ou por turno** |
| Proteínas, laticínios, hortifrúti e preparados | **Semanal completa** (base do CMV semanal) |
| Curva ABC no rotativo | A semanal, B quinzenal, C mensal |
| Secos, enlatados, óleos, descartáveis | Mensal |
| Descartáveis e limpeza | Semanal ou mensal |
| Utensílios, louças, uniformes, primeiros socorros | Trimestral |
| Estoque completo valorizado | **Mensal** (fecha o CMV contábil) |
| Inventário fiscal | **Anual, em 31/12** |

Regras de execução que o app reforça:

- Contar com o estoque parado, sempre no mesmo dia e horário.
- Seguir a rota física da folha (câmara → seco → bar).
- **Contar às cegas:** a tela de contagem não mostra o saldo do sistema.
- Aceitar frações na unidade correta (120 limões de uma caixa de 240 = 0,5 caixa).
- Pesar garrafas abertas de destilados.
- Separar avariados e vencidos.
- Dupla contagem nos itens de alto valor e assinatura do gerente.

Divergência: recontar com outro conferente, procurar NF não lançada e transferência não
registrada, achar a causa e **só então** lançar ajuste formal justificado.

Gatilhos de investigação (os dois níveis):

- **Categoria:** variação > 3%.
- **Item:** uso real > 10% acima do teórico.
