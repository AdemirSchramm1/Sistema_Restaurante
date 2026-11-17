"use client";

import { useRef, useState } from "react";
import type * as React from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/domain/access/permissions";
import { cn } from "@/lib/utils";
import { Brand, PRODUCT_NAME } from "./brand";
import { MainNav } from "./nav";
import { clearAllCarts, deviceStorage } from "@/components/staff-ordering/cart-storage";

const PANEL_ID = "menu-lateral";

/**
 * Casco das telas da equipe (spec 012, US2). A partir de 1024 px, menu lateral fixo na lousa; abaixo
 * disso, barra do topo com o botão "Menu", que abre e fecha a mesma lista (um `<nav>` só). Escolher
 * uma tela ou apertar Esc fecha o menu. Na impressão, só o conteúdo.
 */
export function AppShell({
  restaurantName,
  userName,
  roles,
  reorderCount,
  signOut,
  children,
}: {
  restaurantName: string | null;
  userName: string | null;
  roles: readonly Role[];
  reorderCount: number;
  signOut: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !open) return;
    setOpen(false);
    toggle.current?.focus();
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="fixed left-4 top-3 z-50 -translate-y-[200%] rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-ring"
      >
        Pular para o conteúdo
      </a>

      <aside
        onKeyDown={onKeyDown}
        className="no-print sticky top-0 z-40 bg-sidebar text-sidebar-foreground lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-sidebar-border"
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:px-5 lg:pb-5 lg:pt-6">
          <Brand name={restaurantName ?? PRODUCT_NAME} caption={restaurantName ? PRODUCT_NAME : undefined} />
          <button
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls={PANEL_ID}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
            Menu
          </button>
        </div>

        <div
          id={PANEL_ID}
          className={cn(
            open ? "flex" : "hidden",
            "max-h-[calc(100dvh-3.5rem)] flex-col border-t border-sidebar-border lg:flex lg:max-h-none lg:min-h-0 lg:flex-1 lg:border-t-0",
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:py-2">
            <MainNav
              roles={roles}
              reorderCount={reorderCount}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-3 border-t border-sidebar-border px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{userName}</p>
              <p className="truncate text-xs text-sidebar-muted">
                {roles.map((r) => ROLE_LABELS[r]).join(", ")}
              </p>
            </div>
            <form action={signOut} onSubmit={() => clearAllCarts(deviceStorage())}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-sidebar-primary"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8"
      >
        {children}
      </main>
    </div>
  );
}
