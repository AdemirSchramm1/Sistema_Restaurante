# Dados de exemplo (`pnpm db:seed`)

Origem: spec [017](../../specs/017-dados-de-exemplo/spec.md). Só para desenvolvimento: enche o banco
local com o **Restaurante Sabor da Serra** e algumas semanas de movimento, para ver telas,
relatórios e gráficos com cara de uso real.

## Como rodar

```bash
pnpm db:up && pnpm db:migrate && pnpm db:dev-login   # banco pronto, como sempre
pnpm db:seed                    # restaurante novo, login dono@sabordaserra.com.br / sabor12345
pnpm db:seed teste@teste.com    # ou: povoa o restaurante de uma conta criada pela tela
pnpm db:seed --dias 14          # histórico mais curto (padrão 28 dias; demora uns minutos)
```

O comando imprime os logins no fim. A equipe (chef, cozinheira, dois garçons, caixa e estoquista)
usa o domínio do e-mail do dono (`garcom@sabordaserra.com.br`, `caixa@teste.com`…) e a senha
`sabor12345`. As fotos vão para a pasta `MENU_PHOTO_DIR` (`.menu-photos`).

Rodar de novo no mesmo restaurante não muda nada ("já foi povoado"). Restaurante com pedido,
estoque ou caixa já lançados, ou com o caixa aberto, não é povoado. Para recomeçar do zero, apague o
banco (`docker compose down -v`) e rode `db:up`, `db:migrate`, `db:dev-login` e `db:seed`.

## Como funciona

| Arquivo | Papel |
|---|---|
| `src/application/demo/catalog.ts` | Só dados: equipe, fornecedores, itens, preparos, produtos, seções, adicionais |
| `src/application/demo/seed.ts` | Conta, equipe (convite + aceite), cadastros e cardápio |
| `src/application/demo/history.ts` | O dia a dia: compras, salão, cozinha, contas, caixa, perdas e contagem |
| `src/application/demo/random.ts` | Sorteio com semente fixa: a mesma execução dá o mesmo restaurante |
| `src/infra/demo/artist.ts` | Ilustrações (SVG → JPEG com sharp) dos pratos, do logo e da capa |
| `scripts/db-seed.mts` | Lê o `.env.local`, monta as dependências como o servidor e imprime os logins |

- **Só casos de uso.** Nada de SQL direto: cada passo passa por permissão, RLS (login `app_login`),
  auditoria e pelas regras de custo e de baixa do estoque, como um usuário de verdade.
- **Relógio ajustável.** O povoamento troca o `clock` das dependências e o leva ao horário de cada
  evento. Os eventos do dia (mesas chegando, cozinha, pagamento, sangria, fechamento) ficam numa fila
  por horário, então as mesas se sobrepõem como no salão. O que cairia depois de agora não acontece:
  hoje fica com o caixa aberto e mesas no meio do atendimento.
- **Semana.** Fechado na segunda (dia da contagem: o estoquista conta três itens e o dono aprova o
  acerto). Almoço todos os outros dias; jantar de terça a sábado, cheio na sexta e no sábado.
- **Compras.** Antes do primeiro dia, compra de abertura até o "comprar até". Toda manhã o comprador
  compra do fornecedor que entrega naquele dia o que está abaixo do aviso (ou abaixo de 2,5 dias do
  maior consumo visto); fora do dia de entrega, o que pode faltar vai do mercado do bairro, 15% mais
  caro. O saldo nunca fica negativo.
- **Caixa.** Abre às 11:00 com R$ 200,00, sangria para o cofre à tarde, contagem cega no fim do dia
  (às vezes falta ou sobra um troco, com observação) e fica R$ 200,00 para o dia seguinte.

Teste: `tests/integration/demo/seed.test.ts` (3 dias, com uma foto lisa no lugar das ilustrações).
