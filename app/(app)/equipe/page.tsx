import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  inviteMemberAction,
  revokeInvitationAction,
  setMemberActiveAction,
  setMemberRolesAction,
} from "@/actions/access";
import { serverDeps } from "@/infra/server";
import { listMembers, listPendingInvitations } from "@/application/access/members";
import { can, ROLES, ROLE_LABELS, type Role } from "@/domain/access/permissions";
import { ActionForm } from "@/components/forms/action-form";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Equipe" };

function RoleBoxes({ checked, prefix }: { checked: readonly Role[]; prefix: string }) {
  return (
    <fieldset className="flex flex-wrap gap-3 text-sm">
      <legend className="sr-only">Papéis</legend>
      {ROLES.map((r) => (
        <label key={r} className="flex items-center gap-1" htmlFor={`${prefix}-${r}`}>
          <Checkbox id={`${prefix}-${r}`} name="roles" value={r} defaultChecked={checked.includes(r)} />{" "}
          {ROLE_LABELS[r]}
        </label>
      ))}
    </fieldset>
  );
}

export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "user.manage")) return <Alert>Só o gerente acessa a equipe.</Alert>;
  const deps = serverDeps();
  const [members, invitations] = await Promise.all([
    listMembers(deps, ctx),
    listPendingInvitations(deps, ctx),
  ]);
  if (!members.ok || !invitations.ok) return <Alert>Não foi possível carregar a equipe.</Alert>;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>
      <Card className="grid gap-3">
        <CardTitle>Convidar pessoa</CardTitle>
        <ActionForm
          action={inviteMemberAction}
          submitLabel="Enviar convite"
          variant="default"
          className="grid gap-3"
          successMessage="Convite enviado."
          aria-label="Convidar pessoa"
        >
          <Input
            name="email"
            type="email"
            aria-label="E-mail"
            placeholder="email@exemplo.com"
            className="max-w-sm"
            required
          />
          <RoleBoxes checked={["CHEF"]} prefix="invite" />
        </ActionForm>
      </Card>

      {invitations.value.length > 0 && (
        <Card className="grid gap-2">
          <CardTitle>Convites pendentes</CardTitle>
          <ul className="grid gap-2 text-sm">
            {invitations.value.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.email}</span>
                <span className="text-muted-foreground">
                  {i.roles.map((r) => ROLE_LABELS[r]).join(", ")} · vence em{" "}
                  {i.expiresAt.toLocaleDateString("pt-BR")}
                </span>
                <ActionForm action={revokeInvitationAction} hidden={{ id: i.id }} submitLabel="Revogar" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3">
        {members.value.map((m) => (
          <Card key={m.membershipId} className="grid gap-2" aria-label={`Membro ${m.name}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{m.name}</h2>
              <span className="text-sm text-muted-foreground">{m.email}</span>
              {m.userId === ctx.userId && <Badge tone="muted">você</Badge>}
              {!m.active && <Badge tone="warn">desativado</Badge>}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <ActionForm
                action={setMemberRolesAction}
                hidden={{ id: m.membershipId, version: m.version }}
                submitLabel="Salvar papéis"
              >
                <RoleBoxes checked={m.roles} prefix={m.membershipId} />
              </ActionForm>
              <ActionForm
                action={setMemberActiveAction}
                hidden={{ id: m.membershipId, version: m.version, active: String(!m.active) }}
                submitLabel={m.active ? "Desativar" : "Reativar"}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
