import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpenText,
  CalendarClock,
  Armchair,
  ChartColumn,
  CircleDollarSign,
  CirclePlus,
  ClipboardList,
  CookingPot,
  FolderTree,
  HandPlatter,
  NotebookPen,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { can, type Action, type Role } from "@/domain/access/permissions";
import { cn } from "@/lib/utils";

export type NavSectionId = "stock" | "operation" | "settings";

export type NavEntry = {
  href: string;
  label: string;
  action: Action;
  section: NavSectionId;
  icon: LucideIcon;
  /** Só estes papéis entram por esta tela depois do login (spec 015, R15); sem a lista, todos. */
  homeOf?: readonly Role[];
};

/**
 * Menu da equipe. Cada entrada aparece só para quem tem a ação (spec 009, FR-021), na ordem desta
 * lista; a área agrupa as entradas no menu lateral (spec 012, US2).
 */
export const NAV: readonly NavEntry[] = [
  { href: "/estoque/itens", label: "Itens", action: "catalog.read", section: "stock", icon: Package },
  {
    href: "/estoque/produtos",
    label: "Produtos",
    action: "catalog.read",
    section: "stock",
    icon: UtensilsCrossed,
  },
  {
    href: "/estoque/lancamentos",
    label: "Lançamentos",
    action: "catalog.read",
    section: "stock",
    icon: ArrowLeftRight,
  },
  { href: "/estoque/repor", label: "Repor", action: "catalog.read", section: "stock", icon: ShoppingCart },
  {
    href: "/estoque/graficos",
    label: "Gráficos",
    action: "catalog.read",
    section: "stock",
    icon: ChartColumn,
  },
  {
    href: "/estoque/custos",
    label: "Custos",
    action: "catalog.read",
    section: "stock",
    icon: CircleDollarSign,
  },
  {
    href: "/estoque/fornecedores",
    label: "Fornecedores",
    action: "catalog.read",
    section: "stock",
    icon: Truck,
  },
  { href: "/estoque/grupos", label: "Grupos", action: "catalog.read", section: "stock", icon: FolderTree },
  {
    href: "/pedidos/cozinha",
    label: "Cozinha",
    action: "order.kitchen",
    section: "operation",
    icon: CookingPot,
  },
  {
    href: "/pedidos/lancar",
    label: "Lançar pedido",
    action: "order.place",
    section: "operation",
    icon: NotebookPen,
    homeOf: ["WAITER"],
  },
  {
    href: "/pedidos/garcom",
    label: "Garçom",
    action: "order.deliver",
    section: "operation",
    icon: HandPlatter,
  },
  { href: "/caixa", label: "Caixa", action: "tab.read", section: "operation", icon: Wallet },
  { href: "/caixa/contas", label: "Contas", action: "tab.history", section: "operation", icon: Receipt },
  {
    href: "/caixa/turnos",
    label: "Turnos",
    action: "cash.history",
    section: "operation",
    icon: CalendarClock,
  },
  { href: "/vendas", label: "Vendas", action: "sales.report", section: "operation", icon: ChartColumn },
  { href: "/pedidos", label: "Pedidos", action: "order.read", section: "operation", icon: ClipboardList },
  {
    href: "/pedidos/cardapio",
    label: "Cardápio",
    action: "menu.write",
    section: "operation",
    icon: BookOpenText,
  },
  { href: "/pedidos/mesas", label: "Mesas", action: "table.manage", section: "settings", icon: Armchair },
  {
    href: "/pedidos/adicionais",
    label: "Adicionais",
    action: "addon.read",
    section: "settings",
    icon: CirclePlus,
  },
  { href: "/equipe", label: "Equipe", action: "user.manage", section: "settings", icon: Users },
];

const SECTIONS: readonly { id: NavSectionId; label: string }[] = [
  { id: "stock", label: "Estoque" },
  { id: "operation", label: "Operação" },
  { id: "settings", label: "Configuração" },
];

export type NavSection = { id: NavSectionId; label: string; entries: NavEntry[] };

export const navFor = (roles: readonly Role[]): NavEntry[] => NAV.filter((n) => can(roles, n.action));

/** As entradas visíveis agrupadas por área, sem trocar a ordem; área vazia não aparece. */
export function navSections(roles: readonly Role[]): NavSection[] {
  const visible = navFor(roles);
  return SECTIONS.map((s) => ({ ...s, entries: visible.filter((n) => n.section === s.id) })).filter(
    (s) => s.entries.length > 0,
  );
}

/**
 * O link da tela atual: o mais específico que casa com o endereço. Em `/caixa/contas` é "Contas",
 * não "Caixa"; em `/estoque/itens/123` é "Itens".
 */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/**
 * Primeira tela depois do login: a primeira do menu do papel. Lançar pedido é a entrada só do
 * garçom; o caixa continua entrando no Caixa (spec 015, R15).
 */
export const homeFor = (roles: readonly Role[]): string =>
  navFor(roles).find((n) => !n.homeOf || n.homeOf.some((r) => roles.includes(r)))?.href ?? "/sem-acesso";

const reorderLabel = (n: number) => `${n} ${n === 1 ? "item" : "itens"} para repor`;

/**
 * Menu principal, na lousa do menu lateral. Um `<nav>` só, com uma lista por área; o link da tela
 * atual leva `aria-current="page"`. O ícone é enfeite: o texto do link é o nome da tela.
 */
export function MainNav({
  roles,
  reorderCount,
  pathname = "",
  onNavigate,
}: {
  roles: readonly Role[];
  reorderCount: number;
  pathname?: string;
  onNavigate?: () => void;
}) {
  const sections = navSections(roles);
  const current = activeHref(
    pathname,
    sections.flatMap((s) => s.entries.map((e) => e.href)),
  );
  return (
    <nav aria-label="Menu principal" className="grid gap-4">
      {sections.map((s) => (
        <div key={s.id} className="grid gap-1">
          <p
            id={`menu-${s.id}`}
            className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sidebar-muted"
          >
            {s.label}
          </p>
          <ul aria-labelledby={`menu-${s.id}`} className="grid gap-0.5">
            {s.entries.map(({ href, label, icon: Icon }) => {
              const active = href === current;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-1.5",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary",
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        active
                          ? "text-sidebar-primary"
                          : "text-sidebar-muted group-hover:text-sidebar-foreground",
                      )}
                    />
                    {label}
                    {href === "/estoque/repor" && reorderCount > 0 && (
                      <span
                        className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-xs font-semibold tabular-nums text-warning-foreground"
                        aria-label={reorderLabel(reorderCount)}
                      >
                        {reorderCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
