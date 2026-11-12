import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listOpenTabs } from "@/application/billing/tabs";
import { getServiceChargeSettings } from "@/application/billing/settings";
import { setServiceChargeRateAction } from "@/actions/billing";
import { can } from "@/domain/access/permissions";
import { OpenTabs } from "@/components/billing/open-tabs";
import { ServiceRateForm } from "@/components/billing/service-charge";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Caixa" };
export const dynamic = "force-dynamic";

/** Caixa (spec 011, US1): mesas com conta aberta; atualiza sozinho a cada 10 segundos. */
export default async function Page({ searchParams }: PageProps<"/caixa">) {
  const ctx = await requireContext();
  const closed = (await searchParams).fechada;
  const deps = serverDeps();
  const r = await listOpenTabs(deps, ctx);
  if (!r.ok) return <NoAccess />;
  const settings = can(ctx.roles, "tab.settings") ? await getServiceChargeSettings(deps, ctx) : null;
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
      {typeof closed === "string" && closed && (
        <Alert tone="success">{`Conta da Mesa ${closed} fechada. A mesa está livre para o próximo cliente.`}</Alert>
      )}
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
      {settings?.ok && (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer font-medium">Taxa de serviço do restaurante</summary>
          <div className="mt-3">
            <ServiceRateForm
              rate={settings.value.rate?.toString() ?? null}
              version={settings.value.version}
              action={setServiceChargeRateAction}
            />
          </div>
        </details>
      )}
    </div>
  );
}
