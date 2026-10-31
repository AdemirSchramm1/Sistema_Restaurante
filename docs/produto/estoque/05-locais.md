# 5. Locais de armazenamento

> Fonte: Manual de Referência, seção 3 ("Locais devem ter o nome do espaço físico real").

Cada local recebe o nome que a equipe usa (câmara, estoque do bar, depósito dos fundos), e a folha
de contagem segue a ordem das prateleiras. Um item pode estar em vários locais, com um local padrão
e uma posição na folha.

## Locais sugeridos no cadastro inicial

| Local | Função | Atributos |
|---|---|---|
| Recebimento / quarentena | Itens em conferência e reprovados aguardando devolução (RDC 216, 4.7.4) | Identificado e segregado |
| Almoxarifado ou despensa seca | Secos, enlatados, bebidas não refrigeradas | Ventilado, sem sol direto, telado |
| Câmara/geladeira de carnes | Proteínas cruas | Temperatura-alvo, termômetro externo |
| Câmara/geladeira de hortifrúti e laticínios | FLV, laticínios, ovos | Temperatura-alvo |
| Freezer ou câmara de congelados | Congelados | ≤ -18 °C |
| Geladeiras de praça (quente, fria, confeitaria) | Estoque de uso do turno | Só se houver requisição registrada |
| Bar (adega, geladeira, chopeira) | Bebidas | Separado do estoque da cozinha |
| Armário de limpeza e químicos | Saneantes | Exclusivo, fora da área de alimentos |
| Depósito de descartáveis e embalagens | Não alimentares | – |
| Redes: cozinha central, cada filial, "em trânsito" | Transferências | Status da transferência |

## Atributos de todo local

- Nome, tipo (seco, refrigerado, congelado, quarentena, trânsito, químicos).
- **Responsável.**
- **Faixa de temperatura** (obrigatória para refrigerados e congelados).
- **Ordem de contagem** (rota física: câmara → seco → bar).

## Critérios de aceite (para a spec)

- Local refrigerado ou congelado sem faixa de temperatura não pode ser salvo.
- Item do grupo "Higiene e limpeza" não pode ter como local um espaço de alimentos (e vice-versa).
- A folha de contagem lista os itens de cada local na ordem definida.
- O local "Quarentena" existe sempre e não pode ser apagado.
