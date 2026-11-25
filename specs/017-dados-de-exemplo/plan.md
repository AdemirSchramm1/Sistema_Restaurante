# Plano — 017 Restaurante de exemplo

## Onde fica

| Arquivo | Papel |
|---|---|
| `src/application/demo/catalog.ts` | Só dados: restaurante, equipe, fornecedores, itens, preparos, produtos, seções, adicionais |
| `src/application/demo/seed.ts` | Monta o restaurante e o histórico chamando os casos de uso; recebe um relógio ajustável e quem desenha as fotos |
| `src/application/demo/history.ts` | O dia a dia: compras, salão, cozinha, contas e caixa, em ordem de horário |
| `src/application/demo/random.ts` | Sorteio com semente fixa (mulberry32) |
| `src/infra/demo/artist.ts` | Ilustrações dos pratos, logo e capa em SVG, rasterizadas com sharp |
| `scripts/db-seed.mts` | Comando: lê `.env.local`, monta as dependências como o servidor e imprime os logins |

## Decisões

- **Casos de uso, não SQL.** O povoamento é um usuário do sistema: cada passo passa por
  `authorize`, pelo RLS do papel `app_user` e grava auditoria. Os custos (custo médio, CMV, baixa
  pela ficha técnica) saem iguais aos de uso real.
- **Relógio ajustável.** Todos os casos de uso leem a hora de `deps.clock`; o povoamento move esse
  relógio para cada evento do dia (pedido às 12:10, pronto às 12:28, pagamento às 13:05…). Os
  eventos de todas as mesas do dia entram numa fila ordenada por horário, então mesas se sobrepõem
  como no salão de verdade.
- **Estoque sem faltar.** Toda manhã, o comprador compra até o "comprar até" o que está abaixo do
  aviso, do fornecedor que entrega naquele dia; o que ainda está perto de acabar vai do mercado
  (sem fornecedor, 15% mais caro). Antes do primeiro dia, compra de abertura de tudo.
- **Conta de caixa exata.** O povoamento soma o dinheiro que entrou (pagamentos em dinheiro e
  reforços, menos sangrias) para a contagem cega bater; de vez em quando falta ou sobra uns
  centavos, com observação, como acontece.
- **Idempotente pelo fornecedor marcador.** Se o restaurante já tem o "Hortifrúti Vale Verde", já foi
  povoado.

## Testes

`tests/integration/demo/seed.test.ts`: restaurante novo com 3 dias (domingo, segunda fechada,
terça e hoje até 20:00), segunda execução sem duplicar, conta existente pelo e-mail e conta
inexistente. Fotos de teste: uma imagem lisa, para o teste não gastar tempo desenhando.
