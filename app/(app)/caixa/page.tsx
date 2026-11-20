import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listOpenTabs } from "@/application/billing/tabs";
import { getCurrentCashSession } from "@/application/cash/sessions";
import { addCashEntryAction, openCashSessionAction, removeCashEntryAction } from "@/actions/cash";
import { EntriesList } from "@/components/cash/entries-list";
import { SessionBar } from "@/components/cash/session-bar";
import { cashBarView, entryView } from "@/components/cash/view";
import { Card, CardTitle } from "@/components/ui/card";
import { getServiceChargeSettings } from "@/application/billing/settings";
import { setServiceChargeRateAction } from "@/actions/billing";
import { can } from "@/domain/access/permissions";
import { OpenTabs } from "@/components/billing/open-tabs";
import { ServiceRateForm } from "@/components/billing/service-charge";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/page-header";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Caixa" };
export const dynamic = "force-dynamic";

/**
 * Caixa (spec 011, US1; spec 014, US1 e US3): a situação do caixa no topo, as mesas com conta
 * aberta e as sangrias e reforços do turno. Atualiza sozinho a cada 10 segundos.
 */
export default async function Page({ searchParams }: PageProps<"/caixa">) {
  const ctx = await requireContext();
  const closed = firstParam((await searchParams).fechada);
  const deps = serverDeps();
  // As duas leituras são independentes: em paralelo, a tela espera uma ida ao banco a menos.
  const [r, cash, settings] = await Promise.all([
    listOpenTabs(deps, ctx),
    getCurrentCashSession(deps, ctx),
    can(ctx.roles, "tab.settings") ? getServiceChargeSettings(deps, ctx) : null,
  ]);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Caixa"
        description="Mesas com conta aberta. A tela se atualiza sozinha."
        actions={
          can(ctx.roles, "tab.history") && (
            <Link href="/caixa/contas" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Receipt aria-hidden="true" />
              Contas fechadas
            </Link>
          )
        }
      />
      {cash.ok && (
        <SessionBar
          cash={cashBarView(cash.value)}
          openAction={openCashSessionAction}
          entryAction={addCashEntryAction}
        />
      )}
      {closed && (
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
      {cash.ok && cash.value.session && cash.value.canOperate && (
        <Card className="grid gap-3">
          <CardTitle>Sangrias e reforços do turno</CardTitle>
          <EntriesList
            entries={cash.value.session.entries.map(entryView)}
            timezone={cash.value.timezone}
            remove={removeCashEntryAction}
          />
        </Card>
      )}
      {settings?.ok && (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer py-2.5 font-medium">Taxa de serviço do restaurante</summary>
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
