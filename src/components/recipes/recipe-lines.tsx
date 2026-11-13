"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { compatibleUnits, type RecipeKind } from "@/domain/inventory/recipe";
import { UNITS, type UnitCode } from "@/domain/inventory/units";
import { emptyLine, type RecipeLineValues } from "./recipe-form-values";

export type ComponentOption = { id: string; label: string; unit: UnitCode };

const ALL_UNITS = UNITS.map((u) => u.code);

/** Chave estável de cada linha, para o React não trocar uma linha pela outra ao tirar. */
let lineKey = 0;
const keyed = (l: RecipeLineValues) => ({ ...l, key: lineKey++ });

/**
 * "O que vai nele": as linhas de item ou preparo do produto. Usado no cadastro do produto (003) e
 * no produto novo da tela Cardápio (013), que pede campos de 44 px (`touch`).
 */
export function RecipeLines({
  options,
  initial,
  kind,
  fe,
  excludeId,
  touch = false,
}: {
  options: { items: ComponentOption[]; preps: ComponentOption[] };
  initial: RecipeLineValues[];
  kind: RecipeKind;
  /** Mensagem de erro do campo, se o servidor recusou. */
  fe: (field: string) => string | null;
  /** O próprio produto não pode entrar nele mesmo. */
  excludeId?: string;
  touch?: boolean;
}) {
  const [lines, setLines] = useState(() => initial.map(keyed));
  const size = touch ? ("lg" as const) : undefined;
  const buttonSize = touch ? ("lg" as const) : ("sm" as const);

  const preps = options.preps.filter((p) => p.id !== excludeId);
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
    <>
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
                  size={size}
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
                  size={size}
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
                  size={size}
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
                size={buttonSize}
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
          size={buttonSize}
          onClick={() => setLines((ls) => [...ls, keyed(emptyLine)])}
        >
          Adicionar item ou preparo
        </Button>
      </div>
    </>
  );
}

function LineError({ text }: { text: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {text}
    </p>
  );
}
