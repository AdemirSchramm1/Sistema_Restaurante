import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import {
  addSupplierItemAction,
  removeSupplierItemAction,
  setSupplierActiveAction,
  updateSupplierAction,
  updateSupplierItemAction,
} from "@/actions/suppliers";
import { serverDeps } from "@/infra/server";
import { getSupplier } from "@/application/suppliers/suppliers";
import { movementItemOptions } from "@/application/inventory/movements";
import { getAuditHistory } from "@/application/audit/get-audit-history";
import { can } from "@/domain/access/permissions";
import { formatCnpj } from "@/domain/suppliers/cnpj";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { supplierToValues } from "@/components/suppliers/supplier-form-values";
import { ActionForm } from "@/components/forms/action-form";
import { SupplierItems, type SupplierItemRow } from "@/components/suppliers/supplier-items";
import { HistoryList } from "@/components/audit/history-list";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Fornecedor" };

export default async function Page({ params, searchParams }: PageProps<"/estoque/fornecedores/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const deps = serverDeps();
  const view = await getSupplier(deps, ctx, id);
  if (!view.ok) notFound();
  const { supplier, items } = view.value;
  const [history, restaurant, activeItems] = await Promise.all([
    getAuditHistory(deps, ctx, "supplier", id),
    deps.tenant(ctx.restaurantId, async (r) => ({ ok: true as const, value: await r.restaurants.get() })),
    movementItemOptions(deps, ctx),
  ]);
  const timezone = restaurant.ok ? (restaurant.value?.timezone ?? "America/Sao_Paulo") : "America/Sao_Paulo";
  const canWrite = can(ctx.roles, "supplier.write");

  const rows: SupplierItemRow[] = items.map((i) => ({
    id: i.id,
    version: i.version,
    itemId: i.itemId,
    itemName: i.itemActive ? i.itemName : `${i.itemName} (inativo)`,
    unit: i.stockUnit,
    packageLabel: i.packageLabel,
    packageQuantity: i.packageQuantity?.toString() ?? null,
    price: i.price.toString(),
    pricePerUnit: i.pricePerUnit.toString(),
    preferred: i.preferred,
    lastPurchase: i.lastPurchase
      ? {
          date: i.lastPurchase.at.toLocaleDateString("pt-BR", { timeZone: timezone }),
          unitCost: i.lastPurchase.unitCost.toString(),
        }
      : null,
  }));
  const itemOptions = (activeItems.ok ? activeItems.value : []).map((i) => ({
    id: i.id,
    label: i.description,
    unit: i.stockUnit,
  }));

  return (
    <div className="grid gap-6">
      {sp.criado && <Alert tone="success">Fornecedor cadastrado. Agora diga o que ele vende.</Alert>}
      <PageHeader
        title={supplier.name}
        back={{ href: "/estoque/fornecedores", label: "Voltar para os fornecedores" }}
        badges={!supplier.active && <Badge tone="danger">bloqueado</Badge>}
        description={supplier.cnpj && <span className="font-mono">{formatCnpj(supplier.cnpj)}</span>}
        actions={
          canWrite && (
            <ActionForm
              action={setSupplierActiveAction}
              hidden={{ id: supplier.id, version: supplier.version, active: String(!supplier.active) }}
              submitLabel={supplier.active ? "Bloquear" : "Desbloquear"}
            />
          )
        }
      />
      {!supplier.active && (
        <p className="text-sm text-muted-foreground">
          Bloqueado: não aparece para escolher na compra. O histórico continua.
        </p>
      )}

      <section className="grid gap-2" aria-label="Itens que vende">
        <h2 className="text-lg font-semibold">Itens que vende</h2>
        <p className="text-sm text-muted-foreground">
          O preço combinado com o fornecedor. A compra lançada não muda este preço; a última compra aparece ao
          lado.
        </p>
        <SupplierItems
          supplierId={supplier.id}
          rows={rows}
          items={itemOptions}
          canWrite={canWrite}
          addAction={addSupplierItemAction}
          updateAction={updateSupplierItemAction}
          removeAction={removeSupplierItemAction}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <SupplierForm
          key={supplier.version}
          action={updateSupplierAction}
          initial={supplierToValues(supplier)}
          meta={{ id: supplier.id, version: supplier.version }}
          readOnly={!canWrite}
          submitLabel="Salvar alterações"
        />
        <aside className="grid content-start gap-6">
          <Card className="grid gap-2">
            <CardTitle>Histórico</CardTitle>
            <HistoryList entries={history.ok ? history.value : []} timezone={timezone} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
