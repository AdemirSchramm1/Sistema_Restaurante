import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { cancelAdjustmentAction, decideAdjustmentAction, registerMovementAction } from "@/actions/movements";
import { serverDeps } from "@/infra/server";
import { listItems } from "@/application/inventory/list-items";
import { listAdjustmentRequests, listMovements } from "@/application/inventory/movements";
import { can } from "@/domain/access/permissions";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, type MovementType } from "@/domain/inventory/movement";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { MovementForm, type MovementItemOption } from "@/components/movements/movement-form";
import { MovementTable } from "@/components/movements/movement-table";
import { ActionForm } from "@/components/forms/action-form";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Lançamentos" };

const TIMEZONE = "America/Sao_Paulo";
const signed = (v: Decimal) => `${v.gt(0) ? "+" : ""}${formatBrDecimal(v, { maxPlaces: 4 })}`;

export default async function Page({ searchParams }: PageProps<"/estoque/lancamentos">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const deps = serverDeps();
  const typeFilter = MOVEMENT_TYPES.includes(sp.tipo as MovementType) ? (sp.tipo as MovementType) : undefined;

  const types = (
    [
      ["PURCHASE", "movement.purchase"],
      ["LOSS", "movement.loss"],
      ["ADJUSTMENT", "adjustment.request"],
    ] as const
  )
    .filter(([, action]) => can(ctx.roles, action))
    .map(([t]) => t);
  const canApprove = can(ctx.roles, "adjustment.approve");

  const [items, movements, pending] = await Promise.all([
    listItems(deps, ctx, { page: 1, status: "active" }),
    listMovements(deps, ctx, { type: typeFilter, limit: 100 }),
    listAdjustmentRequests(deps, ctx, { status: "PENDING" }),
  ]);
  const options: MovementItemOption[] = (items.ok ? items.value.rows : []).map((i) => ({
    id: i.id,
    label: i.description,
    unit: i.stockUnit,
    packageLabel: i.purchaseUnitLabel,
    packageFactor: i.purchaseFactor?.toString() ?? null,
    balance: i.balance.toString(),
  }));
  const today = new Date(deps.clock.now().getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const requests = pending.ok ? pending.value : [];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Lançamentos</h1>
      <p className="text-sm text-muted-foreground">
        Compras, perdas e acertos. O saldo de cada item é a soma destes lançamentos; para corrigir, estorne.
      </p>

      {types.length > 0 && (
        <Card className="grid gap-4">
          <CardTitle>Novo lançamento</CardTitle>
          <MovementForm action={registerMovementAction} items={options} types={types} today={today} />
        </Card>
      )}

      <section className="grid gap-2" aria-label="Acertos esperando aprovação">
        <h2 className="text-lg font-semibold">Acertos esperando aprovação</h2>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Sistema → prateleira</Th>
              <Th>Diferença</Th>
              <Th>Motivo</Th>
              <Th>Pedido por</Th>
              <Th>Decisão</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <Td>{r.itemName}</Td>
                <Td>
                  {formatBrDecimal(r.systemQuantity)} → {formatBrDecimal(r.countedQuantity)} {r.stockUnit}
                </Td>
                <Td>
                  {signed(r.difference)} {r.stockUnit}
                </Td>
                <Td>
                  {r.reasonLabel}
                  {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                </Td>
                <Td>{r.requestedByName ?? "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {canApprove && r.requestedBy !== ctx.userId && (
                      <>
                        <ActionForm
                          action={decideAdjustmentAction}
                          hidden={{ requestId: r.id, decision: "approve" }}
                          submitLabel="Aprovar"
                          variant="default"
                          aria-label={`Aprovar acerto de ${r.itemName}`}
                        />
                        <ActionForm
                          action={decideAdjustmentAction}
                          hidden={{ requestId: r.id, decision: "reject" }}
                          submitLabel="Recusar"
                          aria-label={`Recusar acerto de ${r.itemName}`}
                        />
                      </>
                    )}
                    {r.requestedBy === ctx.userId && (
                      <>
                        <span className="text-xs text-muted-foreground">Outro gerente precisa aprovar.</span>
                        <ActionForm
                          action={cancelAdjustmentAction}
                          hidden={{ requestId: r.id }}
                          submitLabel="Cancelar pedido"
                          aria-label={`Cancelar acerto de ${r.itemName}`}
                        />
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-center text-muted-foreground">
                  Nenhum acerto esperando.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </section>

      <section className="grid gap-2" aria-label="Últimos lançamentos">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Últimos lançamentos</h2>
          <form className="flex gap-2" role="search">
            <Select name="tipo" defaultValue={typeFilter ?? ""} aria-label="Filtrar por tipo">
              <option value="">Todos os tipos</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <button className={buttonVariants({ variant: "outline" })} type="submit">
              Filtrar
            </button>
          </form>
        </div>
        <MovementTable
          rows={movements.ok ? movements.value : []}
          timezone={TIMEZONE}
          canReverse={can(ctx.roles, "movement.reverse")}
        />
      </section>
    </div>
  );
}
