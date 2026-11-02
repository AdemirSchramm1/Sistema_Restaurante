"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { useFormAction } from "@/components/forms/use-form-action";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import type { ActionState } from "@/actions/_session";
import type { UnitCode } from "@/domain/inventory/units";
import { d, formatBrDecimal, parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { pricePerUnit } from "@/domain/suppliers/supplier";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Linha da tabela, só com texto (atravessa do servidor para o cliente). */
export type SupplierItemRow = {
  id: string;
  version: number;
  itemId: string;
  itemName: string;
  unit: UnitCode;
  packageLabel: string | null;
  /** Texto decimal ("18"). */
  packageQuantity: string | null;
  price: string;
  pricePerUnit: string;
  preferred: boolean;
  /** Data já formatada e custo por medida. */
  lastPurchase: { date: string; unitCost: string } | null;
};

const money = (v: Decimal, max = 2) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: max })}`;
const br = (v: string) => formatBrDecimal(d(v), { maxPlaces: 4 });

export const packageText = (r: Pick<SupplierItemRow, "packageLabel" | "packageQuantity" | "unit">) =>
  r.packageLabel ? `${r.packageLabel} de ${br(r.packageQuantity!)} ${r.unit}` : `Solto (por ${r.unit})`;

/** Preço por medida enquanto a pessoa digita. */
function useUnitPrice() {
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const p = parseBrDecimal(price);
  const q = parseBrDecimal(qty);
  const value =
    p.ok && p.value.gt(0)
      ? pricePerUnit({ price: p.value, packageQuantity: q.ok && q.value.gt(0) ? q.value : null })
      : null;
  return { price, setPrice, qty, setQty, value };
}

function OfferFields({
  unit,
  initial,
  error,
}: {
  unit: UnitCode | null;
  initial?: SupplierItemRow;
  error: ReturnType<typeof useFormAction>["error"];
}) {
  const fe = (f: string) => fieldError(error, f);
  const calc = useUnitPrice();
  const prefix = initial ? `${initial.id}-` : "new-";
  return (
    <>
      <Field
        label="Preço (R$)"
        htmlFor={`${prefix}price`}
        hint="Pela embalagem, ou por medida se vier solto."
        error={fe("price")}
      >
        <Input
          id={`${prefix}price`}
          name="price"
          inputMode="decimal"
          defaultValue={
            initial ? formatBrDecimal(d(initial.price), { minPlaces: 2, maxPlaces: 4 }) : undefined
          }
          onChange={(e) => calc.setPrice(e.target.value)}
          required
          className="sm:w-32"
        />
      </Field>
      <Field
        label="Embalagem (opcional)"
        htmlFor={`${prefix}packageLabel`}
        hint="Ex.: Caixa, Saco, Fardo"
        error={fe("packageLabel")}
      >
        <Input
          id={`${prefix}packageLabel`}
          name="packageLabel"
          defaultValue={initial?.packageLabel ?? undefined}
          maxLength={60}
          className="sm:w-36"
        />
      </Field>
      <Field
        label={`Quanto vem${unit ? ` (${unit})` : ""}`}
        htmlFor={`${prefix}packageQuantity`}
        error={fe("packageQuantity")}
      >
        <Input
          id={`${prefix}packageQuantity`}
          name="packageQuantity"
          inputMode="decimal"
          defaultValue={initial?.packageQuantity ? br(initial.packageQuantity) : undefined}
          onChange={(e) => calc.setQty(e.target.value)}
          className="sm:w-28"
        />
      </Field>
      <label className="flex items-center gap-1.5 self-center text-sm">
        <Checkbox name="preferred" defaultChecked={initial?.preferred} />
        Marcar como preferido
      </label>
      {calc.value && unit && (
        <p className="basis-full text-sm" data-testid="supplier-item-unit-price">
          = {money(calc.value)}/{unit}
        </p>
      )}
    </>
  );
}

function AddForm({
  supplierId,
  items,
  action,
}: {
  supplierId: string;
  items: { id: string; label: string; unit: UnitCode }[];
  action: Action;
}) {
  const { pending, error, state, formProps } = useFormAction(action, { resetOnSuccess: true });
  const [itemId, setItemId] = useState("");
  const item = items.find((i) => i.id === itemId);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3" aria-label="Adicionar item ao fornecedor">
      <input type="hidden" name="supplierId" value={supplierId} />
      <Field label="Item" htmlFor="new-itemId" error={fieldError(error, "itemId")}>
        <Select
          id="new-itemId"
          name="itemId"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          required
          className="sm:w-64"
        >
          <option value="">Escolha um item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label} ({i.unit})
            </option>
          ))}
        </Select>
      </Field>
      <OfferFields key={state?.ok ? state.at : 0} unit={item?.unit ?? null} error={error} />
      <Button type="submit" size="sm" disabled={pending}>
        Adicionar
      </Button>
      {error && !error.field && (
        <div className="basis-full">
          <FormError error={error} />
        </div>
      )}
      {error?.field && (
        <p className="basis-full text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </form>
  );
}

function EditForm({ row, action }: { row: SupplierItemRow; action: Action }) {
  const { pending, error, state, formProps } = useFormAction(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3" aria-label={`Editar ${row.itemName}`}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="version" value={row.version} />
      <OfferFields unit={row.unit} initial={row} error={error} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Salvar
      </Button>
      {state?.ok && (
        <p role="status" className="text-sm">
          Salvo.
        </p>
      )}
      {error && (
        <p className="basis-full text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </form>
  );
}

/** Itens que o fornecedor vende e por quanto (spec 007, US2). */
export function SupplierItems({
  supplierId,
  rows,
  items,
  canWrite,
  addAction,
  updateAction,
  removeAction,
}: {
  supplierId: string;
  rows: SupplierItemRow[];
  /** Itens ativos do restaurante. */
  items: { id: string; label: string; unit: UnitCode }[];
  canWrite: boolean;
  addAction: Action;
  updateAction: Action;
  removeAction: Action;
}) {
  const listed = new Set(rows.map((r) => r.itemId));
  return (
    <div className="grid gap-4">
      <Table aria-label="Itens que vende">
        <thead>
          <tr>
            <Th>Item</Th>
            <Th>Embalagem</Th>
            <Th>Preço</Th>
            <Th>Por medida</Th>
            <Th>Última compra</Th>
            {canWrite && <Th>Mudar</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <Td>
                {r.itemName} {r.preferred && <Badge>Preferido</Badge>}
              </Td>
              <Td>{packageText(r)}</Td>
              <Td>{money(d(r.price), 4)}</Td>
              <Td>
                {money(d(r.pricePerUnit))}/{r.unit}
              </Td>
              <Td>
                {r.lastPurchase
                  ? `${r.lastPurchase.date}: ${money(d(r.lastPurchase.unitCost))}/${r.unit}`
                  : "—"}
              </Td>
              {canWrite && (
                <Td>
                  <details>
                    <summary className="cursor-pointer text-sm text-primary">Editar</summary>
                    <div className="mt-2 grid gap-2">
                      <EditForm row={r} action={updateAction} />
                      <ActionForm
                        action={removeAction}
                        hidden={{ id: r.id }}
                        submitLabel={`Tirar ${r.itemName}`}
                        aria-label={`Tirar ${r.itemName} da lista`}
                      />
                    </div>
                  </details>
                </Td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                Nenhum item ainda.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {canWrite && (
        <AddForm supplierId={supplierId} items={items.filter((i) => !listed.has(i.id))} action={addAction} />
      )}
    </div>
  );
}
