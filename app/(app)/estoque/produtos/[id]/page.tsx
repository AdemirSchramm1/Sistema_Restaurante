import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { setProductCustomizationAction, setSalePriceAction, updateRecipeAction } from "@/actions/recipes";
import { serverDeps } from "@/infra/server";
import { getRecipe, recipeFormOptions } from "@/application/inventory/recipes";
import { getProductCustomization } from "@/application/ordering/customization";
import { listDishesForKitchen } from "@/application/ordering/kitchen";
import { setProductSoldOutAction } from "@/actions/orders";
import { ActionForm } from "@/components/forms/action-form";
import { ProductCustomization } from "@/components/ordering/product-customization";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { RECIPE_KIND_LABELS } from "@/domain/inventory/recipe";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { RecipeForm, type ComponentOption } from "@/components/recipes/recipe-form";
import { recipeToValues } from "@/components/recipes/recipe-form-values";
import { RecipeActiveToggle } from "@/components/recipes/recipe-active-toggle";
import { HistoryList } from "@/components/audit/history-list";
import { SalePrice } from "@/components/recipes/sale-price";
import { money as moneyText, percent } from "@/components/costs/format";
import { COST_BAND_LABELS, evaluateProductCost } from "@/domain/inventory/product-cost";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Produto" };

const money = (v: Decimal) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`;
const brPrice = (v: Decimal) => formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 });

export default async function Page({ params, searchParams }: PageProps<"/estoque/produtos/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const view = await getRecipe(deps, ctx, id);
  if (!view.ok) notFound();
  const v = view.value;
  const [options, history, restaurant, custom, dishes] = await Promise.all([
    recipeFormOptions(deps, ctx, id),
    getAuditHistory(deps, ctx, "recipe", id),
    deps.tenant(ctx.restaurantId, async (r) => ({ ok: true as const, value: await r.restaurants.get() })),
    v.recipe.kind === "DISH" && can(ctx.roles, "addon.read") ? getProductCustomization(deps, ctx, id) : null,
    v.recipe.kind === "DISH" && can(ctx.roles, "product.sold_out") ? listDishesForKitchen(deps, ctx) : null,
  ]);
  const onMenu = dishes?.ok ? dishes.value.find((x) => x.id === id) : undefined;
  const timezone = restaurant.ok ? (restaurant.value?.timezone ?? "America/Sao_Paulo") : "America/Sao_Paulo";
  const canWrite = can(ctx.roles, "recipe.write");

  // Itens e preparos que já estão no produto continuam na lista mesmo se inativados depois.
  const opts = options.ok ? options.value : { items: [], preps: [] };
  const keep = (kind: "ITEM" | "RECIPE", list: ComponentOption[]) => {
    const ids = new Set(list.map((o) => o.id));
    const extra = v.lines
      .filter((l) => l.componentKind === kind && !ids.has(l.componentId))
      .map((l) => ({ id: l.componentId, label: `${l.name} (inativo)`, unit: l.componentUnit }));
    return [...list, ...extra];
  };
  const formOptions = { items: keep("ITEM", opts.items), preps: keep("RECIPE", opts.preps) };
  const isPrep = v.recipe.kind === "SUB_RECIPE";
  const nameOf = (kind: "ITEM" | "RECIPE", cid: string) =>
    v.lines.find((l) => l.componentKind === kind && l.componentId === cid)?.name;
  const priced = evaluateProductCost({
    id: v.recipe.id,
    name: v.recipe.name,
    salePrice: v.salePrice,
    cost: v.total,
    lines: v.lines.map((l) => ({ name: l.name, cost: l.cost })),
    missingCostNames: v.missingCostNames,
  });

  return (
    <div className="grid gap-6">
      {sp.criado && <Alert tone="success">Produto cadastrado.</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{v.recipe.name}</h1>
        {!v.recipe.active && <Badge tone="muted">inativo</Badge>}
        <span className="text-sm text-muted-foreground">
          {RECIPE_KIND_LABELS[v.recipe.kind]} · versão {v.versionNumber} desde{" "}
          {v.validFrom.toLocaleDateString("pt-BR", { timeZone: timezone })}
        </span>
        {canWrite && (
          <RecipeActiveToggle id={v.recipe.id} version={v.recipe.version} active={v.recipe.active} />
        )}
        {onMenu && (
          <>
            {onMenu.soldOut && <Badge tone="warn">esgotado hoje</Badge>}
            <ActionForm
              action={setProductSoldOutAction}
              hidden={{ recipeId: id, soldOut: String(!onMenu.soldOut) }}
              submitLabel={onMenu.soldOut ? "Disponível de novo" : "Esgotado hoje"}
              variant="ghost"
            />
          </>
        )}
      </div>
      {isPrep && v.usedBy.length > 0 && (
        <p className="text-sm">
          Usado em: <strong>{v.usedBy.join(", ")}</strong>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <RecipeForm
          key={`${v.recipe.version}`}
          action={updateRecipeAction}
          options={formOptions}
          initial={recipeToValues(v)}
          meta={{ id: v.recipe.id, version: v.recipe.version }}
          readOnly={!canWrite}
          submitLabel="Salvar alterações"
        />
        <aside className="grid content-start gap-6">
          {!isPrep && (
            <SalePrice
              id={v.recipe.id}
              version={v.recipe.version}
              salePrice={v.salePrice ? formatBrDecimal(v.salePrice, { minPlaces: 2, maxPlaces: 2 }) : null}
              costText={v.total ? moneyText(v.total) : null}
              shareText={priced.share ? percent(priced.share) : null}
              bandLabel={priced.band ? COST_BAND_LABELS[priced.band] : null}
              marginText={priced.margin ? moneyText(priced.margin) : null}
              marginNegative={!!priced.margin?.isNegative()}
              canEdit={canWrite && v.recipe.active}
              action={setSalePriceAction}
            />
          )}
          {custom?.ok && (
            // Sem `key` pela versão: remontar depois de salvar apagaria o "Quadro salvo.".
            <ProductCustomization
              recipeId={v.recipe.id}
              kind={v.recipe.kind}
              version={custom.value.version}
              addons={custom.value.addons.map((a) => ({ ...a, price: brPrice(a.price) }))}
              removables={custom.value.removables.map((r) => ({
                component: `${r.component.kind}:${r.component.id}`,
                name: nameOf(r.component.kind, r.component.id) ?? r.label.replace(/^sem\s+/i, ""),
                label: r.label,
                orphan: r.orphan,
              }))}
              candidates={custom.value.candidates.map((c) => ({
                component: `${c.component.kind}:${c.component.id}`,
                name: c.name,
              }))}
              available={custom.value.available.map((a) => ({ ...a, price: brPrice(a.price) }))}
              canEdit={can(ctx.roles, "addon.write") && v.recipe.active}
              action={setProductCustomizationAction}
            />
          )}
          <Card className="grid gap-2 text-sm" aria-label="Quanto custa">
            <CardTitle>Quanto custa</CardTitle>
            <p className="text-muted-foreground">
              Pelo custo médio de cada item. Atualiza sozinho com as compras.
            </p>
            <ul className="grid gap-1">
              {v.lines.map((l) => (
                <li key={`${l.componentKind}:${l.componentId}`} className="flex justify-between gap-2">
                  <span>
                    {l.name} · {formatBrDecimal(l.quantity)} {l.unit}
                  </span>
                  <span data-testid="line-cost">{l.cost ? money(l.cost) : "sem custo"}</span>
                </li>
              ))}
            </ul>
            <p
              className="flex justify-between border-t border-border pt-2 font-medium"
              data-testid="recipe-total"
            >
              <span>{isPrep ? "Rendimento inteiro" : "Total"}</span>
              <span>{v.total ? money(v.total) : "Sem custo ainda"}</span>
            </p>
            {isPrep && v.costPerYieldUnit && v.recipe.yieldUnit && (
              <p className="flex justify-between">
                <span>Por {v.recipe.yieldUnit}</span>
                <span>{money(v.costPerYieldUnit)}</span>
              </p>
            )}
            {v.missingCostNames.length > 0 && (
              <p className="text-muted-foreground">
                Falta custo de: {v.missingCostNames.join(", ")}. O custo aparece depois da primeira compra.
              </p>
            )}
          </Card>
          <Card className="grid gap-2">
            <CardTitle>Histórico</CardTitle>
            <HistoryList entries={history.ok ? history.value : []} timezone={timezone} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
