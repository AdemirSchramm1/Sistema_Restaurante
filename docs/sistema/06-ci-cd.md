# CI/CD e pull requests

Regras para todo PR deste repositório. Quem abre ou atualiza um PR (pessoa ou agente) lê este
arquivo antes. Origem: o pedido do dono do projeto em 2026-11-16 ("os PRs demoram demais no CI") e
a reforma do CI no PR #25, que levou a esteira de 35 min para cerca de 5 min sem tirar teste.

O foco é o software funcionar, não o teste passar. TDD continua obrigatório
(`01-tdd.md`), mas valores fixos e testes pragmáticos são bem-vindos quando deixam o teste mais
rápido e mais estável.

## 1. Um PR por feature; quem se divide é o CI

O dono do projeto quer **a feature inteira num PR só**. Quem deixa o PR rápido é o CI quebrado em
muitos jobs paralelos, não o PR quebrado em pedaços (decisão de 2026-11-20).

- **Uma feature por PR**, com tudo dela: migração, domínio, telas, testes, imagens de referência,
  `docs/` e `tasks.md`. Não divida a feature em vários PRs.
- **Nunca duas features no mesmo PR.** Correção fora da feature vai em PR próprio.
- Feature que depende de outra ainda aberta espera o merge dela; não empilhe PR em cima de PR
  aberto.
- **PR lento no CI se resolve no CI:** ache o job mais demorado e quebre em mais partes paralelas
  (veja a seção 2). A meta é nenhum job passar de uns 5 minutos.

## 2. Como o CI roda (`.github/workflows/ci.yml`)

- Todos os jobs rodam **em paralelo**: `estatico` (formato, lint, tipos), `unidade`,
  `integracao` (cobertura do cardápio, do caixa e do garçom), `e2e` e `telas` (Chromium e WebKit,
  cada um em 3 partes).
- **Quebrar em mais partes:** job que passou de uns 5 minutos vira uma `matrix` com mais partes,
  cada uma com o seu banco. Divida por arquivo ou por `--grep` quando um arquivo sozinho domina o
  tempo (foi o que se fez com o cardápio do cliente em `telas`), e por `--shard` quando o tempo
  está bem espalhado. Cada parte tem de rodar sozinha, sem depender da ordem das outras.
- Novo portão de cobertura (como `test:cash`) entra no job `integracao` ou numa parte nova dele;
  nunca crie job em série (`needs` entre jobs de teste).
- **Filtro de caminho:** PR só de documentação (`*.md`, `docs/`, `specs/`, `.specify/`) roda só o
  `estatico`, em cerca de 1 minuto.
- **Commit novo cancela a rodada anterior** do mesmo PR (`concurrency`).
- Dependências vêm do cache do pnpm; fila e instalação levam segundos. Se um job ficar lento,
  abra o log, veja qual passo come o tempo e corrija ali (quebrar o job, cortar trabalho repetido),
  em vez de cortar teste.

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
verificado (com números) e o tempo de cada job do CI, para ver qual precisa ser quebrado.
