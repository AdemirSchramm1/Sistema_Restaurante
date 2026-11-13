import { requireContext, currentUser } from "@/actions/_session";
import { signOutAction } from "@/actions/auth";
import { serverDeps } from "@/infra/server";
import { getShellInfo } from "@/application/shell";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Casco das telas da equipe. Sessão e contexto saem do cache da requisição (spec 012, US4); nome do
 * restaurante e contagem do Repor vêm numa transação só.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const [user, shell] = await Promise.all([currentUser(), getShellInfo(serverDeps(), ctx)]);
  return (
    <AppShell
      restaurantName={shell.ok ? shell.value.restaurantName : null}
      userName={user?.name ?? null}
      roles={ctx.roles}
      reorderCount={shell.ok ? (shell.value.reorderCount ?? 0) : 0}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
