import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listTabs } from "@/application/billing/tabs";
import { businessDay } from "@/domain/ordering/business-day";
import { can } from "@/domain/access/permissions";
import { messageFor } from "@/components/forms/error-messages";
import { TabsReport } from "@/components/billing/tabs-report";
import { NoAccess } from "@/components/layout/no-access";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Contas fechadas" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Contas fechadas por dia (até 31 dias) e mesa, com o resumo por forma de pagamento (spec 011, US6). */
export default async function Page({ searchParams }: PageProps<"/caixa/contas">) {
  const ctx = await requireContext();
  if (!can(ctx.roles, "tab.history")) return <NoAccess />;
  const sp = await searchParams;
  const deps = serverDeps();
  const settings = await deps.tenant(ctx.restaurantId, async (r) => ({
    ok: true as const,
    value: await r.orderingSettings.get(),
  }));
  const tz = settings.ok ? settings.value.timezone : "America/Sao_Paulo";
  const today = businessDay(deps.clock.now(), tz);
  const from = one(sp.de) ?? today;
  const to = one(sp.ate) ?? today;
  const tableId = one(sp.mesa);

  // As mesas do filtro são as que fecharam conta no período.
  const all = await listTabs(deps, ctx, { from, to });
  const tables = all.ok
    ? [...new Map(all.value.tabs.map((t) => [t.tableId, t.tableName])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], "pt-BR", { numeric: true }),
      )
    : [];
  const r = tableId && all.ok ? await listTabs(deps, ctx, { from, to, tableId }) : all;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Contas fechadas</h1>
        <Link href="/caixa" className="text-sm text-primary underline underline-offset-4">
          Voltar para o caixa
        </Link>
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="de">De</Label>
          <Input id="de" type="date" name="de" defaultValue={from} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" type="date" name="ate" defaultValue={to} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="mesa">Mesa</Label>
          <Select id="mesa" name="mesa" defaultValue={tableId ?? ""}>
            <option value="">Todas</option>
            {tables.map(([id, name]) => (
              <option key={id} value={id}>
                {`Mesa ${name}`}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {!r.ok && <Alert>{messageFor(r.error)}</Alert>}
      {r.ok && (
        <TabsReport
          timezone={tz}
          tabs={r.value.tabs.map((t) => ({
            id: t.id,
            tableName: t.tableName,
            openedAt: t.openedAt.toISOString(),
            closedAt: t.closedAt.toISOString(),
            closedByName: t.closedByName,
            subtotal: t.subtotal.toFixed(2),
            serviceCharge: t.serviceCharge.toFixed(2),
            total: t.total.toFixed(2),
          }))}
          summary={{
            byMethod: r.value.summary.byMethod.map((m) => ({ method: m.method, amount: m.amount.toFixed(2) })),
            serviceCharge: r.value.summary.serviceCharge.toFixed(2),
            total: r.value.summary.total.toFixed(2),
          }}
        />
      )}
    </div>
  );
}
