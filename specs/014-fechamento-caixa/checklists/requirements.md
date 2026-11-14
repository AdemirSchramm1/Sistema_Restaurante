# Checklist de qualidade da spec: Abrir e fechar o caixa do dia

**Objetivo**: validar se a spec está completa antes do planejamento
**Criada**: 2026-11-14
**Feature**: [spec.md](../spec.md)

## Qualidade do conteúdo

- [x] Sem detalhes de implementação na spec (tabelas, travas e consultas ficam no plano)
- [x] Foco no valor para o usuário e no negócio
- [x] Escrita para quem não é técnico
- [x] Todas as seções obrigatórias preenchidas

## Completude dos requisitos

- [x] Nenhum marcador [NEEDS CLARIFICATION] restante
- [x] Requisitos testáveis e sem ambiguidade
- [x] Critérios de sucesso mensuráveis (tempo, 100% dos pagamentos em um turno, soma centavo por centavo)
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

- O escopo veio do pedido do dono de 2026-11-12, adiado pela 012 e pela 013.
- Cinco pontos foram decididos por premissa, sem pergunta, e estão na tabela de Decisões: pagamento
  exige caixa aberto, um caixa por restaurante, conferência cega, conta aberta não segura o
  fechamento, vendas por produto só para o gerente. O `speckit clarify` pode rever qualquer um.
