# ADR 0005 — Cardápio público: QR code da mesa e acesso de 20 minutos

- **Status**: proposto · **Data**: 2026-11-08 · **Feature**: [009](../../../specs/009-pedidos-qr-mesa/research.md)
- **Contexto**: o cliente pede pelo celular sem login (spec 009). É a primeira parte do sistema sem
  usuário; o RLS ([ADR 0004](0004-rls-tenant.md)) e a regra "restaurante nunca vem do cliente"
  continuam valendo.
- **Decisão**: o QR code leva a `/m/{token}`, com token aleatório de 32 bytes guardado na mesa
  (em texto, porque está impresso e precisa ser reimpresso; "Trocar QR code" o invalida). Uma
  função `SECURITY DEFINER` acha restaurante e mesa pelo token; depois tudo roda em `withTenantTx`.
  Cada leitura abre um acesso de 20 minutos fixos (`menu_accesses`), cujo token secreto vai num
  cookie `httpOnly` com caminho `/cardapio` e fica no banco só como hash. O servidor decide se o
  acesso vale; o envio aceita 15 s de tolerância.
- **Consequências**: nenhum id do cliente decide o restaurante; acesso vencido não pede; telas da
  equipe e o cardápio se atualizam por consulta a cada 5–10 s, sem conexão longa. Alternativas:
  URL com id da mesa (adivinhável), token do acesso na URL (vaza ao compartilhar), tempo real com
  SSE ou serviço externo (sem problema medido).
