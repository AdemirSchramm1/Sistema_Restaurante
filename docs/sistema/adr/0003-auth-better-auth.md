# ADR 0003 — Autenticação: Better Auth, papéis no domínio

- **Status**: aceito · **Data**: 2026-10-31 · **Feature**: [001](../../../specs/001-cadastros-base/research.md#r3-autenticação-convites-e-recuperação-de-senha)
- **Contexto**: e-mail e senha, recuperação de senha, convite de equipe e papéis múltiplos por
  usuário (spec 001, FR-002/FR-003), testáveis com o banco do container.
- **Decisão**: Better Auth (e-mail/senha, sessão em cookie, tabelas no nosso banco via Drizzle).
  Restaurante, vínculo e papéis são tabelas do domínio (`memberships`, `membership_roles`,
  `invitations`); a matriz de permissões é função pura. E-mail por porta `Mailer` (Resend em
  produção, memória nos testes).
- **Consequências**: sem serviço externo de identidade; login social/SSO fica para depois.
  Alternativas: Auth.js, Clerk, Supabase Auth.
