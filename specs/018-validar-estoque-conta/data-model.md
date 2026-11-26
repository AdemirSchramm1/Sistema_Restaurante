# Modelo de dados: 018

Nenhuma tabela, coluna ou migração. A feature cria dois registros em Markdown nesta pasta:

## mutants.md

| Campo | Conteúdo |
|---|---|
| Arquivo | Caminho em `src/domain/` |
| Mutantes | Quantos sobreviviam em 2026-11-26 |
| Decisão | `teste` (faltava teste), `erro` (o sistema estava errado; link do commit), `removido` (código morto ou equivalente reescrito) |
| Nota | Uma linha; para `erro`, o antes e o depois |

## rules.md

| Campo | Conteúdo |
|---|---|
| Regra | Texto curto e link para a seção de `docs/produto/` |
| Teste | Arquivo e nome do teste (`describe > it`) que a prova |
