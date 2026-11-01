"use client";

import { useActionState } from "react";
import { setItemLocationsAction } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/forms/form-error";
import { LOCATION_KIND_LABELS, type LocationKind } from "@/domain/inventory/location";

type Link = { locationId: string; isDefault: boolean; sheetPosition: number };
type Option = { id: string; name: string; kind: LocationKind };

export function ItemLocations({
  itemId,
  links,
  options,
  canEdit,
}: {
  itemId: string;
  links: Link[];
  options: Option[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(setItemLocationsAction, null);
  const byId = new Map(links.map((l) => [l.locationId, l]));
  if (!canEdit) {
    return (
      <Card className="grid gap-2 text-sm">
        <CardTitle>Locais</CardTitle>
        {links.length === 0 && <p className="text-muted-foreground">Nenhum local definido.</p>}
        <ul>
          {options
            .filter((o) => byId.has(o.id))
            .map((o) => (
              <li key={o.id}>
                {o.name} · posição {byId.get(o.id)?.sheetPosition}
                {byId.get(o.id)?.isDefault && " · padrão"}
              </li>
            ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card className="grid gap-2 text-sm">
      <CardTitle>Locais</CardTitle>
      <form action={action} className="grid gap-2" aria-label="Locais do item">
        <input type="hidden" name="itemId" value={itemId} />
        {options.map((o) => {
          const link = byId.get(o.id);
          return (
            <fieldset key={o.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
              <input type="checkbox" name="loc" value={o.id} id={`loc_${o.id}`} defaultChecked={!!link} />
              <label htmlFor={`loc_${o.id}`}>
                {o.name} <span className="text-muted-foreground">({LOCATION_KIND_LABELS[o.kind]})</span>
              </label>
              <Input
                aria-label={`Posição na folha em ${o.name}`}
                name={`pos_${o.id}`}
                inputMode="numeric"
                className="h-8 w-16"
                defaultValue={link?.sheetPosition ?? 1}
              />
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="default"
                  value={o.id}
                  defaultChecked={link?.isDefault}
                  aria-label={`Local padrão: ${o.name}`}
                />{" "}
                padrão
              </label>
            </fieldset>
          );
        })}
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Salvar locais
        </Button>
        {state?.ok && <p role="status">Locais salvos.</p>}
        <FormError error={state && !state.ok ? state.error : null} />
      </form>
    </Card>
  );
}
