# 9. Controles contra perdas e furtos

> **Escopo simplificado (novembro de 2026).** Sem conferência cega e sem contagem, as regras de
> segregação ligadas a elas não se aplicam. Continuam: trilha de auditoria, papéis, perda separada
> de consumo e acerto que só vale com aprovação de um gerente que não seja quem pediu (feature 004). Ver [escopo simplificado](13-decisoes-adotadas.md#escopo-simplificado-novembro-de-2026).

> Fonte: Manual de Referência, seção 7.

Os controles reforçam uns aos outros:

- Um ou dois responsáveis treinados pelo estoque.
- Estoque com acesso controlado.
- Conferência cega.
- Contagem dupla e assinada.
- Política escrita de cortesias e porcionamento: **generosidade não autorizada conta como furto**.
- Trilha de auditoria de quem fez o quê e quando.
- Análise da variância por local, turno e categoria.
- Relatórios de cancelamentos, estornos e descontos fora do padrão.
- Permissões de desconto e de retirar item da conta só para pessoas de confiança.
- Separar "perda" de "consumo" no sistema.

## Papéis e segregação de funções

O sistema usa estes papéis. Um usuário pode ter mais de um, mas o sistema impede as combinações da
última coluna **na mesma operação**.

| Papel | Pode | Não pode acumular com |
|---|---|---|
| Comprador / gerente | Cotação e pedido | Recebimento e aprovação do próprio pedido |
| Estoquista / almoxarife | Recebimento e contagem às cegas | Lançamento da NF e ajuste |
| Administrativo / financeiro | Conferência com a NF e lançamento | Contagem física |
| Chef | Fichas técnicas, porcionamento, perdas, produção | Aprovação dos próprios ajustes |
| Gerente / proprietário | Aprovação de ajustes, análise de CMV e variância | – |

## Operação pequena

Quando não dá para separar todas as funções, o restaurante liga o **modo operação pequena**: o
sistema permite acumular, mas registra a exceção e exige **contagem periódica feita pelo dono** e
**revisão semanal da variância** (aparece como tarefa pendente no painel).

## Critérios de aceite (para a spec)

- O usuário que lançou um ajuste não consegue aprová-lo (exceto em modo operação pequena, com
  registro).
- O usuário que fez a contagem cega de um recebimento não consegue lançar a NF desse recebimento.
- Toda escrita registra usuário, data/hora e origem.
- Relatório de auditoria filtra por usuário, período, tipo de operação.
