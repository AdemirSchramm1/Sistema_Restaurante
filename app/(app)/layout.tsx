import { requireContext, currentUser } from "@/actions/_session";
import { signOutAction } from "@/actions/auth";
import { serverDeps } from "@/infra/server";
import { ROLE_LABELS } from "@/domain/access/permissions";
import { MainNav } from "@/components/layout/nav";
import { getShellInfo } from "@/application/shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const [user, shell] = await Promise.all([currentUser(), getShellInfo(serverDeps(), ctx)]);
  const restaurant = shell.ok ? { name: shell.value.restaurantName } : null;
  const toReorder = shell.ok ? (shell.value.reorderCount ?? 0) : 0;
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">{restaurant?.name}</span>
          <MainNav roles={ctx.roles} reorderCount={toReorder} />
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {user?.name} · {ctx.roles.map((r) => ROLE_LABELS[r]).join(", ")}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="text-primary hover:underline">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
