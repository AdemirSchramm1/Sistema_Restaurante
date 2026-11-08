import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getOrder } from "@/application/ordering/orders";
import { CANCEL_REASON_LABELS, ORDER_STATUS_LABELS } from "@/domain/ordering/order";
import { brl } from "@/components/ordering/cart-state";
import { LineChanges } from "@/components/ordering/line-changes";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pedido" };

export default async function Page({ params }: PageProps<"/pedidos/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const deps = serverDeps();
  const r = await getOrder(deps, ctx, id);
  if (!r.ok) notFound();
  const o = r.value;
  const tz = await deps.tenant(ctx.restaurantId, async (x) => ({
    ok: true as const,
    value: (await x.orderingSettings.get()).timezone,
  }));
  const timeZone = tz.ok ? tz.value : "America/Sao_Paulo";
  const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" });
  return (
    <div className="grid gap-4">
      <Link href="/pedidos" className="text-sm text-primary underline underline-offset-4">
        Voltar para os pedidos
      </Link>
      <h1 className="text-2xl font-semibold">
        Pedido {o.number} · Mesa {o.tableName}
      </h1>
      <p className="text-sm text-muted-foreground">
        {ORDER_STATUS_LABELS[o.status]}
        {o.cancelReason &&
          ` · ${CANCEL_REASON_LABELS[o.cancelReason]}${o.cancelNote ? `: ${o.cancelNote}` : ""}`}{" "}
        · enviado em {when(o.submittedAt)}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-2">
          <CardTitle>O que foi pedido</CardTitle>
          <ul className="grid gap-2">
            {o.lines.map((l, i) => (
              <li key={i}>
                <div className="flex justify-between gap-2">
                  <span>
                    {l.quantity} × {l.productName}
                  </span>
                  <span>{brl(l.unitPrice)} cada</span>
                </div>
                <LineChanges changes={l.changes} />
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total</span>
            <span>{brl(o.total)}</span>
          </p>
        </Card>
        <Card className="grid gap-2">
          <CardTitle>Situações</CardTitle>
          <ol className="grid gap-1 text-sm">
            {o.events.map((e, i) => (
              <li key={i}>
                {when(e.at)} · {ORDER_STATUS_LABELS[e.toStatus]}
                {e.reason && ` (${CANCEL_REASON_LABELS[e.reason]})`} · {e.userName ?? "Cliente pelo QR code"}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
