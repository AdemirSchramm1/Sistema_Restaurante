# 5. Locais de armazenamento

> Revisado em novembro de 2026: local é só **onde o item fica guardado**. Saíram temperatura,
> responsável, ordem e folha de contagem, quarentena e a regra de produtos de limpeza.

Cada local recebe o nome que a equipe usa (geladeira, freezer, despensa, bar). Um item pode estar
em vários locais; um deles pode ser marcado como **principal**.

## Campos

| Campo na tela | O que pede | Exemplo |
|---|---|---|
| Nome do local | Como a equipe chama o espaço | "Geladeira da cozinha" |
| Tipo | Que espaço é | Despensa (seco), Geladeira, Freezer, Bar, Praça, Outros |

## Locais sugeridos no primeiro acesso

Despensa seca, Geladeira, Freezer, Bar, Armário de limpeza e Depósito de descartáveis. Dá para
renomear, inativar e criar outros.

## Critérios de aceite (para a spec)

- Nome entre 2 e 80 caracteres, sem repetir entre locais ativos.
- Local com itens vinculados não pode ser inativado.
- No item, no máximo um local é o principal.
