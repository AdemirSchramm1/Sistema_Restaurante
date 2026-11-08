# Quickstart: validar a 009 — Pedidos pelo QR code da mesa

Roteiro para provar, de ponta a ponta, que a feature funciona. Regras em [spec.md](spec.md),
tabelas em [data-model.md](data-model.md), erros em [contracts/](contracts/).

## Pré-requisitos

- `pnpm install`, Docker rodando, `.env` copiado de `.env.example`.
- `pnpm db:up && pnpm db:migrate` (inclui `0009_ordering`).
- `pnpm db:dev-login` para ter um restaurante com gerente; convidar um chef e um garçom pela tela
  "Equipe".
- Dois produtos vendidos com preço (ex.: X-Burger R$ 28,00 e Suco R$ 9,00) e um preparo.

## Testes automáticos

```bash
pnpm test:unit          # domínio: acesso, situações, linhas, preço, cardápio, permissões
pnpm test:integration   # banco real: mesas, rota pública, envio, cozinha, isolamento
pnpm test:e2e           # Playwright: celular emulado + cozinha + garçom; acessibilidade do cardápio
```

O relógio dos testes de integração e e2e é controlado (porta `Clock`), para passar dos 20 minutos
sem esperar.

## Roteiro manual

| # | Passo | Esperado |
|---|---|---|
| 1 | Gerente: Pedidos → Mesas → "Criar várias mesas" de 1 a 10 | "10 mesas criadas" |
| 2 | Criar "5" de novo | "Já existe uma mesa com esse nome" |
| 3 | "Imprimir todos" | Folha com 10 QR codes, nome do restaurante e "Mesa N" |
| 4 | Escanear o QR da mesa 5 com o celular (ou abrir `/m/{token}` com o navegador em modo celular) | Cardápio com "Mesa 5", sem login; X-Burger e Suco; preparo não aparece |
| 5 | Pôr 2 X-Burger com o botão "Sem cebola" (010) e 1 Suco; "Enviar pedido" → confirmar | "Pedido enviado para a cozinha", número 1, total R$ 65,00 |
| 6 | Tocar duas vezes em "Confirmar" num segundo pedido | Só um pedido novo |
| 7 | Chef: Pedidos → Cozinha (outra janela aberta antes do passo 5) | Pedido da mesa 5 aparece sozinho em até 10 s, com "SEM cebola" embaixo do X-Burger |
| 8 | Chef: "Em preparo" e depois "Pronto" | Celular mostra a situação em "Meus pedidos" |
| 9 | Garçom: Pedidos → Garçom | Pedido pronto com "Mesa 5"; "Entregue" tira da tela |
| 10 | Gerente muda o preço do Suco para R$ 10,00 com um Suco no carrinho do celular; enviar | "O preço de Suco mudou para R$ 10,00" e nova confirmação |
| 11 | Chef marca X-Burger "Esgotado hoje" | Some do cardápio na próxima atualização; envio com ele avisa "não está mais disponível" |
| 12 | Avançar o relógio 20 min (ou esperar) e tocar no cardápio | "Seu tempo acabou. Escaneie o QR code da mesa de novo…"; envio recusado |
| 13 | Escanear de novo | Novo acesso de 20 minutos; pedidos antigos seguem na cozinha |
| 14 | Gerente: "Trocar QR code" da mesa 5 e abrir o link antigo | "QR code inválido. Chame um garçom." |
| 15 | Gerente desliga "Recebendo pedidos pelo QR code" e escaneia qualquer mesa | "O restaurante não está recebendo pedidos agora…" |
| 16 | Garçom tenta abrir `/estoque/itens` | Sem acesso; menu mostra só Garçom e Pedidos |
| 17 | Abrir o link de uma mesa do restaurante B estando logado no A | Cardápio do B; nada do A aparece; pedido cai só na cozinha do B |

## Conferência no banco

- `order_lines` e `order_status_events` recusam `UPDATE` e `DELETE` (`APPEND_ONLY`).
- Cada pedido tem `recipe_version_id` da versão mais nova no envio.
- Com `app.restaurant_id` de A, `select * from orders` não traz pedidos de B.
