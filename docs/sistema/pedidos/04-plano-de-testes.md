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
| E | Garçom vê só Garçom e Pedidos; QR code de outro restaurante abre só o cardápio dele (`ordering.spec.ts`) |
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
