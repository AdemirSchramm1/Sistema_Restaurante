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
import {
  RECIPE_KINDS,
  RECIPE_KIND_LABELS,
  compatibleUnits,
  type RecipeKind,
} from "@/domain/inventory/recipe";
import { UNITS, type UnitCode } from "@/domain/inventory/units";
import { emptyLine, type RecipeFormValues, type RecipeLineValues } from "./recipe-form-values";

export type ComponentOption = { id: string; label: string; unit: UnitCode };

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  options: { items: ComponentOption[]; preps: ComponentOption[] };
  initial: RecipeFormValues;
  meta?: { id: string; version: number };
  readOnly?: boolean;
  submitLabel: string;
};

const ALL_UNITS = UNITS.map((u) => u.code);

/** Chave estável de cada linha, para o React não trocar uma linha pela outra ao tirar. */
let lineKey = 0;
const keyed = (l: RecipeLineValues) => ({ ...l, key: lineKey++ });

/** Formulário do produto: nome, tipo e o que vai nele (docs/produto/estoque/04-fichas-tecnicas.md). */
export function RecipeForm({ action, options, initial, meta, readOnly, submitLabel }: Props) {
  const { state, pending, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const fe = (f: string) => fieldError(error, f);

  const [kind, setKind] = useState<RecipeKind>(initial.kind);
  const [lines, setLines] = useState(() => initial.lines.map(keyed));

  const preps = options.preps.filter((p) => p.id !== meta?.id);
  const unitOf = new Map<string, UnitCode>([
    ...options.items.map((i) => [`ITEM:${i.id}`, i.unit] as const),
    ...preps.map((p) => [`RECIPE:${p.id}`, p.unit] as const),
  ]);

  const setLine = (i: number, patch: Partial<RecipeLineValues>) =>
    setLines((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        if (patch.component !== undefined) {
          const base = unitOf.get(patch.component);
          if (base && (!next.unit || !compatibleUnits(base).includes(next.unit as UnitCode)))
            next.unit = base;
        }
        return next;
      }),
    );

  return (
    <form {...formProps} className="grid gap-6" aria-label="Cadastro do produto">
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
          <p className="text-sm text-muted-foreground">
            {kind === "SUB_RECIPE"
              ? "Os itens para fazer o rendimento acima."
              : "Quanto de cada item ou preparo vai em 1 unidade vendida."}{" "}
            A quantidade pode ser numa medida menor da mesma família (ex.: g para itens em kg).
          </p>
          {fe("lines") && (
            <p className="text-sm text-destructive" role="alert">
              {fe("lines")}
            </p>
          )}
          <ol className="grid gap-3">
            {lines.map((line, i) => {
              const n = i + 1;
              const base = unitOf.get(line.component);
              const units = base ? compatibleUnits(base) : ALL_UNITS;
              const err = {
                component: fe(`lines.${i}.component`),
                quantity: fe(`lines.${i}.quantity`),
                unit: fe(`lines.${i}.unit`),
              };
              return (
                <li key={line.key} className="grid gap-2 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-start">
                  <div className="grid gap-1">
                    <Select
                      aria-label={`Item ou preparo da linha ${n}`}
                      name={`lines.${i}.component`}
                      value={line.component}
                      onChange={(e) => setLine(i, { component: e.target.value })}
                      aria-invalid={err.component ? true : undefined}
                    >
                      <option value="">Escolha…</option>
                      <optgroup label="Itens">
                        {options.items.map((o) => (
                          <option key={o.id} value={`ITEM:${o.id}`}>
                            {o.label} ({o.unit})
                          </option>
                        ))}
                      </optgroup>
                      {preps.length > 0 && (
                        <optgroup label="Preparos">
                          {preps.map((o) => (
                            <option key={o.id} value={`RECIPE:${o.id}`}>
                              {o.label} (rende em {o.unit})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                    {err.component && <LineError text={err.component} />}
                  </div>
                  <div className="grid gap-1">
                    <Input
                      aria-label={`Quanto vai (linha ${n})`}
                      name={`lines.${i}.quantity`}
                      inputMode="decimal"
                      placeholder="Ex.: 150"
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      aria-invalid={err.quantity ? true : undefined}
                    />
                    {err.quantity && <LineError text={err.quantity} />}
                  </div>
                  <div className="grid gap-1">
                    <Select
                      aria-label={`Medida (linha ${n})`}
                      name={`lines.${i}.unit`}
                      value={line.unit || base || ""}
                      onChange={(e) => setLine(i, { unit: e.target.value as UnitCode })}
                      aria-invalid={err.unit ? true : undefined}
                    >
                      {!base && <option value="">—</option>}
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                    {err.unit && <LineError text={err.unit} />}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Tirar a linha ${n}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    Tirar
                  </Button>
                </li>
              );
            })}
          </ol>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((ls) => [...ls, keyed(emptyLine)])}
            >
              Adicionar item ou preparo
            </Button>
          </div>
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

function LineError({ text }: { text: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {text}
    </p>
  );
}
