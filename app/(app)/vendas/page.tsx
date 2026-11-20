import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { salesReport } from "@/application/cash/sales";
import { can } from "@/domain/access/permissions";
import { businessDay } from "@/domain/ordering/business-day";
import { messageFor } from "@/components/forms/error-messages";
import { SalesReportPage } from "@/components/sales/sales-report";
import { salesReportView } from "@/components/sales/view";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Vendas" };
export const dynamic = "force-dynamic";

/** Vendas por forma de pagamento e por produto (spec 014, US6): só o gerente; padrão hoje. */
export default async function Page({ searchParams }: PageProps<"/vendas">) {
  const ctx = await requireContext();
  if (!can(ctx.roles, "sales.report")) return <NoAccess />;
  const sp = await searchParams;
  const deps = serverDeps();
  const settings = await deps.tenant(ctx.restaurantId, async (r) => ({
    ok: true as const,
    value: await r.orderingSettings.get(),
  }));
  const tz = settings.ok ? settings.value.timezone : "America/Sao_Paulo";
  const today = businessDay(deps.clock.now(), tz);
  const from = firstParam(sp.de) ?? today;
  const to = firstParam(sp.ate) ?? today;
  const r = await salesReport(deps, ctx, { from, to });
  return (
    <div className="grid gap-4">
      <PageHeader title="Vendas" description="O que entrou nos turnos e o que foi vendido no período." />
      {r.ok ? (
        <SalesReportPage report={salesReportView(r.value, from, to)} />
      ) : (
        <Alert>{messageFor(r.error)}</Alert>
      )}
    </div>
  );
}
