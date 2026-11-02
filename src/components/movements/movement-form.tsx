"use client";

import { useMemo, useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import type { ActionState } from "@/actions/_session";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/domain/inventory/movement";
import {
  MOVEMENT_REASONS,
  REASON_FAMILY_LABELS,
  type ReasonFamily,
} from "@/domain/inventory/movement-reasons";
import { compatibleUnits } from "@/domain/inventory/recipe";
import { convert, unitByCode, type UnitCode } from "@/domain/inventory/units";
import { d, formatBrDecimal, parseBrDecimal, type Decimal } from "@/domain/shared/decimal";

export type MovementItemOption = {
  id: string;
  label: string;
  unit: UnitCode;
  packageLabel: string | null;
  /** Quanto vem na embalagem, como texto decimal ("20"). */
  packageFactor: string | null;
  /** Saldo como texto decimal ("10.5"). */
  balance: string;
};

/** Fornecedor ativo com as embalagens dele por item (spec 007). */
export type MovementSupplierOption = {
  id: string;
  name: string;
  packages: { itemId: string; packageLabel: string; packageQuantity: string }[];
};

type FormType = Exclude<MovementType, "REVERSAL">;

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  items: MovementItemOption[];
  /** Tipos que a pessoa pode lançar. */
  types: FormType[];
  /** Data de hoje no fuso do restaurante (aaaa-mm-dd). */
  today: string;
  suppliers?: MovementSupplierOption[];
};

const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
const br = (v: Decimal) => formatBrDecimal(v, { maxPlaces: 4 });
const money = (v: Decimal) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`;

/** Lançamento de compra, perda ou pedido de acerto (spec 004). */
export function MovementForm({ action, items, types, today, suppliers = [] }: Props) {
  const { state, pending, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const fe = (f: string) => fieldError(error, f);

  const [type, setType] = useState<FormType>(types[0] ?? "LOSS");
  const [itemId, setItemId] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [supplierId, setSupplierId] = useState("");
  // Chave nova a cada lançamento aceito: reenviar o mesmo formulário não duplica (FR-007).
  const [baseKey] = useState(newKey);
  const key = `${baseKey}-${state?.ok ? state.at : 0}`;

  const item = items.find((i) => i.id === itemId);
  const supplierPackage =
    type === "PURCHASE"
      ? suppliers.find((s) => s.id === supplierId)?.packages.find((p) => p.itemId === itemId)
      : undefined;
  const units: { value: string; label: string }[] = item
    ? [
        ...compatibleUnits(item.unit).map((u) => ({ value: u, label: u })),
        ...(type === "PURCHASE" && item.packageLabel
          ? [{ value: "PACKAGE", label: `${item.packageLabel} (${br(d(item.packageFactor!))} ${item.unit})` }]
          : []),
        ...(supplierPackage
          ? [
              {
                value: "SUPPLIER_PACKAGE",
                label: `${supplierPackage.packageLabel} do fornecedor (${br(d(supplierPackage.packageQuantity))} ${item.unit})`,
              },
            ]
          : []),
      ]
    : [];
  const currentUnit = units.some((u) => u.value === unit) ? unit : (item?.unit ?? "");

  /** Quantidade digitada → medida do item. */
  const inItemUnit = useMemo((): Decimal | null => {
    if (!item) return null;
    const q = parseBrDecimal(quantity);
    if (!q.ok) return null;
    if (currentUnit === "PACKAGE") return item.packageFactor ? q.value.times(d(item.packageFactor)) : null;
    if (currentUnit === "SUPPLIER_PACKAGE")
      return supplierPackage ? q.value.times(d(supplierPackage.packageQuantity)) : null;
    const from = unitByCode(currentUnit);
    if (!from) return null;
    const r = convert(q.value, from, unitByCode(item.unit)!);
    return r.ok ? r.value : null;
  }, [item, quantity, currentUnit, supplierPackage]);

  let preview: string | null = null;
  if (item && inItemUnit) {
    if (type === "PURCHASE") preview = `Vai entrar: ${br(inItemUnit)} ${item.unit}`;
    if (type === "LOSS") preview = `Vai sair: ${br(inItemUnit)} ${item.unit}`;
    if (type === "ADJUSTMENT") {
      const diff = inItemUnit.minus(d(item.balance));
      preview = diff.isZero()
        ? "Sem diferença: o saldo já é esse."
        : `Diferença: ${diff.lt(0) ? "−" : "+"}${br(diff.abs())} ${item.unit} (${diff.lt(0) ? "faltam" : "sobram"})`;
    }
  }
  const totalPaid = parseBrDecimal(total);
  const unitCost =
    type === "PURCHASE" && item && inItemUnit && inItemUnit.gt(0) && totalPaid.ok
      ? `${money(totalPaid.value.dividedBy(inItemUnit))} por ${item.unit}`
      : null;

  const reasons = MOVEMENT_REASONS.filter((r) => r.movementType === type);
  const families = [...new Set(reasons.map((r) => r.family))] as ReasonFamily[];
  const qtyName = type === "ADJUSTMENT" ? "countedQuantity" : "quantity";

  return (
    <form {...formProps} className="grid gap-4" aria-label="Lançamento">
      <input type="hidden" name="idempotencyKey" value={key} />
      <FormError error={error} />
      {state?.ok && (
        <Alert tone="success">
          {type === "ADJUSTMENT" ? "Pedido de acerto enviado para aprovação." : "Lançamento registrado."}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de lançamento" htmlFor="type" error={fe("type")}>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as FormType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t === "ADJUSTMENT" ? "Pedir acerto do saldo" : MOVEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Item" htmlFor="itemId" error={fe("itemId")}>
          <Select
            id="itemId"
            name="itemId"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
          >
            <option value="">Escolha um item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} ({i.unit})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {type === "PURCHASE" && suppliers.length > 0 && (
        <Field
          label="Fornecedor (opcional)"
          htmlFor="supplierId"
          hint="De quem foi a compra. Fornecedor bloqueado não aparece."
          error={fe("supplierId")}
        >
          <Select
            id="supplierId"
            name="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="sm:w-80"
          >
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {item && (
        <p className="text-sm text-muted-foreground" data-testid="movement-balance">
          Em estoque: {br(d(item.balance))} {item.unit}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[10rem_12rem_1fr]">
        <Field
          label={type === "ADJUSTMENT" ? "Quanto tem de verdade" : "Quantidade"}
          htmlFor={qtyName}
          error={fe(qtyName)}
        >
          <Input
            id={qtyName}
            name={qtyName}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={fe(qtyName) ? true : undefined}
            required
          />
        </Field>
        <Field label="Medida" htmlFor="unit" error={fe("unit")}>
          <Select id="unit" name="unit" value={currentUnit} onChange={(e) => setUnit(e.target.value)}>
            {!item && <option value="">—</option>}
            {units.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        {type === "PURCHASE" && (
          <Field
            label="Valor total pago (R$)"
            htmlFor="totalPaid"
            hint="O valor da nota para essa quantidade. Ex.: 240,00"
            error={fe("totalPaid")}
          >
            <Input
              id="totalPaid"
              name="totalPaid"
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              aria-invalid={fe("totalPaid") ? true : undefined}
              className="sm:w-40"
              required
            />
          </Field>
        )}
      </div>
      <div className="grid gap-1 text-sm" aria-live="polite">
        {preview && <p data-testid="movement-preview">{preview}</p>}
        {unitCost && <p data-testid="movement-unit-cost">{unitCost}</p>}
      </div>
      {type !== "PURCHASE" && (
        <Field label="Motivo" htmlFor="reasonId" error={fe("reasonId")}>
          <Select id="reasonId" name="reasonId" defaultValue="" required className="sm:w-80">
            <option value="">Escolha o motivo…</option>
            {families.map((f) => (
              <optgroup key={f} label={REASON_FAMILY_LABELS[f]}>
                {reasons
                  .filter((r) => r.family === f)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        {type !== "ADJUSTMENT" && (
          <Field label="Data" htmlFor="occurredAt" error={fe("occurredAt")}>
            <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today} max={today} />
          </Field>
        )}
        <Field label="Observação (opcional)" htmlFor="notes" hint="Ex.: de quem comprou, o que aconteceu">
          <Input id="notes" name="notes" maxLength={500} />
        </Field>
      </div>
      {type === "ADJUSTMENT" && (
        <p className="text-sm text-muted-foreground">
          Outro gerente precisa aprovar: o saldo só muda depois da aprovação, e quem pede não aprova.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : type === "ADJUSTMENT" ? "Pedir acerto" : "Lançar"}
        </Button>
      </div>
    </form>
  );
}
