import Link from "next/link";
import { can, type Action, type Role } from "@/domain/access/permissions";

export type NavEntry = { href: string; label: string; action: Action };

/** Menu da equipe. Cada entrada aparece só para quem tem a ação (spec 009, FR-021). */
export const NAV: readonly NavEntry[] = [
  { href: "/estoque/itens", label: "Itens", action: "catalog.read" },
  { href: "/estoque/produtos", label: "Produtos", action: "catalog.read" },
  { href: "/estoque/lancamentos", label: "Lançamentos", action: "catalog.read" },
  { href: "/estoque/repor", label: "Repor", action: "catalog.read" },
  { href: "/estoque/graficos", label: "Gráficos", action: "catalog.read" },
  { href: "/estoque/custos", label: "Custos", action: "catalog.read" },
  { href: "/estoque/fornecedores", label: "Fornecedores", action: "catalog.read" },
  { href: "/estoque/grupos", label: "Grupos", action: "catalog.read" },
  { href: "/pedidos/cozinha", label: "Cozinha", action: "order.kitchen" },
  { href: "/pedidos/garcom", label: "Garçom", action: "order.deliver" },
  { href: "/pedidos", label: "Pedidos", action: "order.read" },
  { href: "/pedidos/mesas", label: "Mesas", action: "table.manage" },
  { href: "/pedidos/adicionais", label: "Adicionais", action: "addon.read" },
  { href: "/equipe", label: "Equipe", action: "user.manage" },
];

export const navFor = (roles: readonly Role[]): NavEntry[] => NAV.filter((n) => can(roles, n.action));

/** Primeira tela depois do login: a primeira do menu do papel. */
export const homeFor = (roles: readonly Role[]): string => navFor(roles)[0]?.href ?? "/sem-acesso";

export function MainNav({ roles, reorderCount }: { roles: readonly Role[]; reorderCount: number }) {
  return (
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Menu principal">
      {navFor(roles).map((n) => (
        <Link key={n.href} href={n.href} className="hover:text-primary">
          {n.label}
          {n.href === "/estoque/repor" && reorderCount > 0 && (
            <span
              className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900"
              aria-label={`${reorderCount} ${reorderCount === 1 ? "item" : "itens"} para repor`}
            >
              {reorderCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
