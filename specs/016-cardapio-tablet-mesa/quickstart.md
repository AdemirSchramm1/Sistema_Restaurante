# Quickstart: validar a 016

Roteiro para conferir a feature de ponta a ponta. Ambiente como na
[013](../013-editar-cardapio/quickstart.md) (`pnpm dev`, banco local com `pnpm db:up`, seed com um
restaurante, fotos com `MENU_PHOTOS=file`). Em sessão na nuvem, ligar o Docker antes do
`pnpm db:up`. Para o tablet, um segundo navegador (ou uma janela anônima) faz o papel do "outro
aparelho".

## Preparação

1. Seções Lanches (12 pratos, com foto) e Bebidas. X-Burger a R$ 30,00 com "Fatia de queijo" a
   R$ 2,00 (até 3) e "Sem cebola"; Suco a R$ 9,00 sem adicionais nem retiradas.
2. Mesas 4 e 12 ativas. Taxa de serviço desligada.
3. Usuários: gerente, chef e caixa.
4. Fotos de teste de `tests/screens/photos/`: `logo.png` (400 × 400), `capa.jpg` (1920 × 640),
   `logo-pequeno.png` (150 × 150).

## Roteiro

| # | Passo | Esperado |
|---|---|---|
| 1 | Chef abre **Cardápio** | Não vê o quadro **Aparência** |
| 2 | Gerente abre **Cardápio** → **Aparência**, envia `logo-pequeno.png` | "O logo precisa ter pelo menos 200 px no lado menor."; nada muda |
| 3 | Envia `logo.png` e `capa.jpg` | Recorte mostrado antes de salvar; depois, o logo quadrado e a capa no quadro |
| 4 | **Ver como o cliente** no tamanho celular | Topo de 120 px com a capa escurecida, logo, nome e "Mesa 12"; Lanches em linhas com foto à esquerda; pelo menos 4 pratos inteiros na tela (SC-001) |
| 5 | Lê o QR da Mesa 12 num celular de 390 px; toca **+** no Suco | "Suco no carrinho"; barra "Ver pedido · 1 item · R$ 9,00"; nenhum cartão escondido atrás dela |
| 6 | Toca **+** no X-Burger | Abre a tela do prato (tem adicionais) |
| 7 | Abre o mesmo QR num navegador de 1024 × 768 e põe X-Burger + 2 Fatia de queijo, sem cebola, e 1 Suco | 3 colunas e o carrinho ao lado: as duas linhas, "+ 2 Fatia de queijo", "SEM cebola", total R$ 43,00 e **Enviar pedido** visíveis sem rolar (SC-002) |
| 8 | Gerente: **Mesas** → Mesa 12 → **Tablet da mesa** → **Criar link do tablet** | Link `/t/…`, **Copiar**, QR code do link, "Nenhum tablet ligado" |
| 9 | Abre o link no navegador A (o tablet) | Boas-vindas com capa, logo, "Mesa 12" e **Ver o cardápio**; tela Mesas: "Tablet ligado desde …", "1 mesa com tablet ligado" (SC-003) |
| 10 | Abre o mesmo link no navegador B | "Este link já está ligado em outro tablet. Peça ao gerente para liberar."; sem cardápio |
| 11 | No A: **Ver o cardápio**, 1 Suco, **Enviar pedido**, confirma | "Pedido enviado para a cozinha" por 10 s e volta ao cardápio vazio; sem "Faltam N min" |
| 12 | Chef: **Cozinha** | Pedido da "Mesa 12 · tablet" |
| 13 | No A: 2 pratos no carrinho e nenhum toque por 3 min (relógio do navegador adiantado no teste) | "Ainda está aí? Seu pedido não foi enviado."; 30 s depois, boas-vindas e carrinho vazio |
| 14 | No A: **Pedidos enviados** | Os pedidos da conta aberta da Mesa 12, inclusive o do QR do passo 7 |
| 15 | Caixa fecha a conta da Mesa 12 | Em até 10 s o A volta às boas-vindas; **Pedidos enviados** vazio (SC-005); o tablet continua ligado |
| 16 | Gerente inativa a Mesa 12 | O A mostra "Esta mesa não está recebendo pedidos. Chame um garçom."; reativar volta sozinho |
| 17 | Gerente troca o nome para "Mesa 12 varanda" | O A mostra o nome novo em até 10 s |
| 18 | Desliga o Wi-Fi do A | "Sem conexão com o restaurante. Chame um garçom." por cima; liga de novo e volta com o carrinho como estava |
| 19 | Recarrega a página no A | Boas-vindas da mesma mesa, sem pedir nada ao gerente |
| 20 | Gerente: **Liberar** | O A mostra "Este tablet foi desligado. Peça ao gerente."; o B abre o link e liga |
| 21 | Gerente: **Trocar link** | O B mostra "Link inválido. Chame um garçom." depois da próxima checagem; o link antigo dá a mesma mensagem; o novo liga no A |
| 22 | Desliga o B sem liberar e espera 10 min (relógio adiantado) | Tela Mesas: "Sem sinal há 10 min" em destaque |
| 23 | Auditoria do restaurante | Logo, capa, criar link, ligado, liberado e trocado, com quem e quando; nenhum código de link no histórico |
| 24 | Chef tenta abrir **Tablet da mesa** pelo endereço | Sem permissão; `DENIED` na auditoria |

## Testes automáticos

```bash
pnpm test:unit                     # domínio e componentes, com cobertura
pnpm test:integration              # integração com Postgres em container
pnpm test:menu                     # cobertura 100% do cardápio (013), agora com os arquivos novos
pnpm test:mutation                 # Stryker 100% nos arquivos do cardápio e do tablet
pnpm test:e2e --trace off          # roteiro acima, com page.clock para os 3 min e as 12 h (SC-004)
pnpm build && pnpm test:screens    # matriz de telas, 9 tamanhos × claro e escuro × Chromium e WebKit
```

O SC-004 é um teste ponta a ponta com o relógio do navegador adiantado 12 horas em passos de
10 minutos (a checagem do tablet roda em cada passo) e um envio no fim.
