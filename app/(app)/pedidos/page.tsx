import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listOrders, ordersBySource } from "@/application/ordering/orders";
import { businessDay } from "@/domain/ordering/business-day";
import {
  CANCEL_REASON_LABELS,
  tableWithSource,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/domain/ordering/order";
import { can } from "@/domain/access/permissions";
import { messageFor } from "@/components/forms/error-messages";
import { brl } from "@/components/ordering/format";
import { NoAccess } from "@/components/layout/no-access";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";
import { firstParam } from "@/lib/search-params";
import { placedByText } from "@/components/staff-ordering/format";

export const metadata: Metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

/** Consulta de pedidos por período (até 31 dias), mesa e situação (spec 009, US6). */
export default async function Page({ searchParams }: PageProps<"/pedidos">) {
  const ctx = await requireContext();
  if (!can(ctx.roles, "order.read")) return <NoAccess />;
  const sp = await searchParams;
  const deps = serverDeps();
  const restaurant = await deps.tenant(ctx.restaurantId, async (r) => ({
    ok: true as const,
    value: await r.orderingSettings.get(),
  }));
  const tz = restaurant.ok ? restaurant.value.timezone : "America/Sao_Paulo";
  const today = businessDay(deps.clock.now(), tz);
  const from = firstParam(sp.de) ?? today;
  const to = firstParam(sp.ate) ?? today;
  const status = ORDER_STATUSES.includes(firstParam(sp.situacao) as OrderStatus)
    ? (firstParam(sp.situacao) as OrderStatus)
    : undefined;
  const mesa = firstParam(sp.mesa)?.trim();
  const placedBy = firstParam(sp.lancado)?.trim() || undefined;
  const tableId = mesa
    ? await deps.tenant(ctx.restaurantId, async (repos) => ({
        ok: true as const,
        value: (await repos.tables.list(true)).find((t) => t.name.toLowerCase() === mesa.toLowerCase())?.id,
      }))
    : null;
  const [r, bySource] = await Promise.all([
    listOrders(deps, ctx, { from, to, status, placedBy }),
    ordersBySource(deps, ctx, {
      from,
      to,
      placedBy,
      tableId: tableId?.ok ? (tableId.value ?? "00000000-0000-0000-0000-000000000000") : undefined,
    }),
  ]);
  const rows = r.ok ? r.value.filter((o) => !mesa || o.tableName.toLowerCase() === mesa.toLowerCase()) : [];
  const options = bySource.ok ? bySource.value.placedByOptions : [];
  const time = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const date = (s: string) => s.split("-").reverse().join("/");

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Pedidos"
        description="Todos os pedidos das mesas, do período e da situação escolhidos."
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
        <div className="grid gap-1">
          <Label htmlFor="mesa">Mesa</Label>
          <Input id="mesa" name="mesa" defaultValue={mesa} className="w-24" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="situacao">Situação</Label>
          <Select id="situacao" name="situacao" defaultValue={status ?? ""}>
            <option value="">Todas</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lancado">Lançado por</Label>
          <Select id="lancado" name="lancado" defaultValue={placedBy ?? ""}>
            <option value="">Todos</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {!r.ok && <Alert>{messageFor(r.error)}</Alert>}
      {r.ok && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido no período.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Dia</Th>
              <Th>Hora</Th>
              <Th>Mesa</Th>
              <Th>Lançado por</Th>
              <Th>Situação</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td>
                  <TextLink href={`/pedidos/${o.id}`}>{o.number}</TextLink>
                </Td>
                <Td>{date(o.businessDay)}</Td>
                <Td>{time(o.submittedAt)}</Td>
                <Td>{tableWithSource(o.tableName, o.source)}</Td>
                <Td>{placedByText(o)}</Td>
                <Td>{ORDER_STATUS_LABELS[o.status]}</Td>
                <Td className="text-right">{brl(o.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {bySource.ok && bySource.value.summary.length > 0 && (
        <section aria-labelledby="por-origem" className="grid gap-2">
          <h2 id="por-origem" className="font-display text-xl font-semibold">
            Por quem lançou
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Lançado por</Th>
                <Th className="text-right">Pedidos</Th>
                <Th className="text-right">Total</Th>
                <Th>Cancelados</Th>
              </tr>
            </thead>
            <tbody>
              {bySource.value.summary.map((s) => (
                <tr key={s.placedById ?? s.source}>
                  <Td>{placedByText({ source: s.source, placedByName: s.name })}</Td>
                  <Td className="text-right">{s.count}</Td>
                  <Td className="text-right">{brl(s.total)}</Td>
                  <Td>
                    {s.cancelled.length
                      ? s.cancelled.map((c) => `${c.count} ${CANCEL_REASON_LABELS[c.reason]}`).join(", ")
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
