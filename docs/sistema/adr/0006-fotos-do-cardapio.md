# ADR 0006 — Fotos do cardápio: loja de arquivos atrás de uma porta

- **Status**: aceito · **Data**: 2026-11-12 · **Feature**: [013](../../../specs/013-editar-cardapio/research.md#r1-onde-as-fotos-ficam)
- **Contexto**: gerente e chef põem foto nos produtos (spec 013). O cliente abre o cardápio no
  celular, muitas vezes no 4G, e cada foto é vista muitas vezes. A aplicação roda na Vercel, onde
  uma função aceita no máximo 4,5 MB de corpo.
- **Decisão**: porta `PhotoStorage` (`src/application/menu/ports.ts`) com três adaptadores,
  escolhidos por `MENU_PHOTOS`: `memory` (testes de integração), `file` (desenvolvimento, ponta a
  ponta e telas; grava em `MENU_PHOTO_DIR`) e `vercel-blob` (produção, token em
  `BLOB_READ_WRITE_TOKEN`). O navegador reduz a foto (lado maior até 1600 px, JPEG 0,85) e envia
  para `POST /api/cardapio/foto`; o servidor (porta `PhotoProcessor`, com `sharp`) confere o
  conteúdo, gira pela câmera, recorta no centro em 4:3, tira os metadados e grava WebP nas larguras
  300, 600, 900 e 1200 que couberem, em `menu/{photoId}/{largura}.webp`, com `photoId` aleatório e
  cache de um ano. O banco guarda só a base do endereço e as larguras. Trocar a foto gera outro
  `photoId`; os arquivos antigos são apagados depois do commit.
- **Consequências**: a foto sai da rede de borda sem acordar a aplicação nem o banco; o endereço
  não diz de que restaurante é e não se adivinha; o mesmo caminho de envio vale em todo ambiente e
  é exercitado pelos testes. Arquivo órfão (falha ao apagar) custa centavos e fica no log.
  Alternativas: `bytea` no PostgreSQL (cada foto vista viraria consulta), S3 ou R2 (mais contas e
  chaves para o dono), `next/image` com otimizador (custo por imagem e pixels diferentes entre
  ambientes), envio direto do navegador à loja (um caminho que só existe em produção).
