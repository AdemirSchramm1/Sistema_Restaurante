import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listOpenTabs } from "@/application/billing/tabs";
import { can } from "@/domain/access/permissions";
import { OpenTabs } from "@/components/billing/open-tabs";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";

export const metadata: Metadata = { title: "Caixa" };
export const dynamic = "force-dynamic";

/** Caixa (spec 011, US1): mesas com conta aberta; atualiza sozinho a cada 10 segundos. */
export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const r = await listOpenTabs(deps, ctx);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={10} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Caixa</h1>
        {can(ctx.roles, "tab.history") && (
          <Link href="/caixa/contas" className="text-sm text-primary underline underline-offset-4">
            Contas fechadas
          </Link>
        )}
      </div>
      <OpenTabs
        serverNow={r.value.serverNow}
        tabs={r.value.tabs.map((t) => ({
          id: t.id,
          tableName: t.tableName,
          openedAt: t.openedAt.toISOString(),
          total: t.total.toFixed(2),
          remaining: t.remaining.toFixed(2),
          pendingOrders: t.pendingOrders,
        }))}
      />
    </div>
  );
}
