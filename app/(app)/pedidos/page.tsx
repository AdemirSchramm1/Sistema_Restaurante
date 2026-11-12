import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listOrders } from "@/application/ordering/orders";
import { businessDay } from "@/domain/ordering/business-day";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/ordering/order";
import { can } from "@/domain/access/permissions";
import { messageFor } from "@/components/forms/error-messages";
import { brl } from "@/components/ordering/cart-state";
import { NoAccess } from "@/components/layout/no-access";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

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
  const from = one(sp.de) ?? today;
  const to = one(sp.ate) ?? today;
  const status = ORDER_STATUSES.includes(one(sp.situacao) as OrderStatus)
    ? (one(sp.situacao) as OrderStatus)
    : undefined;
  const mesa = one(sp.mesa)?.trim();
  const r = await listOrders(deps, ctx, { from, to, status });
  const rows = r.ok ? r.value.filter((o) => !mesa || o.tableName.toLowerCase() === mesa.toLowerCase()) : [];
  const time = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const date = (s: string) => s.split("-").reverse().join("/");

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Pedidos</h1>
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
              <Th>Situação</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td>
                  <Link href={`/pedidos/${o.id}`} className="text-primary underline-offset-4 hover:underline">
                    {o.number}
                  </Link>
                </Td>
                <Td>{date(o.businessDay)}</Td>
                <Td>{time(o.submittedAt)}</Td>
                <Td>{o.tableName}</Td>
                <Td>{ORDER_STATUS_LABELS[o.status]}</Td>
                <Td className="text-right">{brl(o.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
