import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/actions/_session";
import { markDeliveredAction } from "@/actions/kitchen";
import { serverDeps } from "@/infra/server";
import { listReadyOrders } from "@/application/ordering/kitchen";
import { ReadyList } from "@/components/ordering/ready-list";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { placedByText } from "@/components/staff-ordering/format";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Garçom" };
export const dynamic = "force-dynamic";

/** Prontos para levar (spec 009, US4), com quem lançou e o filtro Só os meus (spec 015, US5). */
export default async function Page({ searchParams }: PageProps<"/pedidos/garcom">) {
  const ctx = await requireContext();
  const onlyMine = firstParam((await searchParams).meus) === "1";
  const r = await listReadyOrders(serverDeps(), ctx, { onlyMine });
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={5} />
      <PageHeader
        title="Prontos para levar"
        description="Pedidos que a cozinha terminou. A tela se atualiza sozinha."
      />
      <nav aria-label="Filtro" className="flex flex-wrap gap-2">
        <Link
          href="/pedidos/garcom"
          aria-current={onlyMine ? undefined : "page"}
          className={buttonVariants({ variant: onlyMine ? "outline" : "default", size: "lg" })}
        >
          Todos
        </Link>
        <Link
          href="/pedidos/garcom?meus=1"
          aria-current={onlyMine ? "page" : undefined}
          className={buttonVariants({ variant: onlyMine ? "default" : "outline", size: "lg" })}
        >
          Só os meus
        </Link>
      </nav>
      <ReadyList
        orders={r.value.map((o) => ({ ...o, readyAt: o.readyAt.toISOString(), placedBy: o.source === "TABLET" ? undefined : placedByText(o) }))}
        deliver={markDeliveredAction}
      />
    </div>
  );
}
