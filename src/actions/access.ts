"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { inviteMember } from "@/application/access/invite-member";
import { acceptInvitation } from "@/application/access/accept-invitation";
import { revokeInvitation } from "@/application/access/revoke-invitation";
import { setMemberActive, setMemberRoles } from "@/application/access/members";
import { requestOrigin, toState, withContext, type ActionState } from "./_session";

const PATH = "/equipe";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);
const roles = (f: FormData) => f.getAll("roles").map(String);

async function done<T>(state: ActionState<T>) {
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function inviteMemberAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) => inviteMember(serverDeps(), ctx, { email: str(f, "email"), roles: roles(f) })),
  );
}

export async function revokeInvitationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(await withContext((ctx) => revokeInvitation(serverDeps(), ctx, str(f, "id"))));
}

export async function setMemberRolesAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) => setMemberRoles(serverDeps(), ctx, str(f, "id"), int(f, "version"), roles(f))),
  );
}

export async function setMemberActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      setMemberActive(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "active") === "true"),
    ),
  );
}

/** Rota pública: aceita o convite, entra e vai para os itens. */
export async function acceptInvitationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const deps = serverDeps();
  const password = str(f, "password");
  const r = await acceptInvitation(
    deps,
    { token: str(f, "token"), name: str(f, "name"), password },
    await requestOrigin(),
  );
  if (!r.ok) return toState(r);
  await deps.betterAuth.api.signInEmail({
    body: { email: str(f, "email"), password },
    headers: await headers(),
  });
  redirect("/estoque/itens");
}
