import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { setAddonActiveAction, updateAddonAction } from "@/actions/addons";
import { serverDeps } from "@/infra/server";
import { getAddon } from "@/application/ordering/addons";
import { recipeFormOptions } from "@/application/inventory/recipes";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { COST_BAND_LABELS } from "@/domain/inventory/product-cost";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { money, percent } from "@/components/costs/format";
import { priceOrFree } from "@/components/ordering/format";
import { AddonForm } from "@/components/ordering/addon-form";
import { ActionForm } from "@/components/forms/action-form";
import { HistoryList } from "@/components/audit/history-list";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Adicional" };

export default async function Page({ params, searchParams }: PageProps<"/pedidos/adicionais/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const r = await getAddon(deps, ctx, id);
  if (!r.ok) notFound();
  const a = r.value;
  const [options, history, restaurant] = await Promise.all([
    recipeFormOptions(deps, ctx),
    getAuditHistory(deps, ctx, "addon", id),
    deps.tenant(ctx.restaurantId, async (x) => ({ ok: true as const, value: await x.restaurants.get() })),
  ]);
  const timezone = restaurant.ok ? (restaurant.value?.timezone ?? "America/Sao_Paulo") : "America/Sao_Paulo";
  const canWrite = can(ctx.roles, "addon.write");
  const opts = options.ok ? options.value : { items: [], preps: [] };
  // O componente atual fica na lista mesmo se foi inativado.
  const kindList = a.component.kind === "ITEM" ? opts.items : opts.preps;
  if (!kindList.some((o) => o.id === a.component.id))
    kindList.push({ id: a.component.id, label: `${a.componentName} (inativo)`, unit: a.unit });

  return (
    <div className="grid gap-6">
      {sp.criado && <Alert tone="success">Adicional cadastrado.</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{a.name}</h1>
        {!a.active && <Badge tone="muted">inativo</Badge>}
        <span className="text-sm text-muted-foreground">{priceOrFree(a.price)}</span>
        {canWrite && (
          <ActionForm
            action={setAddonActiveAction}
            hidden={{ id: a.id, version: a.version, active: String(!a.active) }}
            submitLabel={a.active ? "Inativar" : "Reativar"}
            variant="ghost"
          />
        )}
      </div>
      {a.componentInactive && (
        <Alert>
          {a.componentName} está inativo. Este adicional não aparece no cardápio até trocar o que vai nele.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <AddonForm
            key={a.version}
            action={updateAddonAction}
            options={opts}
            initial={{
              name: a.name,
              component: `${a.component.kind}:${a.component.id}`,
              quantity: formatBrDecimal(a.quantity),
              unit: a.unit,
              price: formatBrDecimal(a.price, { minPlaces: 2, maxPlaces: 2 }),
            }}
            meta={{ id: a.id, version: a.version }}
            readOnly={!canWrite}
            submitLabel="Salvar alterações"
          />
        </Card>
        <aside className="grid content-start gap-6">
          <Card className="grid gap-2 text-sm" aria-label="Quanto custa">
            <CardTitle>Quanto custa</CardTitle>
            <p className="flex justify-between">
              <span>Custo de uma vez</span>
              <span>{a.cost ? money(a.cost) : "sem custo"}</span>
            </p>
            {a.costShare && a.band && (
              <p className="flex justify-between">
                <span>Custo no preço</span>
                <span>
                  {percent(a.costShare)} · {COST_BAND_LABELS[a.band]}
                </span>
              </p>
            )}
          </Card>
          <Card className="grid gap-2 text-sm">
            <CardTitle>Produtos que oferecem</CardTitle>
            {a.usedBy.length === 0 ? (
              <p className="text-muted-foreground">Nenhum ainda. Ligue no quadro &quot;Adicionar e tirar&quot; do produto.</p>
            ) : (
              <ul className="grid gap-1">
                {a.usedBy.map((p) => (
                  <li key={p.id}>
                    <Link href={`/estoque/produtos/${p.id}`} className="text-primary underline-offset-4 hover:underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
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
