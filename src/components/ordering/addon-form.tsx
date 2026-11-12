"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import { UNIT_OPTION_LABELS } from "@/components/items/item-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { compatibleUnits } from "@/domain/inventory/recipe";
import { UNITS, type UnitCode } from "@/domain/inventory/units";

export type AddonOption = { id: string; label: string; unit: UnitCode };
export type AddonFormValues = {
  name: string;
  component: string;
  quantity: string;
  unit: UnitCode | "";
  price: string;
};

export type AddonFormProps = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  options: { items: AddonOption[]; preps: AddonOption[] };
  initial: AddonFormValues;
  meta?: { id: string; version: number };
  readOnly?: boolean;
  submitLabel: string;
};

const isZero = (v: string) => /^\s*0*(?:[.,]0*)?\s*$/.test(v) && /0/.test(v);

/** Adicional: o botão "+" do cardápio, com o que vai no prato e o preço (spec 010, US1). */
export function AddonForm({ action, options, initial, meta, readOnly, submitLabel }: AddonFormProps) {
  const { state, pending, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const fe = (f: string) => fieldError(error, f);
  const [component, setComponent] = useState(initial.component);
  const [unit, setUnit] = useState<string>(initial.unit);
  const [price, setPrice] = useState(initial.price);

  const unitOf = new Map<string, UnitCode>([
    ...options.items.map((i) => [`ITEM:${i.id}`, i.unit] as const),
    ...options.preps.map((p) => [`RECIPE:${p.id}`, p.unit] as const),
  ]);
  const base = unitOf.get(component);
  const units = base ? compatibleUnits(base) : UNITS.map((u) => u.code);

  const choose = (value: string) => {
    setComponent(value);
    const b = unitOf.get(value);
    if (b && !compatibleUnits(b).includes(unit as UnitCode)) setUnit(b);
  };

  return (
    <form {...formProps} className="grid gap-4" aria-label="Cadastro do adicional">
      {meta && (
        <>
          <input type="hidden" name="id" value={meta.id} />
          <input type="hidden" name="version" value={meta.version} />
        </>
      )}
      {error && !error.field && <FormError error={error} />}
      {state?.ok && <Alert tone="success">Alterações salvas.</Alert>}
      <fieldset disabled={readOnly} className="grid gap-4">
        <Field
          label="Nome do botão"
          htmlFor="addon-name"
          hint="Como o cliente vê: Fatia de queijo"
          error={fe("name")}
        >
          <Input id="addon-name" name="name" defaultValue={initial.name} maxLength={40} required />
        </Field>
        <Field label="O que vai" htmlFor="addon-component" error={fe("component")}>
          <Select
            id="addon-component"
            name="component"
            value={component}
            onChange={(e) => choose(e.target.value)}
            required
          >
            <option value="">Escolha um item ou preparo</option>
            <optgroup label="Itens">
              {options.items.map((o) => (
                <option key={o.id} value={`ITEM:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Preparos">
              {options.preps.map((o) => (
                <option key={o.id} value={`RECIPE:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Quantidade"
            htmlFor="addon-quantity"
            hint="Por vez que o cliente toca no +"
            error={fe("quantity")}
          >
            <Input
              id="addon-quantity"
              name="quantity"
              inputMode="decimal"
              defaultValue={initial.quantity}
              required
            />
          </Field>
          <Field label="Medida" htmlFor="addon-unit" error={fe("unit")}>
            <Select
              id="addon-unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            >
              {!unit && <option value="">Escolha</option>}
              {units.map((u) => (
                <option key={u} value={u}>
                  {UNIT_OPTION_LABELS[u]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Preço (R$)"
          htmlFor="addon-price"
          hint="Use 0 para adicional grátis"
          error={fe("price")}
        >
          <Input
            id="addon-price"
            name="price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="3,00"
          />
        </Field>
        {isZero(price) && <p className="text-sm font-medium">Grátis no cardápio</p>}
      </fieldset>
      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
