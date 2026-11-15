# Checklist de qualidade da spec: Garçom lança o pedido da mesa pelo cardápio

**Objetivo**: validar se a spec está completa antes do planejamento
**Criada**: 2026-11-15
**Feature**: [spec.md](../spec.md)

## Qualidade do conteúdo

- [x] Sem detalhes de implementação na spec (colunas, travas e rotas ficam no plano)
- [x] Foco no valor para o usuário e no negócio
- [x] Escrita para quem não é técnico
- [x] Todas as seções obrigatórias preenchidas

## Completude dos requisitos

- [x] Nenhuma decisão pendente (observação do garçom decidida pelo dono em 2026-11-15)
- [x] Requisitos testáveis e sem ambiguidade
- [x] Critérios de sucesso mensuráveis (tempo, 100% com origem, soma centavo por centavo)
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

- A seção "Revisão do cardápio atual para o uso do garçom" responde ao pedido do dono de verificar
  o cardápio: o que serve, o que não se aplica ao garçom e o que muda.
- Cinco pontos foram decididos por premissa e estão na tabela de Decisões (entrada com usuário
  próprio, gerente e caixa também lançam, garçom cancela só o próprio pedido antes do preparo,
  esgotado aparece apagado, balcão é uma mesa). O `speckit clarify` pode rever qualquer um.
- O dono decidiu (2026-11-15): observação livre só para a equipe (FR-018); o cliente continua só
  com botões (010).
- Sem conflito com a 014: ela não muda o envio do pedido nem a abertura da conta.
