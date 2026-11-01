import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { updateItemAction } from "@/actions/items";
import { serverDeps } from "@/infra/server";
import { getItem } from "@/application/inventory/get-item";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { listLocations } from "@/application/inventory/locations";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { ITEM_TYPE_LABELS } from "@/domain/inventory/item";
import { ItemForm } from "@/components/items/item-form";
import { itemToValues } from "@/components/items/item-form-values";
import { subgroupOptions } from "@/components/items/subgroup-options";
import { ItemActiveToggle } from "@/components/items/item-active-toggle";
import { CogsOverride } from "@/components/items/cogs-override";
import { ItemLocations } from "@/components/items/item-locations";
import { HistoryList } from "@/components/audit/history-list";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Item" };

export default async function Page({ params, searchParams }: PageProps<"/estoque/itens/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const view = await getItem(deps, ctx, id);
  if (!view.ok) notFound();
  const { item, equivalence, effectiveInCogs, locations } = view.value;
  const [tree, locs, history, restaurant] = await Promise.all([
    listGroupTree(deps, ctx),
    listLocations(deps, ctx),
    getAuditHistory(deps, ctx, "item", id),
    deps.tenant(ctx.restaurantId, async (r) => ({ ok: true as const, value: await r.restaurants.get() })),
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
      {equivalence && (
        <p className="text-sm">
          Equivalência: 1 {item.purchaseUnitLabel} = {formatBrDecimal(equivalence.stock)} {item.stockUnit} ={" "}
          {formatBrDecimal(equivalence.recipe)} {item.recipeUnit}
        </p>
      )}

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
            <CardTitle>Custos</CardTitle>
            <p className="text-muted-foreground">
              Calculados pelas movimentações (feature 003). Não editáveis.
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
              <dt>Curva ABC</dt>
              <dd>{item.abcClass ?? "—"}</dd>
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
          <ItemLocations
            itemId={item.id}
            links={locations.map((l) => ({
              locationId: l.locationId,
              isDefault: l.isDefault,
              sheetPosition: l.sheetPosition,
            }))}
            options={locs.ok ? locs.value.map((l) => ({ id: l.id, name: l.name, kind: l.kind })) : []}
            canEdit={can(ctx.roles, "item_location.manage")}
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
