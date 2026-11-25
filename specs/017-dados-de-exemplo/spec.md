# Spec 017 — Restaurante de exemplo no banco (`pnpm db:seed`)

**Pedido do dono (2026-11-25)**: "povoa esse banco que tá no meu Docker como se fosse um dono de
restaurante mesmo". O banco de desenvolvimento nasce vazio; para ver as telas, relatórios e gráficos
com cara de uso real, alguém teria de cadastrar tudo e lançar semanas de movimento à mão.

## O que muda para quem usa

Um comando de desenvolvimento, `pnpm db:seed`, enche o banco local com um restaurante plausível, o
**Restaurante Sabor da Serra** (comida caseira: executivo no almoço, lanches, porções e chope à
noite), como se o dono usasse o sistema há algumas semanas.

## Histórias

- **US1 — Restaurante novo de exemplo.** `pnpm db:seed` cria o login do dono
  (`dono@sabordaserra.com.br`, senha `sabor12345`) e o restaurante com tudo: equipe, estoque,
  fornecedores, fichas técnicas, cardápio com fotos, mesas e o movimento dos últimos 28 dias.
- **US2 — Povoar a minha conta.** `pnpm db:seed teste@teste.com` povoa o restaurante de uma conta que
  já existe (criada pela tela), sem trocar nome nem senha do dono. A equipe ganha e-mails no domínio
  do dono (`garcom@teste.com`, …) com a mesma senha de exemplo.
- **US3 — Rodar de novo não estraga.** Se o restaurante já foi povoado, o comando avisa e não grava
  nada. Restaurante que já tem pedido ou movimento de estoque, ou caixa aberto, não é povoado.

## O que entra

| Área | Conteúdo |
|---|---|
| Equipe | Dono (gerente), chef e cozinheira, dois garçons, caixa e estoquista/comprador, convidados e aceitos pelo fluxo de convite |
| Estoque | ~50 itens na árvore padrão, com embalagem, aviso de reposição ("avisar em" e "comprar até") |
| Fornecedores | 7, com CNPJ, contato, dias de entrega e o preço da embalagem de cada item |
| Fichas técnicas | 5 preparos (arroz, feijão, molho, vinagrete, farofa) e 27 produtos vendidos |
| Cardápio | 7 seções, preço, descrição e foto de cada produto, logo e capa; adicionais e retiradas nos lanches |
| Mesas | 12, com QR code |
| Movimento | Fechado na segunda; almoço todo dia e jantar de terça a sábado. Compras nos dias de entrega até o "comprar até", perdas, acerto de contagem semanal aprovado pelo dono, pedidos lançados pelos garçons, cozinha, entrega, pagamento (Pix, cartões, dinheiro, conta dividida), caixa aberto, sangria e fechado com contagem |
| Hoje | Caixa aberto e mesas ocupadas com pedidos em cada etapa da cozinha, até a hora em que o comando roda |

## Regras

- Tudo passa pelos casos de uso do app (permissões, RLS, auditoria, custo médio, baixa do estoque
  pela ficha técnica); nada de SQL direto. As datas vêm de um relógio que o povoamento avança.
- Mesmo resultado a cada execução (sorteios com semente fixa), a não ser pela data de hoje.
- Saldo de estoque nunca negativo: comprou antes de faltar.
- Só para desenvolvimento: usa o `.env.local` como os outros `db:*`.

## Fora do escopo

Pedidos pelo QR code e tablet (os garçons lançam tudo), contas reabertas, produção de preparos.
