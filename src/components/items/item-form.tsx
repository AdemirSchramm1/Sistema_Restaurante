"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Alert, Card, CardTitle } from "@/components/ui/card";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import type { ActionState } from "@/actions/_session";
import {
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  COUNT_FREQUENCIES,
  COUNT_FREQUENCY_LABELS,
  stockUnitEquivalence,
} from "@/domain/inventory/item";
import { ALLERGENS, ALLERGEN_LABELS } from "@/domain/inventory/allergens";
import { UNITS, unitByCode, type UnitCode } from "@/domain/inventory/units";
import { d, formatBrDecimal, parseBrDecimal } from "@/domain/shared/decimal";
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

const fmt = (v: { toString(): string }) => formatBrDecimal(d(v.toString()), { maxPlaces: 4 });

/** Formulário do item: identificação, três unidades e os demais blocos do cadastro (FR-020 a FR-025). */
export function ItemForm({
  action,
  subgroups,
  initial,
  meta,
  stockUnitLocked,
  readOnly,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const error = state && !state.ok ? state.error : null;
  const [stockUnit, setStockUnit] = useState(String(initial.stockUnit) as UnitCode);
  const [recipeUnit, setRecipeUnit] = useState(String(initial.recipeUnit) as UnitCode);
  const [purchaseLabel, setPurchaseLabel] = useState(String(initial.purchaseUnitLabel ?? ""));
  const [purchaseFactor, setPurchaseFactor] = useState(String(initial.purchaseFactor ?? ""));
  const [conversionFactor, setConversionFactor] = useState(String(initial.conversionFactor ?? ""));
  const [simQty, setSimQty] = useState("1");
  const [noGtin, setNoGtin] = useState(Boolean(initial.noGtin));

  const needsConversion = unitByCode(stockUnit)?.dimension !== unitByCode(recipeUnit)?.dimension;

  const preview = useMemo(() => {
    const factor = parseBrDecimal(purchaseFactor);
    const qty = parseBrDecimal(simQty);
    const conv = parseBrDecimal(conversionFactor);
    if (!factor.ok || !qty.ok) return null;
    const r = stockUnitEquivalence(
      {
        description: "prévia",
        type: "INGREDIENT",
        subgroupId: "",
        stockUnit,
        recipeUnit,
        purchaseUnitLabel: purchaseLabel || "compra",
        purchaseFactor: factor.value,
        conversions:
          needsConversion && conv.ok ? [{ fromUnit: stockUnit, toUnit: recipeUnit, factor: conv.value }] : [],
      } as Parameters<typeof stockUnitEquivalence>[0],
      qty.value,
    );
    return r.ok ? r.value : null;
  }, [purchaseFactor, simQty, conversionFactor, stockUnit, recipeUnit, purchaseLabel, needsConversion]);

  const fe = (f: string) => fieldError(error, f);
  const v = (k: string) => String(initial[k] ?? "");
  const b = (k: string) => Boolean(initial[k]);
  const allergens = new Set((initial.allergens as string[]) ?? []);

  return (
    <form action={formAction} className="grid gap-6" aria-label="Cadastro do item">
      {meta && (
        <>
          <input type="hidden" name="id" value={meta.id} />
          <input type="hidden" name="version" value={meta.version} />
        </>
      )}
      <FormError error={error} />
      {state?.ok && <Alert tone="success">Alterações salvas.</Alert>}

      <fieldset disabled={readOnly} className="grid gap-6">
        <Card className="grid gap-4">
          <CardTitle>Identificação</CardTitle>
          <Field
            label="Descrição"
            htmlFor="description"
            hint="Nome, modificador, especificação e referência. Ex.: Tomate italiano, caixa 20 kg, tipo AA"
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
            <Field label="Grupo e subgrupo" htmlFor="subgroupId" error={fe("subgroupId")}>
              <Select id="subgroupId" name="subgroupId" defaultValue={v("subgroupId")} required>
                <option value="">Escolha…</option>
                {subgroups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="type" error={fe("type")}>
              <Select id="type" name="type" defaultValue={v("type")}>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ITEM_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Unidades</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Unidade de estoque (contagem)"
              htmlFor="stockUnit"
              hint={
                stockUnitLocked
                  ? "Bloqueada: o item já teve movimentação. Para mudar, inative o item e crie outro."
                  : undefined
              }
              error={fe("stockUnit")}
            >
              <Select
                id="stockUnit"
                name="stockUnit"
                value={stockUnit}
                onChange={(e) => setStockUnit(e.target.value as UnitCode)}
                disabled={stockUnitLocked}
              >
                {UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code} — {u.label}
                  </option>
                ))}
              </Select>
              {stockUnitLocked && <input type="hidden" name="stockUnit" value={stockUnit} />}
            </Field>
            <Field label="Unidade de receita (ficha técnica)" htmlFor="recipeUnit" error={fe("recipeUnit")}>
              <Select
                id="recipeUnit"
                name="recipeUnit"
                value={recipeUnit}
                onChange={(e) => setRecipeUnit(e.target.value as UnitCode)}
              >
                {UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code} — {u.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Unidade de compra (embalagem)"
              htmlFor="purchaseUnitLabel"
              hint="Ex.: Caixa 20 kg, Saco 50 kg, Caixa com 12"
              error={fe("purchaseUnitLabel")}
            >
              <Input
                id="purchaseUnitLabel"
                name="purchaseUnitLabel"
                value={purchaseLabel}
                onChange={(e) => setPurchaseLabel(e.target.value)}
                required
                maxLength={60}
              />
            </Field>
            <Field
              label={`Fator: quantos ${stockUnit} cabem em 1 unidade de compra`}
              htmlFor="purchaseFactor"
              error={fe("purchaseFactor")}
            >
              <Input
                id="purchaseFactor"
                name="purchaseFactor"
                inputMode="decimal"
                value={purchaseFactor}
                onChange={(e) => setPurchaseFactor(e.target.value)}
                required
              />
            </Field>
            {needsConversion && (
              <Field
                label={`Conversão do item: 1 ${stockUnit} equivale a quantos ${recipeUnit}?`}
                htmlFor="conversionFactor"
                hint="Ex.: 1 un de ovo = 50 g"
                error={fe("conversions") ?? fe("conversionFactor")}
              >
                <Input
                  id="conversionFactor"
                  name="conversionFactor"
                  inputMode="decimal"
                  value={conversionFactor}
                  onChange={(e) => setConversionFactor(e.target.value)}
                />
              </Field>
            )}
          </div>
          <div className="rounded-md bg-muted p-3 text-sm" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <span>Simular</span>
              <Input
                aria-label="Quantidade de compra para simular"
                className="h-8 w-24"
                inputMode="decimal"
                value={simQty}
                onChange={(e) => setSimQty(e.target.value)}
              />
              <span>{purchaseLabel || "unidade de compra"}</span>
              {preview ? (
                <strong data-testid="equivalence">
                  = {fmt(preview.stock)} {stockUnit} = {fmt(preview.recipe)} {recipeUnit}
                </strong>
              ) : (
                <span className="text-muted-foreground">
                  preencha o fator{needsConversion ? " e a conversão" : ""} para ver a equivalência
                </span>
              )}
            </div>
          </div>
        </Card>

        <details className="rounded-lg border border-border p-6" open={meta !== undefined}>
          <summary className="cursor-pointer text-lg font-semibold">Conservação e validade</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field
              label="Temperatura máx. de conservação (°C)"
              htmlFor="storageTempMaxC"
              error={fe("storageTempMaxC")}
            >
              <Input
                id="storageTempMaxC"
                name="storageTempMaxC"
                inputMode="decimal"
                defaultValue={v("storageTempMaxC")}
              />
            </Field>
            <Field label="Recebimento: mín. (°C)" htmlFor="receivingTempMinC" error={fe("receivingTempMinC")}>
              <Input
                id="receivingTempMinC"
                name="receivingTempMinC"
                inputMode="decimal"
                defaultValue={v("receivingTempMinC")}
              />
            </Field>
            <Field label="Recebimento: máx. (°C)" htmlFor="receivingTempMaxC" error={fe("receivingTempMaxC")}>
              <Input
                id="receivingTempMaxC"
                name="receivingTempMaxC"
                inputMode="decimal"
                defaultValue={v("receivingTempMaxC")}
              />
            </Field>
            <Field label="Validade fechado (dias)" htmlFor="shelfLifeDays" error={fe("shelfLifeDays")}>
              <Input
                id="shelfLifeDays"
                name="shelfLifeDays"
                inputMode="numeric"
                defaultValue={v("shelfLifeDays")}
              />
            </Field>
            <Field label="Validade após aberto (dias)" htmlFor="openedLifeDays" error={fe("openedLifeDays")}>
              <Input
                id="openedLifeDays"
                name="openedLifeDays"
                inputMode="numeric"
                defaultValue={v("openedLifeDays")}
              />
            </Field>
            <Field
              label="Alertar vencimento com (dias)"
              htmlFor="expiryAlertDays"
              error={fe("expiryAlertDays")}
            >
              <Input
                id="expiryAlertDays"
                name="expiryAlertDays"
                inputMode="numeric"
                defaultValue={v("expiryAlertDays")}
              />
            </Field>
            <Field
              label="Fator de correção padrão (FC)"
              htmlFor="correctionFactor"
              hint="Bruto ÷ limpo, 1 ou maior"
              error={fe("correctionFactor")}
            >
              <Input
                id="correctionFactor"
                name="correctionFactor"
                inputMode="decimal"
                defaultValue={v("correctionFactor")}
              />
            </Field>
            <Field
              label="Rendimento (0 a 1)"
              htmlFor="yieldFactor"
              hint="Ex.: chope 0,90"
              error={fe("yieldFactor")}
            >
              <Input
                id="yieldFactor"
                name="yieldFactor"
                inputMode="decimal"
                defaultValue={v("yieldFactor")}
              />
            </Field>
            <Field label="Apresentação" htmlFor="presentation" hint="Ex.: lata 2,8 kg">
              <Input id="presentation" name="presentation" defaultValue={v("presentation")} />
            </Field>
            <Field label={`Peso líquido (${stockUnit})`} htmlFor="netWeight" error={fe("netWeight")}>
              <Input id="netWeight" name="netWeight" inputMode="decimal" defaultValue={v("netWeight")} />
            </Field>
            <Field label={`Peso drenado (${stockUnit})`} htmlFor="drainedWeight" error={fe("drainedWeight")}>
              <Input
                id="drainedWeight"
                name="drainedWeight"
                inputMode="decimal"
                defaultValue={v("drainedWeight")}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox name="catchWeight" defaultChecked={b("catchWeight")} /> Peso variável (recebe pelo
              peso real)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox name="lotControl" defaultChecked={b("lotControl")} /> Controla lote
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Alérgenos (RDC 26/2015)</legend>
            {fe("allergens") && <p className="text-xs text-destructive">{fe("allergens")}</p>}
            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {ALLERGENS.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <Checkbox name="allergens" value={a} defaultChecked={allergens.has(a)} />{" "}
                  {ALLERGEN_LABELS[a]}
                </label>
              ))}
            </div>
          </fieldset>
        </details>

        <details className="rounded-lg border border-border p-6" open={meta !== undefined}>
          <summary className="cursor-pointer text-lg font-semibold">Fiscal e contagem</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="EAN/GTIN da unidade" htmlFor="eanUnit" error={fe("eanUnit")}>
              <Input
                id="eanUnit"
                name="eanUnit"
                inputMode="numeric"
                defaultValue={v("eanUnit")}
                disabled={noGtin}
              />
            </Field>
            <Field label="EAN/GTIN da embalagem" htmlFor="eanPackage" error={fe("eanPackage")}>
              <Input
                id="eanPackage"
                name="eanPackage"
                inputMode="numeric"
                defaultValue={v("eanPackage")}
                disabled={noGtin}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox name="noGtin" checked={noGtin} onChange={(e) => setNoGtin(e.target.checked)} /> SEM
              GTIN
            </label>
            <Field label="NCM" htmlFor="ncm" hint="8 dígitos. Confirme com o contador." error={fe("ncm")}>
              <Input id="ncm" name="ncm" inputMode="numeric" defaultValue={v("ncm")} />
            </Field>
            <Field label="CEST" htmlFor="cest" error={fe("cest")}>
              <Input id="cest" name="cest" inputMode="numeric" defaultValue={v("cest")} />
            </Field>
            <Field label="Origem (0 a 8)" htmlFor="origin" error={fe("origin")}>
              <Input id="origin" name="origin" inputMode="numeric" maxLength={1} defaultValue={v("origin")} />
            </Field>
            <Field label="Grupo tributário" htmlFor="taxGroup">
              <Input id="taxGroup" name="taxGroup" defaultValue={v("taxGroup")} />
            </Field>
            <Field label="Categoria financeira" htmlFor="financialCategory" hint='Ex.: "CMV alimentos"'>
              <Input id="financialCategory" name="financialCategory" defaultValue={v("financialCategory")} />
            </Field>
            <Field label="Frequência de contagem" htmlFor="countFrequency">
              <Select id="countFrequency" name="countFrequency" defaultValue={v("countFrequency")}>
                <option value="">Não definida</option>
                {COUNT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {COUNT_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <Checkbox name="countable" defaultChecked={b("countable")} /> Inventariável (entra nas folhas de
            contagem)
          </label>
        </details>
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
