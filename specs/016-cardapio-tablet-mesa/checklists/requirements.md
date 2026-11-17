# Checklist de qualidade da spec: Cardápio com a cara do restaurante e tablet fixo na mesa

**Objetivo**: validar se a spec está completa antes do planejamento
**Criada**: 2026-11-16
**Feature**: [spec.md](../spec.md)

## Qualidade do conteúdo

- [x] Sem detalhes de implementação na spec (tabelas, rotas e componentes ficam no plano)
- [x] Foco no valor para o usuário e no negócio
- [x] Escrita para quem não é técnico
- [x] Todas as seções obrigatórias preenchidas

## Completude dos requisitos

- [x] Nenhum marcador [NEEDS CLARIFICATION] restante
- [x] Requisitos testáveis e sem ambiguidade (larguras, tempos e textos definidos)
- [x] Critérios de sucesso mensuráveis
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

- O escopo veio do pedido do dono de 2026-11-16, com uma imagem de referência de um cardápio de
  delivery.
- Três pontos foram decididos por premissa, sem pergunta, e estão na tabela de Decisões: o link do
  tablet vale só no primeiro aparelho que o abre, o tablet limpa sozinho (3 minutos parado, depois de
  enviar e quando a conta fecha), e delivery, redes sociais e preço de/por ficam fora. O
  `speckit clarify` pode rever qualquer um.
- O pedido do garçom (015) usa o mesmo cardápio e herda o visual novo.
