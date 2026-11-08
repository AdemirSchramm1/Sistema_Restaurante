import { requireContext, currentUser } from "@/actions/_session";
import { signOutAction } from "@/actions/auth";
import { serverDeps } from "@/infra/server";
import { ok } from "@/domain/shared/result";
import { can, ROLE_LABELS } from "@/domain/access/permissions";
import { MainNav } from "@/components/layout/nav";
import { countReorderAlerts } from "@/application/inventory/reorder";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const user = await currentUser();
  const r = await serverDeps().tenant(ctx.restaurantId, async (repos) => ok(await repos.restaurants.get()));
  const restaurant = r.ok ? r.value : null;
  // Só conta para quem vê o estoque: o garçom não gera tentativa negada a cada tela.
  const reorder = can(ctx.roles, "catalog.read") ? await countReorderAlerts(serverDeps(), ctx) : null;
  const toReorder = reorder?.ok ? reorder.value : 0;
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
