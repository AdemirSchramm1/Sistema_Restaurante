"use client";

import { useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import { UNIT_OPTION_LABELS } from "@/components/items/item-form";
import type { ActionState } from "@/actions/_session";
import { RECIPE_KINDS, RECIPE_KIND_LABELS, type RecipeKind } from "@/domain/inventory/recipe";
import { UNITS } from "@/domain/inventory/units";
import type { RecipeFormValues } from "./recipe-form-values";
import { RecipeLines, type ComponentOption } from "./recipe-lines";

export type { ComponentOption };

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  options: { items: ComponentOption[]; preps: ComponentOption[] };
  initial: RecipeFormValues;
  meta?: { id: string; version: number };
  readOnly?: boolean;
  submitLabel: string;
};

/** Formulário do produto: nome, tipo e o que vai nele (docs/produto/estoque/04-fichas-tecnicas.md). */
export function RecipeForm({ action, options, initial, meta, readOnly, submitLabel }: Props) {
  const { state, pending, saved, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const fe = (f: string) => fieldError(error, f);

  const [kind, setKind] = useState<RecipeKind>(initial.kind);
  return (
    <form {...formProps} className="grid gap-6" aria-label="Cadastro do produto">
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
            label="Nome do produto"
            htmlFor="name"
            hint="Como aparece no cardápio ou como a cozinha chama. Ex.: X-Burger, Molho de tomate"
            error={fe("name")}
          >
            <Input id="name" name="name" defaultValue={initial.name} required minLength={3} maxLength={120} />
          </Field>
          <Field
            label="Tipo"
            htmlFor="kind"
            hint="Preparo é algo feito na cozinha e usado dentro de outros produtos (molho, massa)."
            error={fe("kind")}
          >
            <Select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as RecipeKind)}
            >
              {RECIPE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RECIPE_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "SUB_RECIPE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Quanto rende"
                htmlFor="yieldQuantity"
                hint="Quanto sai de uma vez com as quantidades abaixo. Ex.: 2 (kg de molho)"
                error={fe("yieldQuantity")}
              >
                <Input
                  id="yieldQuantity"
                  name="yieldQuantity"
                  inputMode="decimal"
                  defaultValue={initial.yieldQuantity}
                  className="w-32"
                />
              </Field>
              <Field label="Medida do rendimento" htmlFor="yieldUnit" error={fe("yieldUnit")}>
                <Select id="yieldUnit" name="yieldUnit" defaultValue={initial.yieldUnit} className="sm:w-48">
                  {UNITS.map((u) => (
                    <option key={u.code} value={u.code}>
                      {UNIT_OPTION_LABELS[u.code]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </Card>

        <Card className="grid gap-4">
          <CardTitle>O que vai nele</CardTitle>
          <RecipeLines options={options} initial={initial.lines} kind={kind} fe={fe} excludeId={meta?.id} />
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
