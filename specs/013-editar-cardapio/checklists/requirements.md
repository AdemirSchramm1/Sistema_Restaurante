# Checklist de qualidade da spec: Gerente e chef editam o cardápio

**Objetivo**: validar se a spec está completa antes do planejamento
**Criada**: 2026-11-13
**Feature**: [spec.md](../spec.md)

## Qualidade do conteúdo

- [x] Sem detalhes de implementação na spec (ferramentas, serviço de fotos e tolerância visual ficam no plano)
- [x] Foco no valor para o usuário e no negócio
- [x] Escrita para quem não é técnico
- [x] Todas as seções obrigatórias preenchidas

## Completude dos requisitos

- [x] Nenhum marcador [NEEDS CLARIFICATION] restante
- [x] Requisitos testáveis e sem ambiguidade
- [x] Critérios de sucesso mensuráveis (tempo, larguras da matriz, acessibilidade, peso das fotos, cobertura)
- [x] Critérios de sucesso sem tecnologia
- [x] Cenários de aceite definidos
- [x] Casos-limite identificados
- [x] Escopo delimitado
- [x] Dependências e premissas identificadas

## Prontidão

- [x] Todo requisito funcional tem critério de aceite claro
- [x] Histórias cobrem os fluxos principais
- [x] A feature atende os resultados de Critérios de sucesso
- [x] Nenhum detalhe de implementação vazou para a spec

## Notas

- O pedido do dono sobre TDD virou a seção "Regras de TDD desta feature" (TDD-001 a TDD-010) e a
  "Matriz de telas" (9 tamanhos, 2 motores de navegador), ligadas ao FR-011 e aos SC-002, SC-003 e
  SC-005, para o plano, as tarefas e a implementação herdarem.
- Três pontos foram decididos por premissa, sem pergunta, e estão na tabela de Decisões: mudança
  vale na hora (sem rascunho), produto novo continua exigindo ingrediente, uma foto por produto. O
  `speckit clarify` pode rever qualquer um deles antes do plano.
- Numeração: 013 era o próximo número livre em `specs/`; o fechamento do caixa do dia passa a 014.
