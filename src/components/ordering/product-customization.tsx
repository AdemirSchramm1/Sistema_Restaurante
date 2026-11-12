"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { defaultRemovalLabel, MAX_ADDON_TIMES, MAX_OPTIONS } from "@/domain/ordering/customization";
import type { RecipeKind } from "@/domain/inventory/recipe";
import { priceOrFree } from "./format";

/** Valores prontos do servidor (preço como "3.00", componente como "ITEM:id"). */
export type ProductCustomizationProps = {
  recipeId: string;
  kind: RecipeKind;
  version: number;
  addons: { addonId: string; name: string; price: string; maxTimes: number }[];
  removables: { component: string; name: string; label: string; orphan: boolean }[];
  candidates: { component: string; name: string }[];
  available: { addonId: string; name: string; price: string }[];
  canEdit: boolean;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
};

const TIMES = Array.from({ length: MAX_ADDON_TIMES }, (_, i) => i + 1);

/**
 * Quadro "Adicionar e tirar" da página do produto vendido (spec 010, US2). Mudar o quadro não cria
 * versão nova do produto.
 */
export function ProductCustomization(props: ProductCustomizationProps) {
  const { state, pending, formProps } = useFormAction(props.action);
  const [addons, setAddons] = useState(props.addons);
  const [removables, setRemovables] = useState(props.removables);
  const [pickAddon, setPickAddon] = useState("");
  const [pickRemoval, setPickRemoval] = useState("");
  if (props.kind !== "DISH") return null;

  const freeAddons = props.available.filter((a) => !addons.some((x) => x.addonId === a.addonId));
  const freeCandidates = props.candidates.filter((c) => !removables.some((x) => x.component === c.component));
  const edit = props.canEdit;

  const addAddon = () => {
    const a = props.available.find((x) => x.addonId === pickAddon);
    if (!a) return;
    setAddons((list) => [...list, { ...a, maxTimes: 1 }]);
    setPickAddon("");
  };
  const addRemoval = () => {
    const c = props.candidates.find((x) => x.component === pickRemoval);
    if (!c) return;
    setRemovables((list) => [...list, { component: c.component, name: c.name, label: "", orphan: false }]);
    setPickRemoval("");
  };

  return (
    <Card className="grid gap-4" aria-label="Adicionar e tirar">
      <CardTitle>Adicionar e tirar</CardTitle>
      <p className="text-sm text-muted-foreground">
        Os botões que o cliente vê no cardápio. Mudanças diferentes disso, só com o garçom.
      </p>
      <form {...formProps} className="grid gap-4" aria-label="Quadro adicionar e tirar">
        <input type="hidden" name="recipeId" value={props.recipeId} />
        <input type="hidden" name="version" value={props.version} />
        <FormError error={state && !state.ok ? state.error : null} />
        {state?.ok && <Alert tone="success">Quadro salvo.</Alert>}

        <fieldset className="grid gap-2" aria-label="Adicionar">
          <legend className="font-medium">Adicionar</legend>
          {addons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum adicional ligado.</p>}
          <ul className="grid gap-2">
            {addons.map((a, i) => (
              <li key={a.addonId} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name={`addons.${i}.addonId`} value={a.addonId} />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{priceOrFree(a.price)}</span>
                <label className="flex items-center gap-1">
                  <span>até</span>
                  <Select
                    name={`addons.${i}.maxTimes`}
                    aria-label={`Até quantas vezes: ${a.name}`}
                    value={String(a.maxTimes)}
                    disabled={!edit}
                    onChange={(e) =>
                      setAddons((list) =>
                        list.map((x, j) => (j === i ? { ...x, maxTimes: Number(e.target.value) } : x)),
                      )
                    }
                    className="w-16"
                  >
                    {TIMES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                  <span>{a.maxTimes === 1 ? "vez" : "vezes"}</span>
                </label>
                {edit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Desligar ${a.name}`}
                    onClick={() => setAddons((list) => list.filter((_, j) => j !== i))}
                  >
                    Desligar
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {edit && freeAddons.length > 0 && addons.length < MAX_OPTIONS && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Ligar adicional"
                value={pickAddon}
                onChange={(e) => setPickAddon(e.target.value)}
              >
                <option value="">Escolha um adicional</option>
                {freeAddons.map((a) => (
                  <option key={a.addonId} value={a.addonId}>
                    {a.name} · {priceOrFree(a.price)}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={addAddon} disabled={!pickAddon}>
                Ligar
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-2" aria-label="Tirar">
          <legend className="font-medium">Tirar</legend>
          {removables.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum ingrediente pode ser tirado pelo cliente.</p>
          )}
          <ul className="grid gap-2">
            {removables.map((r, i) => (
              <li key={r.component} className="grid gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name={`removables.${i}.component`} value={r.component} />
                  <span className="w-32 font-medium">{r.name}</span>
                  <Input
                    name={`removables.${i}.label`}
                    aria-label={`Texto do botão: ${r.name}`}
                    value={r.label}
                    placeholder={defaultRemovalLabel(r.name)}
                    maxLength={40}
                    disabled={!edit}
                    onChange={(e) =>
                      setRemovables((list) =>
                        list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    className="w-48"
                  />
                  {edit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remover ${r.name} da lista`}
                      onClick={() => setRemovables((list) => list.filter((_, j) => j !== i))}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                {r.orphan && (
                  <p className="text-xs font-medium text-warning-soft-foreground">
                    {r.name} saiu do produto: este botão não aparece mais no cardápio. Remova da lista.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {edit && freeCandidates.length > 0 && removables.length < MAX_OPTIONS && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Deixar tirar"
                value={pickRemoval}
                onChange={(e) => setPickRemoval(e.target.value)}
              >
                <option value="">Escolha o que vai no produto</option>
                {freeCandidates.map((c) => (
                  <option key={c.component} value={c.component}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={addRemoval} disabled={!pickRemoval}>
                Deixar tirar
              </Button>
            </div>
          )}
        </fieldset>

        {edit && (
          <div>
            <Button type="submit" disabled={pending}>
              Salvar quadro
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
