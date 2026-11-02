import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { updateItemAction } from "@/actions/items";
import { serverDeps } from "@/infra/server";
import { getItem } from "@/application/inventory/get-item";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { ITEM_TYPE_LABELS } from "@/domain/inventory/item";
import { ItemForm } from "@/components/items/item-form";
import { itemToValues } from "@/components/items/item-form-values";
import { subgroupOptions } from "@/components/items/subgroup-options";
import { ItemActiveToggle } from "@/components/items/item-active-toggle";
import { CogsOverride } from "@/components/items/cogs-override";
import { HistoryList } from "@/components/audit/history-list";
import { MovementTable } from "@/components/movements/movement-table";
import { listMovements } from "@/application/inventory/movements";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Item" };

export default async function Page({ params, searchParams }: PageProps<"/estoque/itens/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const view = await getItem(deps, ctx, id);
  if (!view.ok) notFound();
  const { item, purchaseSummary, effectiveInCogs, balance } = view.value;
  const [tree, history, restaurant, movements] = await Promise.all([
    listGroupTree(deps, ctx),
    getAuditHistory(deps, ctx, "item", id),
    deps.tenant(ctx.restaurantId, async (r) => ({ ok: true as const, value: await r.restaurants.get() })),
    listMovements(deps, ctx, { itemId: id, limit: 20 }),
  ]);
  const timezone = restaurant.ok ? (restaurant.value?.timezone ?? "America/Sao_Paulo") : "America/Sao_Paulo";
  const canWrite = can(ctx.roles, "item.write");
  const money = (v: typeof item.averageCost) =>
    v ? `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 4 })}` : "—";

  return (
    <div className="grid gap-6">
      {sp.criado && <Alert tone="success">Item cadastrado com o código {item.code}.</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{item.description}</h1>
        <Badge className="font-mono" aria-label="Código do item">
          {item.code}
        </Badge>
        {!item.active && <Badge tone="muted">inativo</Badge>}
        <span className="text-sm text-muted-foreground">
          {ITEM_TYPE_LABELS[item.type]} · {item.groupName} › {item.subgroupName}
        </span>
        {canWrite && <ItemActiveToggle id={item.id} version={item.version} active={item.active} />}
      </div>
      <p className="text-sm">
        Controlado em <strong>{item.stockUnit}</strong>
        {purchaseSummary ? ` · compra: ${purchaseSummary}` : " · comprado solto"}
      </p>

      <section className="grid gap-2" aria-label="Lançamentos do item">
        <h2 className="text-lg font-semibold">Últimos lançamentos</h2>
        <MovementTable
          rows={movements.ok ? movements.value : []}
          timezone={timezone}
          canReverse={can(ctx.roles, "movement.reverse")}
          showItem={false}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ItemForm
          action={updateItemAction}
          subgroups={tree.ok ? subgroupOptions(tree.value, item.subgroupId) : []}
          initial={itemToValues(item)}
          meta={{ id: item.id, version: item.version }}
          stockUnitLocked={item.stockUnitLockedAt !== null}
          readOnly={!canWrite}
          submitLabel="Salvar alterações"
        />
        <aside className="grid content-start gap-6">
          <Card className="grid gap-2 text-sm">
            <CardTitle>Estoque e custos</CardTitle>
            <p className="text-base" data-testid="item-balance">
              Em estoque:{" "}
              <strong>
                {formatBrDecimal(balance, { maxPlaces: 4 })} {item.stockUnit}
              </strong>
            </p>
            <p className="text-muted-foreground">
              Custos calculados sozinhos pelas compras. Não dá para editar.
            </p>
            <dl className="grid grid-cols-2 gap-1">
              <dt>Custo médio</dt>
              <dd>{money(item.averageCost)}</dd>
              <dt>Último custo</dt>
              <dd>{money(item.lastCost)}</dd>
              <dt>Atualizado em</dt>
              <dd>
                {item.costUpdatedAt
                  ? item.costUpdatedAt.toLocaleDateString("pt-BR", { timeZone: timezone })
                  : "—"}
              </dd>
            </dl>
          </Card>
          <CogsOverride
            id={item.id}
            version={item.version}
            override={item.inCogsOverride}
            groupInCogs={item.groupInCogs}
            effective={effectiveInCogs}
            canEdit={can(ctx.roles, "item.cogs_override")}
          />
          <Card className="grid gap-2">
            <CardTitle>Histórico</CardTitle>
            <HistoryList entries={history.ok ? history.value : []} timezone={timezone} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
