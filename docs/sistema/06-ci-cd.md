# CI/CD e pull requests

Regras para todo PR deste repositório. Quem abre ou atualiza um PR (pessoa ou agente) lê este
arquivo antes. Origem: o pedido do dono do projeto em 2026-11-16 ("os PRs demoram demais no CI") e
a reforma do CI no PR #25, que levou a esteira de 35 min para cerca de 5 min sem tirar teste.

O foco é o software funcionar, não o teste passar. TDD continua obrigatório
(`01-tdd.md`), mas valores fixos e testes pragmáticos são bem-vindos quando deixam o teste mais
rápido e mais estável.

## 1. PRs pequenos

PR grande demora mais no CI e na revisão. Por isso:

- **Uma feature por PR**, nunca duas features no mesmo PR.
- **Feature grande vira vários PRs**, um por fatia que funciona sozinha, na ordem do `tasks.md`:
  1. base: domínio, migração, permissões e repositórios, com os testes deles;
  2. uma história de usuário (ou um grupo pequeno delas) por PR, com telas e testes;
  3. por último, ponta a ponta, imagens de referência e documentação que fecham a feature.
- Referência de tamanho: até uns **40 arquivos ou 3.000 linhas** por PR, sem contar imagens de
  referência e `meta/*_snapshot.json`. Passou disso, divida.
- Cada PR precisa deixar a `main` verde e utilizável sozinho. Tela nova sem caminho no menu pode
  entrar antes; regra que quebra tela antiga entra junto com o ajuste dessa tela.
- Feature que depende de outra ainda aberta espera o merge dela; não empilhe PR em cima de PR
  aberto.

## 2. Como o CI roda (`.github/workflows/ci.yml`)

- Todos os jobs rodam **em paralelo**: `estatico` (formato, lint, tipos), `unidade`,
  `integracao` (cobertura do cardápio, do caixa e do garçom), `e2e` e `telas` (Chromium e WebKit,
  cada um em 3 partes).
- **Filtro de caminho:** PR só de documentação (`*.md`, `docs/`, `specs/`, `.specify/`) roda só o
  `estatico`, em cerca de 1 minuto.
- **Commit novo cancela a rodada anterior** do mesmo PR (`concurrency`).
- Dependências vêm do cache do pnpm; fila e instalação levam segundos. Se um job ficar lento,
  abra o log, veja qual passo come o tempo e corrija ali (dividir o job, cortar trabalho repetido),
  em vez de cortar teste.
- Novo portão de cobertura (como `test:cash`) entra no job `integracao`; não crie job em série.

## 3. Antes de enviar

Rode localmente o que o PR mexeu, do mais rápido para o mais lento:

1. `pnpm format:check && pnpm lint && pnpm typecheck`
2. `pnpm test` (unidade) e os testes de integração dos arquivos mexidos
3. o portão de cobertura da área (`test:menu`, `test:cash`, `test:staff`) e `test:mutation` se o
   domínio mudou
4. `pnpm test:e2e --trace off` se mudou fluxo de tela
5. `pnpm build && pnpm test:screens` se mudou visual; imagens de referência só na imagem oficial
   do Playwright (`05-testes-de-tela.md`)

## 4. Quando o CI fica vermelho

- Ache a causa e corrija no mesmo PR. "Instável" não é causa: teste instável é defeito do teste
  (dado aleatório, tela ainda em animação, estatística do banco desatualizada) e se corrige.
- Rodar de novo vale uma vez só, para confirmar se a falha é de fora do PR. Se também falha na
  `main`, diga isso no PR e corrija em PR próprio.
- Nunca pule, desligue ou enfraqueça um teste para ficar verde.

## 5. Descrição do PR

Diga o que muda para quem usa o sistema, a migração e a ordem dela, a lista do que foi
verificado (com números) e, se a feature foi dividida, qual parte é esta e o que vem depois.
