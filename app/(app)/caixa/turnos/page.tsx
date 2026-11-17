import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listCashSessions } from "@/application/cash/reports";
import { can } from "@/domain/access/permissions";
import { businessDay } from "@/domain/ordering/business-day";
import { messageFor } from "@/components/forms/error-messages";
import { SessionsList } from "@/components/cash/sessions-list";
import { sessionRowView } from "@/components/cash/view";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Turnos do caixa" };
export const dynamic = "force-dynamic";

/** Turnos do caixa por período (spec 014, US5): padrão os últimos 7 dias do restaurante. */
export default async function Page({ searchParams }: PageProps<"/caixa/turnos">) {
  const ctx = await requireContext();
  if (!can(ctx.roles, "cash.history")) return <NoAccess />;
  const sp = await searchParams;
  const deps = serverDeps();
  const settings = await deps.tenant(ctx.restaurantId, async (r) => ({
    ok: true as const,
    value: await r.orderingSettings.get(),
  }));
  const tz = settings.ok ? settings.value.timezone : "America/Sao_Paulo";
  const now = deps.clock.now();
  const to = firstParam(sp.ate) ?? businessDay(now, tz);
  const from = firstParam(sp.de) ?? businessDay(new Date(now.getTime() - 6 * 86_400_000), tz);
  const r = await listCashSessions(deps, ctx, { from, to });
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Turnos do caixa"
        description="Cada abertura do caixa é um turno. Toque no dia para ver o relatório."
        back={{ href: "/caixa", label: "Voltar para o caixa" }}
      />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="de">De</Label>
          <Input id="de" type="date" name="de" defaultValue={from} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" type="date" name="ate" defaultValue={to} />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {r.ok ? (
        <SessionsList sessions={r.value.sessions.map(sessionRowView)} timezone={r.value.timezone} />
      ) : (
        <Alert>{messageFor(r.error)}</Alert>
      )}
    </div>
  );
}
