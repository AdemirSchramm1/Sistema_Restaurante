"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import type { ActionState } from "@/actions/_session";
import { ITEM_TYPES, ITEM_TYPE_HINTS, ITEM_TYPE_LABELS, describePurchase } from "@/domain/inventory/item";
import { UNITS, type UnitCode } from "@/domain/inventory/units";
import { parseBrDecimal } from "@/domain/shared/decimal";
import type { ItemFormValues } from "./item-form-values";

export type SubgroupOption = { id: string; label: string };

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  subgroups: SubgroupOption[];
  initial: ItemFormValues;
  meta?: { id: string; version: number };
  stockUnitLocked?: boolean;
  readOnly?: boolean;
  submitLabel: string;
};

/** Nome de cada medida na tela. */
export const UNIT_OPTION_LABELS: Record<UnitCode, string> = {
  kg: "Quilo (kg)",
  g: "Grama (g)",
  l: "Litro (l)",
  ml: "Mililitro (ml)",
  un: "Unidade (un)",
};

/** Formulário do item em três perguntas (docs/produto/estoque/02-cadastro-de-itens.md). */
export function ItemForm({
  action,
  subgroups,
  initial,
  meta,
  stockUnitLocked,
  readOnly,
  submitLabel,
}: Props) {
  const { state, pending, saved, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const [stockUnit, setStockUnit] = useState(String(initial.stockUnit) as UnitCode);
  const [purchaseLabel, setPurchaseLabel] = useState(String(initial.purchaseUnitLabel));
  const [purchaseFactor, setPurchaseFactor] = useState(String(initial.purchaseFactor));

  const summary = useMemo(() => {
    const factor = parseBrDecimal(purchaseFactor);
    return describePurchase({
      stockUnit,
      purchaseUnitLabel: purchaseLabel,
      purchaseFactor: factor.ok ? factor.value : null,
    });
  }, [purchaseFactor, purchaseLabel, stockUnit]);

  const fe = (f: string) => fieldError(error, f);
  // Os valores vêm sempre completos (emptyItemValues ou itemToValues).
  const v = (k: string) => String(initial[k]);

  return (
    <form {...formProps} className="grid gap-6" aria-label="Cadastro do item">
      {meta && (
        <>
          <input type="hidden" name="id" value={meta.id} />
          <input type="hidden" name="version" value={meta.version} />
        </>
      )}
      <FormError error={error} />
      {saved && <Alert tone="success">Alterações salvas.</Alert>}

      <fieldset disabled={readOnly} className="grid gap-6">
        <Card className="grid gap-4">
          <CardTitle>O que é</CardTitle>
          <Field
            label="Nome do item"
            htmlFor="description"
            hint="Como a equipe chama o item. Ex.: Tomate, Arroz branco, Coca-Cola lata"
            error={fe("description")}
          >
            <Input
              id="description"
              name="description"
              defaultValue={v("description")}
              required
              minLength={3}
              maxLength={200}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Grupo"
              htmlFor="subgroupId"
              hint="Onde o item aparece na lista. Ex.: Hortifrúti › Legumes"
              error={fe("subgroupId")}
            >
              <Select id="subgroupId" name="subgroupId" defaultValue={v("subgroupId")} required>
                <option value="">Escolha um grupo…</option>
                {subgroups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="type" hint="Para que o item serve." error={fe("type")}>
              <Select id="type" name="type" defaultValue={v("type")}>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ITEM_TYPE_LABELS[t]} — {ITEM_TYPE_HINTS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Em que medida você controla este item?</CardTitle>
          <Field
            label="Medida"
            htmlFor="stockUnit"
            hint={
              stockUnitLocked
                ? "Não dá para mudar: o item já teve entrada ou saída. Para mudar, inative o item e crie outro."
                : "O estoque vai diminuir nessa medida quando os clientes pedirem. Ex.: carne em quilo, ovo em unidade."
            }
            error={fe("stockUnit")}
          >
            <Select
              id="stockUnit"
              name="stockUnit"
              value={stockUnit}
              onChange={(e) => setStockUnit(e.target.value as UnitCode)}
              disabled={stockUnitLocked}
              className="sm:w-64"
            >
              {UNITS.map((u) => (
                <option key={u.code} value={u.code}>
                  {UNIT_OPTION_LABELS[u.code]}
                </option>
              ))}
            </Select>
            {stockUnitLocked && <input type="hidden" name="stockUnit" value={stockUnit} />}
          </Field>
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Como você compra? (opcional)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha só se o item chega em embalagem fechada (caixa, saco, fardo). Se compra solto, deixe em
            branco.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Embalagem"
              htmlFor="purchaseUnitLabel"
              hint="Ex.: Caixa, Saco, Fardo"
              error={fe("purchaseUnitLabel")}
            >
              <Input
                id="purchaseUnitLabel"
                name="purchaseUnitLabel"
                value={purchaseLabel}
                onChange={(e) => setPurchaseLabel(e.target.value)}
                maxLength={60}
              />
            </Field>
            <Field
              label="Quanto vem em cada embalagem"
              htmlFor="purchaseFactor"
              hint={`Na medida do item. Ex.: 20 (${stockUnit})`}
              error={fe("purchaseFactor")}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="purchaseFactor"
                  name="purchaseFactor"
                  inputMode="decimal"
                  value={purchaseFactor}
                  onChange={(e) => setPurchaseFactor(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground" data-testid="purchase-unit">
                  {stockUnit}
                </span>
              </div>
            </Field>
          </div>
          <p className="rounded-md bg-muted p-3 text-sm" aria-live="polite" data-testid="purchase-summary">
            {summary ??
              (purchaseLabel.trim()
                ? `Falta dizer quanto vem em cada ${purchaseLabel.trim()}.`
                : "Sem embalagem: o item é comprado solto.")}
          </p>
        </Card>
      </fieldset>

      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
