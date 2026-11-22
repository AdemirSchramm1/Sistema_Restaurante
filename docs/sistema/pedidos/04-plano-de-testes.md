# Pedidos — Plano de testes

Legenda: **U** = unidade (domínio e componentes), **I** = integração (banco real), **E** = ponta a
ponta (Playwright). Testes escritos antes do código ([TDD](../01-tdd.md)).

## 009 — Pedidos pelo QR code da mesa

| Nível | Teste |
|---|---|
| U | Nome da mesa (1 a 30, normalizado) e faixa "Criar várias mesas" (`table-name`) |
| U | Acesso: 20 minutos, tolerância de 15 s, aviso de 2 minutos (`menu-access`) |
| U | Cardápio: só vendidos, ativos, com preço e não esgotados hoje; ordem alfabética (`menu`) |
| U | Dia do restaurante no fuso (`business-day`) |
| U | Forma do pedido: quantidade, 30 linhas, 10 pedidos por acesso, total exato (`order-lines`) |
| U | Conferência do envio: indisponível, preço mudou com os preços novos (`checkout`) |
| U | Situações, cancelamento com motivo, atrasado (`order`) |
| U | Permissões novas e papel Garçom; menu por permissão |
| U | Componentes: cartão da mesa, faixa de mesas, carrinho (toque duplo, preço mudou), tempo do acesso, meus pedidos, quadro da cozinha, prontos |
| I | Esquema: tabelas, checks, triggers só de inserção, funções `SECURITY DEFINER` (`schema`) |
| I | Isolamento: A não lê nem grava mesas, acessos e pedidos de B (`isolation`) |
| I | Mesas: criar, faixa, renomear, inativar, trocar QR code, auditoria sem token (`tables`) |
| I | Rota pública: token inválido, mesa inativa, chave desligada, cookie, encerra acesso anterior (`public-route`, `menu-access`) |
| I | Envio: sem duplicar (inclusive concorrente), número do dia, preço e disponibilidade, acesso vencido (`submit-order`) |
| I | Cardápio e "Meus pedidos" só do acesso (`menu`) |
| I | Cozinha e garçom: transições, `STALE_RECORD`, cancelamento, eventos com quem e quando (`kitchen`) |
| I | Esgotado hoje volta no dia seguinte; auditoria (`sold-out`) |
| I | Chave do restaurante e consulta por período, mesa e situação (`orders`) |
| E | Roteiro do quickstart: mesas, QR code, celular, cozinha, garçom, esgotado, 20 minutos, troca do QR code, chave (`ordering.spec.ts`) |
| E | Garçom vê Garçom, Caixa (só para ver a conta, 011) e Pedidos; QR code de outro restaurante abre só o cardápio dele (`ordering.spec.ts`) |
| E | Acessibilidade (axe, WCAG 2.1 AA): cardápio, tela do prato, resumo, cozinha, garçom, mesas, adicionais, pedidos (`accessibility.spec.ts`) |

O teste ponta a ponta dos 20 minutos recua `opened_at` e `expires_at` no banco (com
`DATABASE_MIGRATION_URL`, como na CI): o servidor usa o próprio relógio.

## 010 — Adicionar e tirar por botão

| Nível | Teste |
|---|---|
| U | Adicional: nome, componente, medida da mesma família, preço zero = Grátis (`addon`) |
| U | Quadro: limites, texto padrão "Sem …", preço da linha, escolha válida, texto da cozinha (`customization`) |
| U | Consumo da linha com o exemplo da spec (`consumption`) |
| U | Componentes: formulário do adicional, quadro do produto, tela do prato só com botões, mudanças da linha |
| I | Adicionais: criar, mudar, inativar, `NAME_IN_USE`, custo e faixa, chef só lê (`addons`) |
| I | Quadro do produto: salvar, trava otimista, retirada órfã, auditoria legível (`customization`) |
| I | Envio com adicionais e retiradas, preço do adicional mudou, opção indisponível (`submit-order`) |
| I | Consumo de um pedido gravado pela versão do envio, não a atual (`consumption`) |
| E | Cadastrar adicional, ligar ao produto, personalizar no celular, ver na cozinha, preço mudado no meio (`ordering.spec.ts`) |

## 011 — Conta da mesa e baixa do estoque

| Nível | Teste |
|---|---|
| U | Totais da conta, taxa com meio centavo para cima, taxa do restaurante de 0 a 20% (`tab`, `service-charge`) |
| U | Pagamento: valor, até o que falta, recebido e troco só no dinheiro (`payment`) |
| U | Dividir por 2 a 20 com os centavos na 1ª parte, soma igual ao que falta (`split`) |
| U | Fechar só com falta zero e tudo entregue, com todos os motivos; motivo da reabertura; resumo por forma (`tab`) |
| U | Cancelar depois do preparo pergunta pelos ingredientes (`order`); papel Caixa e ações `tab.*`; menu do caixa e do garçom |
| U | Componentes: Caixa, conta, conta impressa, taxa (tirar com confirmação), pagamento com troco, divisão, fechar com os motivos, pagamentos tirados, contas fechadas e reabrir; pergunta dos ingredientes na cozinha; mensagens de erro com valores |
| I | Esquema: uma conta aberta por mesa, checks dos valores, triggers só de inserção, pedido não troca de conta, venda uma vez por pedido e item (`billing/schema`) |
| I | Isolamento: A não lê nem muda contas, pagamentos e histórico de B (`billing/isolation`) |
| I | Conta abre com o pedido, com a taxa de agora; envios simultâneos abrem uma conta só (`billing/tab-open`) |
| I | Caixa e conta: totais, cancelado fora do total, garçom vê a aberta e não a fechada, auditoria de negados (`billing/tabs`, `billing/history`) |
| I | Taxa: configurar com auditoria, tirar e pôr de volta, recusa quando o pago passaria do total (`billing/service-charge`) |
| I | Pagamentos: até o que falta, troco, toque duplo, duas telas ao mesmo tempo, tirar com histórico (`billing/payments`) |
| I | Fechar: motivos, versão (`STALE_RECORD` com pedido chegando junto), mesa liberada, cardápio aberto avisa, próxima conta nova (`billing/close`) |
| I | Contas fechadas por dia local, mesa e período; resumo sem os tirados; reabrir com motivo, só gerente, mesa com outra conta (`billing/history`) |
| I | Baixa ao começar o preparo, uma vez só, saldo negativo, sem custo, versão do envio, falha desfaz tudo (`billing/sale`, `billing/sale-report`) |
| I | Cancelar depois do preparo: pergunta, estorno, perda "Pedido cancelado", corrida de dois cancelamentos (`billing/cancel-stock`) |
| E | Roteiro do quickstart: celular, cozinha, garçom e caixa; divisão por 3, troco, fechar, cardápio fechado, conta nova, contas do dia, cancelar depois do preparo, reabrir recusado, outro restaurante (`billing.spec.ts`) |
| E | Garçom vê Caixa, mas não as contas fechadas (`ordering.spec.ts`) |
| E | Acessibilidade (axe): Caixa, conta, conta impressa, contas fechadas, reabrir e a pergunta dos ingredientes na cozinha (`accessibility.spec.ts`) |

## 016 — Cardápio com a cara do restaurante e tablet fixo na mesa

| Camada | Testes |
|---|---|
| Domínio | `menu-layout`, `quick-add`, `photo` (formatos LOGO e COVER), `cover-overlay` (contraste), `tablet-signal`, `tablet-screen` |
| Integração | `tablet-schema`, `tablet-repository`, `tablet-link`, `tablet-bind` (20 rodadas de dois aparelhos), `tablet-menu`, `tablet-submit` (11 pedidos, corrida com fechar a conta), `tablet-status`, `tablet-orders`, `audit/tablet-audit` (sem token), `menu/appearance`, `performance/tablet-status` (60 tablets), `performance/indexes` |
| Componentes | `product-card`, `section-bar`, `cart-bar`, `cart-panel`, `menu-header`, `appearance-form`, `table-tablet-card`, `tablet-welcome`, `still-there`, `tablet-shell` (relógio falso), `tablet-preview`, `preview-frame` |
| Telas | `customer-menu.spec.ts` (carrinho à vista por layout), matriz por `menuLayout` |
| Ponta a ponta | `tests/e2e/tablet.spec.ts` (ligar, pedir, 3 min, 30 s, 12 h, liberar, trocar) e `accessibility.spec.ts` |
