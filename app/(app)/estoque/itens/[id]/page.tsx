import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { updateItemAction } from "@/actions/items";
import { serverDeps } from "@/infra/server";
import { getItem } from "@/application/inventory/get-item";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { Decimal, formatBrDecimal } from "@/domain/shared/decimal";
import { ITEM_TYPE_LABELS } from "@/domain/inventory/item";
import { ItemForm } from "@/components/items/item-form";
import { itemToValues } from "@/components/items/item-form-values";
import { subgroupOptions } from "@/components/items/subgroup-options";
import { ItemActiveToggle } from "@/components/items/item-active-toggle";
import { CogsOverride } from "@/components/items/cogs-override";
import { HistoryList } from "@/components/audit/history-list";
import { MovementTable } from "@/components/movements/movement-table";
import { listMovements } from "@/application/inventory/movements";
import { listItemOffers } from "@/application/suppliers/suppliers";
import { ItemOffers } from "@/components/suppliers/item-offers";
import { ReorderLevels } from "@/components/items/reorder-levels";
import { getReorderView } from "@/application/inventory/reorder";
import { setReorderLevelsAction } from "@/actions/reorder";
import { itemUsage } from "@/application/inventory/product-costs";
import { ItemUsage } from "@/components/costs/item-usage";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { StockBalance } from "@/components/items/stock-balance";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Item" };

export default async function Page({ params, searchParams }: PageProps<"/estoque/itens/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const view = await getItem(deps, ctx, id);
  if (!view.ok) notFound();
  const { item, purchaseSummary, effectiveInCogs, balance } = view.value;
  const [tree, history, restaurant, movements, offers, reorder, usage] = await Promise.all([
    listGroupTree(deps, ctx),
    getAuditHistory(deps, ctx, "item", id),
    deps.tenant(ctx.restaurantId, async (r) => ({ ok: true as const, value: await r.restaurants.get() })),
    listMovements(deps, ctx, { itemId: id, limit: 20 }),
    listItemOffers(deps, ctx, id),
    getReorderView(deps, ctx, id),
    itemUsage(deps, ctx, id),
  ]);
  const timezone = restaurant.ok ? (restaurant.value?.timezone ?? "America/Sao_Paulo") : "America/Sao_Paulo";
  const canWrite = can(ctx.roles, "item.write");
  const qty = (v: Decimal | null) => (v === null ? null : formatBrDecimal(v, { maxPlaces: 4 }));
  // Sugestão arredondada para cima em 2 casas só na tela (spec 006, FR-005).
  const up = (v: Decimal) => formatBrDecimal(v.toDecimalPlaces(2, Decimal.ROUND_CEIL), { maxPlaces: 2 });
  const suggestion = reorder.ok ? reorder.value.suggestion : null;
  const money = (v: typeof item.averageCost) =>
    v ? `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 4 })}` : "—";

  return (
    <div className="grid gap-6">
      {sp.criado && <Alert tone="success">Item cadastrado com o código {item.code}.</Alert>}
      <PageHeader
        title={item.description}
        back={{ href: "/estoque/itens", label: "Voltar para os itens" }}
        badges={
          <>
            <Badge className="font-mono" aria-label="Código do item">
              {item.code}
            </Badge>
            {!item.active && <Badge tone="neutral">inativo</Badge>}
          </>
        }
        description={`${ITEM_TYPE_LABELS[item.type]} · ${item.groupName} › ${item.subgroupName}`}
        actions={canWrite && <ItemActiveToggle id={item.id} version={item.version} active={item.active} />}
      />
      <p className="text-sm">
        Controlado em <strong>{item.stockUnit}</strong>
        {purchaseSummary ? ` · compra: ${purchaseSummary}` : " · comprado solto"}
      </p>

      <section className="grid gap-2" aria-label="Fornecedores do item">
        <h2 className="text-lg font-semibold">Fornecedores</h2>
        <ItemOffers offers={offers.ok ? offers.value : []} unit={item.stockUnit} timezone={timezone} />
      </section>

      <section className="grid gap-2" aria-label="Lançamentos do item">
        <h2 className="text-lg font-semibold">Últimos lançamentos</h2>
        <MovementTable
          rows={movements.ok ? movements.value : []}
          timezone={timezone}
          canReverse={can(ctx.roles, "movement.reverse")}
          showItem={false}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
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
            <StockBalance balance={balance} unit={item.stockUnit} />
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
          <ReorderLevels
            id={item.id}
            version={item.version}
            unit={item.stockUnit}
            reorderPoint={qty(item.reorderPoint)}
            parLevel={qty(item.parLevel)}
            atReorderPoint={reorder.ok && reorder.value.atReorderPoint}
            suggestion={
              suggestion && {
                reorderPoint: up(suggestion.reorderPoint),
                parLevel: up(suggestion.parLevel),
                averageDailyUsage: formatBrDecimal(suggestion.averageDailyUsage, { maxPlaces: 2 }),
                leadTimeDays: suggestion.leadTimeDays,
                cycleDays: formatBrDecimal(suggestion.cycleDays, { maxPlaces: 1 }),
              }
            }
            canEdit={item.active && can(ctx.roles, "item.reorder")}
            action={setReorderLevelsAction}
          />
          <ItemUsage rows={usage.ok ? usage.value : []} />
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
