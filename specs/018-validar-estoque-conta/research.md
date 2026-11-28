# Pesquisa: 018 — Validar o estoque, a conta e o pedido

## R1 Mutação em todo o domínio

- **Decisão**: `stryker.config.json` muta `src/domain/**/*.ts` (menos `*.test.ts`) e
  `vitest.stryker.config.mts` inclui `src/domain/**/*.test.ts`. Na CI, o teste de mutação sai do
  job `unidade` e vira o job `mutacao` com 2 partes paralelas, cada uma com `--mutate` de uma
  metade das pastas (`inventory` + `shared` + `suppliers`; `billing` + `ordering` + `menu` +
  `cash` + `access`). Régua `break: 100` nas duas.
- **Motivo**: rodado aqui em 2026-11-26, os 2.314 mutantes novos levaram 2 min 14 s com 4
  processos. Somados aos que já existem, uma parte só passaria dos ~5 min por job de
  `06-ci-cd.md`.
- **Alternativas**: só os arquivos de dinheiro (deixa `item.ts`, `recipe.ts` e `movement.ts` fora,
  e eles decidem saldo e custo); `--incremental` com cache (a CI usa build limpo e o cache esconde
  mutantes novos).

## R2 Portões de cobertura por área

- **Decisão**: três modos novos no `vitest.config.mts` (`billing`, `stock`, `orders`), iguais a
  `cashCoverage` e `staffCoverage`: lista de arquivos, `thresholds` de 100 em linhas, desvios,
  funções e instruções, `reportsDirectory` próprio. Scripts filtram os testes pela área
  (`vitest run --mode billing --coverage billing tab payment split service-charge`, etc.).
- **Motivo**: é o padrão que a equipe já conhece e que a CI já roda; cada portão diz qual área
  quebrou.
- **Alternativas**: subir os `thresholds` globais para 100 (quebra `access`, fora da spec, e não diz
  qual área falhou); um portão só (lento e sem dono claro).

## R3 Integração em partes paralelas

- **Decisão**: `integracao` vira matriz com 5 partes, cada uma com o seu serviço PostgreSQL:
  `menu` (como hoje, roda a suíte inteira), `cash-staff`, `billing`, `stock`, `orders`.
- **Motivo**: a suíte inteira com cobertura levou ~9 min aqui; somar 3 portões em série passaria do
  limite. Em paralelo, o tempo total do job fica o da parte mais lenta.
- **Alternativas**: um portão só com tudo (um job longo).

## R4 Textos e códigos de erro

- **Decisão**: mutante que troca um código de erro ou o campo (`err("INVALID_AMOUNT", "remaining")`)
  morre com teste que confere `{ code, field }`. Textos que aparecem na tela (árvore padrão de
  grupos, motivos de perda, rótulos do histórico) morrem com uma tabela no teste com o texto
  esperado de cada um, tirada de `docs/produto/`.
- **Motivo**: o código escolhe a mensagem que a pessoa lê e o campo onde ela aparece; um texto
  trocado é erro visível.
- **Alternativas**: `ignoreStatic`/desligar `StringLiteral` (afrouxa a régua: proibido pela FR-005).

## R5 Telas

- **Decisão**: `tests/screens/operations.spec.ts`, no padrão de `cash.spec.ts`: Cozinha em
  `tablet-em-pe`, `tablet-deitado`, `computador`; Garçom em `celular-pequeno`, `celular-android`,
  `celular-iphone`, `tablet-em-pe`; Conta da mesa e Lançamentos em `celular-android`, `tablet-em-pe`,
  `tablet-deitado`, `computador`; claro e escuro; `expectNoSideScroll`, `expectNoClippedText`,
  `expectTapTargets`, `seriousViolations`. Sem imagem de referência (horários mudam). Na CI, a
  parte `resto` de `telas` é dividida em `operacoes` e `resto`.
- **Motivo**: mesmas checagens que já acharam erros reais na 013 a 016; tamanhos de quem usa cada
  tela (nomes exatos conferidos em `tests/screens/matrix.ts` na implementação).
- **Alternativas**: os 9 tamanhos em todas (cozinha em celular não é uso real e dobra o tempo).

## R6 Quando o teste mostra erro do sistema

- **Decisão**: (1) commit `test(018): … (vermelho)` reproduzindo; (2) `fix(018)` no código;
  (3) linha em `mutants.md` e na descrição do PR com antes e depois. Se a correção muda algo que a
  pessoa vê de um jeito que `docs/produto/` não descreve, parar e perguntar ao dono.
- **Motivo**: regra do dono (2026-11-22): testes guardam o app; quando falha, checar o app primeiro.

## R7 Mutante equivalente

- **Decisão**: reescrever a expressão para uma forma sem equivalente (por exemplo, `<=` que nunca
  vê o valor igual vira `<` com teste do limite, ou a condição repetida sai). Nenhum comentário
  `Stryker disable`.
- **Motivo**: a régua das specs 013 a 016 chegou a 100% assim.

## R8 Registros

- **Decisão**: `mutants.md` agrupa os sobreviventes por arquivo com a decisão (falta de teste, erro
  do sistema, código removido). `rules.md` lista cada regra de `docs/produto/estoque/` e
  `docs/produto/pedidos/01` a `05` e o nome do teste que a prova.
- **Motivo**: torna a US5 e a FR-007 verificáveis por quem revisa o PR.
