import Link from "next/link";
import { requireContext, currentUser } from "@/actions/_session";
import { signOutAction } from "@/actions/auth";
import { serverDeps } from "@/infra/server";
import { ok } from "@/domain/shared/result";
import { ROLE_LABELS } from "@/domain/access/permissions";

const NAV = [
  { href: "/estoque/itens", label: "Itens" },
  { href: "/estoque/produtos", label: "Produtos" },
  { href: "/estoque/lancamentos", label: "Lançamentos" },
  { href: "/estoque/fornecedores", label: "Fornecedores" },
  { href: "/estoque/grupos", label: "Grupos" },
  { href: "/equipe", label: "Equipe" },
] as const;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const user = await currentUser();
  const r = await serverDeps().tenant(ctx.restaurantId, async (repos) => ok(await repos.restaurants.get()));
  const restaurant = r.ok ? r.value : null;
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">{restaurant?.name}</span>
          <nav className="flex flex-wrap gap-4 text-sm" aria-label="Menu principal">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-primary">
                {n.label}
              </Link>
            ))}
          </nav>
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
