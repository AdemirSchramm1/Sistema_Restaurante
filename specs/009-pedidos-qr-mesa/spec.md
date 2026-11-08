# Feature 009 — Pedidos pelo QR code da mesa

**Branch**: `claude/project-thread-qmc5hs` · **Criada**: 2026-11-08 · **Status**: em revisão

**Pedido do dono**: "O dono pode criar quantos QR codes quiser com base nas mesas que tem no
restaurante e coloca na mesa. O cliente escaneia o QR code e vai para um link com o cardápio do
restaurante, sem fazer login. A mesa fica guardada no sistema; a cozinha recebe o pedido que veio
da mesa e o garçom leva o prato até lá. O link deve ficar aberto até 10 minutos no celular, para
não ter milhões de instâncias abertas."

## Contexto

Os produtos vendidos e o preço de venda já existem ([003](../003-produtos/spec.md) e
[008](../008-painel-custo-produtos/spec.md)). Falta o cliente conseguir pedir. Esta feature cria
as mesas, o QR code de cada mesa, o cardápio aberto pelo celular do cliente e as telas da cozinha
e do garçom.

É o que a [005 — Baixa automática por pedido](../../docs/produto/estoque/00-visao-geral.md#roadmap)
esperava: com os pedidos gravados aqui (produto, versão vigente e quantidade), a 005 passa a baixar
o estoque. **A baixa do estoque não faz parte desta feature.**

## Histórias

### US1 — Cadastrar as mesas e imprimir o QR code de cada uma (P1)

Como dono, quero cadastrar as mesas do restaurante e imprimir um QR code para cada uma, para
colocar na mesa.

**Por que P1**: sem mesa e QR code o cliente não chega ao cardápio.

**Teste independente**: cadastrar a mesa "12", abrir o QR code, escanear com um celular e cair no
cardápio do restaurante já identificado como "Mesa 12".

**Cenários**

1. Dado o menu, então vejo "Mesas". A página lista as mesas com nome, se está ativa e o botão
   "QR code".
2. Dado o formulário de nova mesa, quando informo "12", então a mesa é salva e o QR code fica
   disponível para baixar e imprimir, com o nome do restaurante e "Mesa 12" escritos embaixo.
3. Dado que quero cadastrar o salão de uma vez, quando uso "Criar várias mesas" de 1 a 20, então
   são criadas as mesas 1 a 20; as que já existem são puladas e o sistema diz quantas criou.
4. Dado a mesa "12" ativa, quando crio outra "12", então aparece "Já existe uma mesa com esse nome".
5. Dado a lista, quando escolho "Imprimir todos", então sai uma folha com os QR codes de todas as
   mesas ativas, um por bloco, com o nome da mesa.
6. Dado que um QR code foi copiado ou fotografado por alguém de fora, quando escolho "Trocar QR
   code" na mesa, então o QR code antigo para de funcionar na hora e um novo é gerado para imprimir.
7. Dado uma mesa inativada, quando alguém escaneia o QR code dela, então aparece "Esta mesa não
   está recebendo pedidos. Chame um garçom." e nenhum pedido é aceito.
8. Não há limite de mesas por restaurante.

### US2 — Cliente pede pelo celular, sem login (P1)

Como cliente, quero escanear o QR code da mesa, ver o cardápio e fazer o pedido, sem criar conta.

**Por que P1**: é a entrega principal da feature.

**Teste independente**: com a mesa 12 e dois produtos com preço, escanear o QR code, pôr 2 X-Burger
e 1 suco no pedido, enviar e ver a confirmação "Pedido enviado para a cozinha".

**Cenários**

1. Dado o QR code da mesa 12, quando escaneio, então abre o cardápio com o nome do restaurante e
   "Mesa 12" no topo, sem pedir login, nome ou telefone.
2. O cardápio mostra os produtos **vendidos ao cliente**, **ativos**, **com preço** e **disponíveis**
   (US5), em ordem alfabética, com nome e preço. Tem busca por nome. Preparos, produtos inativos,
   sem preço ou esgotados não aparecem.
3. Dado o X-Burger a R$ 28,00, quando toco em "Adicionar", escolho 2 e escrevo "sem cebola", então
   o pedido mostra "2 × X-Burger — R$ 56,00 — sem cebola".
4. Posso mudar a quantidade e tirar linhas antes de enviar. O total aparece sempre atualizado.
5. Quando toco em "Enviar pedido", vejo o resumo (linhas, observações e total) e confirmo. Então
   aparece "Pedido enviado para a cozinha" com o número do pedido.
6. Depois de enviar, posso continuar pedindo: cada envio é um pedido novo da mesma mesa.
7. Em "Meus pedidos" vejo os pedidos enviados deste celular, com a situação de cada um
   (Recebido, Em preparo, Pronto, Entregue, Cancelado).
8. Dois celulares na mesma mesa pedem cada um o seu; os dois pedidos chegam na cozinha como
   "Mesa 12". Cada celular vê só os próprios pedidos.
9. Tocar duas vezes em "Confirmar" ou a internet cair e voltar no meio do envio não cria pedido em
   dobro.
10. Dado que o preço do X-Burger mudou depois que pus no pedido, quando envio, então o sistema avisa
    "O preço de X-Burger mudou para R$ 30,00" e pede nova confirmação. O pedido guarda o preço do
    momento do envio.
11. Dado que um produto saiu do cardápio (esgotou ou foi inativado) depois que pus no pedido, quando
    envio, então aparece "X-Burger não está mais disponível" e a linha sai do pedido; o resto pode
    ser enviado.

### US3 — O cardápio aberto fica no ar por no máximo 20 minutos (P1)

Como dono, não quero cardápios abertos para sempre nos celulares, nem gente pedindo de fora do
restaurante com uma foto antiga do QR code.

**Por que P1**: foi pedido explicitamente pelo dono.

**Teste independente**: escanear o QR code, mexer no cardápio sem parar e, 20 minutos depois da
leitura, tentar enviar um pedido; aparece a mensagem para escanear de novo e nenhum pedido é criado.

**Regra (decidida pelo dono em 2026-11-08)**: cada leitura do QR code abre um **acesso ao
cardápio** naquele celular do cliente. O acesso **fecha 20 minutos depois da leitura**, mesmo que o
cliente esteja mexendo; usar o cardápio não aumenta o tempo. Para pedir de novo depois disso, basta
escanear o QR code da mesa outra vez.

**Cenários**

1. Dado o cardápio aberto há 19 minutos, quando adiciono um produto, então o tempo **não** aumenta:
   continua faltando 1 minuto.
2. Passados 20 minutos da leitura, quando toco em qualquer coisa, então aparece "Seu tempo acabou.
   Escaneie o QR code da mesa de novo para continuar." O que estava no pedido e não foi enviado é
   mostrado na tela para o cliente lembrar, mas não pode ser enviado.
3. Dado um acesso fechado, quando alguém tenta enviar um pedido com ele (inclusive reabrindo a aba
   do navegador), então o pedido é recusado.
4. O cardápio mostra o tempo que falta de forma discreta. Faltando 2 minutos, avisa "Faltam 2
   minutos. Envie seu pedido ou escaneie o QR code de novo depois." se houver produtos ainda não
   enviados.
5. Escanear o QR code de novo no mesmo celular abre um acesso novo; o antigo deixa de valer.
   Os pedidos já enviados continuam na cozinha normalmente.
6. Acesso fechado não ocupa nada no sistema: some da contagem de acessos abertos.
7. Dado que o cliente toca em "Confirmar" antes dos 20 minutos e o envio chega logo depois, então o
   pedido é aceito (vale a hora em que o cliente confirmou, com tolerância de poucos segundos).

### US4 — A cozinha recebe os pedidos e o garçom leva à mesa (P1)

Como cozinha, quero ver os pedidos chegando com a mesa; como garçom, quero saber o que está pronto
e para qual mesa levar.

**Por que P1**: sem isso o pedido do cliente não vira prato.

**Teste independente**: enviar um pedido da mesa 12 pelo celular e vê-lo aparecer sozinho na tela
da cozinha; marcar "Pronto" e vê-lo na tela do garçom; marcar "Entregue".

**Cenários**

1. O menu ganha **"Cozinha"**. A tela mostra os pedidos em aberto, o mais antigo primeiro, com:
   número, mesa, há quanto tempo chegou, as linhas (quantidade, produto, observação).
2. Um pedido novo aparece sozinho na tela da cozinha em até 10 segundos, sem recarregar a página,
   com um destaque de "novo".
3. A cozinha muda a situação: **Recebido → Em preparo → Pronto**.
4. O menu ganha **"Garçom"**. A tela mostra os pedidos **Prontos**, com a mesa em destaque. O
   garçom toca em "Entregue" quando deixa o prato na mesa, e o pedido sai da tela.
5. Pedido entregue sai das telas e fica na consulta de pedidos (US6).
6. Gerente ou chef pode **cancelar** um pedido que ainda não foi entregue, escolhendo o motivo
   (cliente desistiu, produto acabou, pedido indevido, outro). O cliente vê "Cancelado" em "Meus
   pedidos" se o acesso ainda estiver aberto.
7. Pedido com mais de 20 minutos sem ficar pronto aparece marcado como "atrasado" na cozinha.
8. Toda mudança de situação registra quem fez e quando.

### US5 — Marcar um produto como esgotado no cardápio (P2)

Como cozinha, quero tirar um prato do cardápio do cliente quando acabar, sem inativar o produto.

1. Na tela da cozinha e na página do produto, "Esgotado hoje" tira o produto do cardápio na hora.
   "Disponível de novo" devolve.
2. Produto esgotado continua ativo no cadastro e no painel de custos.

### US6 — Ligar e desligar os pedidos pelo QR code e consultar pedidos (P2)

1. O gerente tem a chave "Recebendo pedidos pelo QR code". Desligada (restaurante fechado, por
   exemplo), qualquer QR code mostra "O restaurante não está recebendo pedidos agora. Chame um
   garçom." e nenhum pedido é aceito.
2. A página "Pedidos" lista os pedidos do dia (ou de um período escolhido), com número, mesa,
   horário, situação e total; filtra por mesa e por situação.

## Casos-limite

- QR code de uma mesa de outro restaurante, inventado ou trocado (US1-6): mensagem "QR code
  inválido. Chame um garçom." Nunca revela outro restaurante.
- Mesa inativada ou QR code trocado enquanto o cliente está com o cardápio aberto: o próximo envio
  é recusado com a mensagem da mesa.
- Pedido vazio: o botão "Enviar pedido" fica indisponível.
- Quantidade por linha: número inteiro de 1 a 20. Observação: até 140 caracteres.
- Cardápio sem nenhum produto disponível: "O cardápio está vazio no momento. Chame um garçom."
- Muitos envios seguidos do mesmo acesso (brincadeira ou robô): no máximo 10 pedidos por acesso; o
  seguinte mostra "Chame um garçom para continuar pedindo."
- Produto mudou de versão depois do pedido: o pedido guarda a versão vigente no envio (a 005 baixa
  por ela).
- Cozinha sem internet por alguns minutos: ao voltar, a tela traz tudo que chegou nesse meio tempo.

## Requisitos

- **FR-001** O restaurante cadastra quantas mesas quiser. A mesa tem nome (texto curto, ex.: "12",
  "Varanda 3"), único entre as ativas do restaurante sem diferenciar maiúsculas e acentos, e
  ativa/inativa. Mesa não é apagada; é inativada.
- **FR-002** Cada mesa tem um QR code com um link próprio. O link não pode ser adivinhado a partir
  de outro (não usa número em sequência) e identifica restaurante e mesa. "Trocar QR code"
  invalida o link anterior na hora.
- **FR-003** O QR code pode ser baixado como imagem e impresso em folha (uma mesa ou todas),
  com o nome do restaurante e da mesa.
- **FR-004** O cardápio do cliente abre sem login. Mostra só produtos vendidos, ativos, com preço
  de venda e não esgotados, do restaurante dono da mesa.
- **FR-005** Cada leitura do QR code abre um acesso ao cardápio, ligado à mesa. O acesso fecha 20
  minutos depois da leitura; usar o cardápio não aumenta esse tempo. Acesso fechado não envia
  pedido. O tempo de 20 minutos é fixo nesta versão.
- **FR-006** O pedido guarda: número (sequencial por restaurante, por dia, para chamar na cozinha),
  mesa, data e hora, acesso de origem, situação e as linhas (produto, versão vigente do produto no
  envio, quantidade inteira, preço unitário no envio, observação). O total é a soma de
  quantidade × preço, em decimal exato.
- **FR-007** Envio sem duplicar: repetir o mesmo envio (toque duplo, reenvio após queda) devolve o
  mesmo pedido.
- **FR-008** Situações: Recebido → Em preparo → Pronto → Entregue; Cancelado a partir de qualquer
  situação antes de Entregue, com motivo de lista fechada. Pedido não é apagado nem tem linhas
  alteradas depois de enviado; erro se corrige cancelando.
- **FR-009** A tela da cozinha mostra pedido novo em até 10 segundos sem recarregar.
- **FR-010** Permissões (ver [09-controles-e-permissoes](../../docs/produto/estoque/09-controles-e-permissoes.md)):

  | Ação | Quem pode |
  |---|---|
  | Cadastrar, inativar mesa e trocar QR code; ligar/desligar pedidos | Gerente |
  | Ver e mudar a situação na cozinha; marcar esgotado | Gerente, chef |
  | Ver prontos e marcar entregue | Gerente, chef, garçom |
  | Cancelar pedido | Gerente, chef |
  | Consultar pedidos | Gerente, chef, garçom |

  Entra o papel novo **Garçom**, que só vê as telas "Garçom" e "Pedidos".
- **FR-011** Toda escrita da equipe (mesa, QR code, situação, cancelamento, esgotado, chave de
  pedidos) vai para a trilha de auditoria. O pedido do cliente registra a mesa e o acesso de origem
  (não há usuário).
- **FR-012** Isolamento por restaurante: o cardápio público, os pedidos e as telas nunca mostram ou
  aceitam dados de outro restaurante.
- **FR-013** Textos ao cliente curtos, em português, legíveis no celular, sem termos internos
  (sem "versão", "ficha técnica", "sessão").

## Entidades

- **Mesa**: nome, ativa/inativa, link atual do QR code, restaurante.
- **Acesso ao cardápio**: mesa, quando abriu, fecha em (abriu + 20 minutos); termina por tempo
  ou por nova leitura no mesmo celular.
- **Pedido**: número do dia, mesa, acesso de origem, data e hora, situação, motivo de cancelamento,
  total.
- **Linha do pedido**: produto, versão do produto, quantidade, preço unitário, observação.
- **Disponibilidade do produto**: produto esgotado ou disponível (no restaurante).
- **Configuração do restaurante**: recebendo pedidos pelo QR code (sim/não).

## Critérios de sucesso

- **SC-001** Um cliente que nunca usou o sistema faz o primeiro pedido em menos de 2 minutos depois
  de escanear, sem ajuda do garçom.
- **SC-002** 100% dos pedidos enviados aparecem na cozinha com a mesa certa; nenhum duplicado.
- **SC-003** Pedido novo aparece na cozinha em até 10 segundos em 95% dos casos.
- **SC-004** Nenhum pedido é aceito de acesso expirado, mesa inativa, QR code trocado ou com os
  pedidos desligados.
- **SC-005** O cardápio abre em menos de 3 segundos num celular comum em rede móvel (4G), com 200
  produtos.
- **SC-006** O dono cadastra 30 mesas e imprime todos os QR codes em menos de 5 minutos.

## Premissas

- Os 20 minutos contam da leitura do QR code no celular do cliente, sem renovação (decisões do dono
  em 2026-11-08).
- O pedido vai direto para a cozinha, sem o garçom confirmar antes. O controle contra pedido
  indevido é: QR code trocável, acesso de 20 minutos, limite por acesso, chave de desligar e
  cancelamento pela cozinha.
- O cardápio mostra nome e preço, em ordem alfabética. Categorias, foto e descrição ficam para
  depois.
- Quantidade é inteira (o cliente pede unidades do produto).
- A cozinha usa uma tela (computador ou tablet) com login de chef ou gerente; o garçom usa o
  celular com login de garçom.
- Não há impressora de cozinha nesta versão.

## Fora do escopo

Baixa do estoque (feature 005, que passa a usar estes pedidos), conta da mesa, pagamento e
divisão da conta, gorjeta, chamar garçom pelo app, delivery e retirada, adicionais e opções de
produto (ponto da carne, tamanhos), categorias e fotos no cardápio, impressora de cozinha,
integração com PDV, nota fiscal, relatório de vendas.

## Decisões

| Data | Pergunta | Decisão |
|---|---|---|
| 2026-11-08 | Como contam os minutos do cardápio aberto? | Desde a leitura do QR code, no celular do cliente; usar o cardápio não renova |
| 2026-11-08 | Quanto tempo o cardápio fica aberto? | 20 minutos (o pedido original falava em 10; o dono mudou depois de decidir a regra) |
