# Feature 007 — Fornecedores

**Branch**: `claude/project-thread-8lg7o1` · **Criada**: 2026-11-02 · **Status**: em revisão

## Contexto

Com a [004](../004-entradas-perdas-saldo/spec.md) a compra entra no estoque, mas o sistema não sabe
de quem se comprou nem quanto cada fornecedor cobra. Esta feature cria o **cadastro de
fornecedores** só com os dados comerciais (decisão de
[escopo simplificado](../../docs/produto/estoque/13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026)):
contato, entrega, pagamento, os itens que cada um vende e por quanto.

O dono escolheu fazer a 007 enquanto a baixa por pedido (005) espera o cardápio do cliente.

Regras de negócio: [03-fornecedores](../../docs/produto/estoque/03-fornecedores.md).

## Histórias

### US1 — Cadastrar um fornecedor (P1)

Como gerente ou comprador, quero cadastrar de quem eu compro, para ter o contato e as condições à
mão.

1. No menu "Fornecedores", clico "Novo fornecedor".
2. Só o **nome** é obrigatório (ex.: "Hortifruti do João"). O resto é opcional:
   - razão social e **CNPJ** (validado; aceita o CNPJ só de números e o novo CNPJ com letras);
   - contato: nome do vendedor, telefone/WhatsApp, e-mail;
   - entrega: dias da semana em que entrega, em quantos dias entrega depois do pedido, pedido
     mínimo (R$);
   - pagamento: texto livre ("Boleto 28 dias, PIX");
   - observação.
3. CNPJ repetido no mesmo restaurante é recusado e a tela diz qual fornecedor já usa
   (`CNPJ_IN_USE`). Nome repetido entre fornecedores ativos também (`NAME_IN_USE`).
4. Feirante ou produtor sem CNPJ entra só com o nome.

### US2 — Dizer o que cada fornecedor vende e por quanto (P1)

1. Na página do fornecedor, em "Itens que vende", adiciono um item ativo, o **preço** e,
   opcionalmente, a **embalagem desse fornecedor** ("Caixa" com 18 kg). Sem embalagem, o preço é
   por medida do item (R$/kg).
2. A tela mostra o preço por medida para comparar ("R$ 90,00 a caixa de 18 kg = R$ 5,00/kg").
3. Posso marcar o fornecedor como **preferido** para aquele item. Cada item tem no máximo um
   preferido: marcar outro tira a marca do anterior.
4. Posso editar o preço e a embalagem ou tirar o item da lista. O mesmo item não entra duas vezes
   no mesmo fornecedor (`SUPPLIER_ITEM_DUPLICATE`).

### US3 — Comparar fornecedores na página do item (P1)

1. A página do item mostra o quadro "Fornecedores": quem vende, embalagem, preço, preço por medida e
   a data da última compra lançada daquele fornecedor.
2. O preferido aparece marcado; o de menor preço por medida aparece como "mais barato".

### US4 — Dizer de quem foi a compra (P2)

1. No lançamento de compra (004) há o campo opcional "Fornecedor", com os fornecedores ativos.
2. Escolhido um fornecedor que tem embalagem para aquele item, a "Medida" ganha a opção da
   embalagem dele ("Caixa (18 kg)") e a compra entra na medida do item.
3. Ao lançar a compra com fornecedor, o preço cadastrado daquele item **não muda sozinho**; a
   página do fornecedor mostra a última compra (data e custo por medida) ao lado do preço.
4. As listas de lançamentos e a página do item mostram de quem foi a compra.

### US5 — Bloquear um fornecedor (P2)

1. Na página do fornecedor, o gerente ou comprador clica "Bloquear" (ex.: entregou fora do padrão).
2. Fornecedor bloqueado não aparece para escolher na compra e a compra com ele é recusada
   (`SUPPLIER_BLOCKED`). O histórico continua.
3. "Desbloquear" volta ao normal. Fornecedor nunca é apagado.

## Requisitos

- **FR-001** Fornecedor: nome obrigatório (até 120 caracteres); demais campos opcionais. CNPJ
  guardado sem pontuação, em maiúsculas (14 caracteres), validado pelos dígitos verificadores,
  inclusive o CNPJ alfanumérico (Receita Federal, a partir de julho de 2026). Único por restaurante.
- **FR-002** Dias de entrega: conjunto de dias da semana (dom a sáb). Prazo de entrega: dias
  inteiros de 0 a 90. Pedido mínimo: R$ com 2 casas, ≥ 0. E-mail, se informado, válido.
- **FR-003** Item do fornecedor: item ativo, preço > 0 (4 casas), embalagem opcional (nome e
  quantidade na medida do item, os dois juntos, quantidade > 0). Único por fornecedor e item.
- **FR-004** No máximo um fornecedor preferido por item (garantido também no banco).
- **FR-005** Preço por medida = preço ÷ quantidade da embalagem (ou o próprio preço sem embalagem),
  mostrado com 2 casas e calculado em decimal exato.
- **FR-006** Permissões: cadastrar e editar fornecedores e seus itens, bloquear e desbloquear =
  gerente e comprador. Todos que veem o estoque veem os fornecedores. Tentativa negada vai para a
  auditoria.
- **FR-007** Compra pode ter fornecedor (opcional). Fornecedor bloqueado não recebe compra.
  Só a compra guarda fornecedor (check no banco).
- **FR-008** Toda criação, edição, bloqueio e mudança de itens do fornecedor vai para a auditoria.
  Edição concorrente devolve `STALE_RECORD` (trava otimista).
- **FR-009** Isolamento: um restaurante nunca vê fornecedores de outro (RLS).

## Fora do escopo

Dados sanitários (licença, SIF), fiscais (IE, regime), de-para da NF-e, código do produto no
fornecedor, cotação, pedido de compra ao fornecedor, avaliação de desempenho, dados bancários,
histórico de preços (além da última compra), atualização automática do preço pela compra.

## Critérios de sucesso

- **SC-001** Cadastrar um fornecedor só com o nome em menos de 15 segundos.
- **SC-002** Na página do item, ver em uma tela quem vende mais barato por medida.
