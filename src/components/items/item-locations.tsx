"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { setItemLocationsAction } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/forms/form-error";
import { LOCATION_KIND_LABELS, type LocationKind } from "@/domain/inventory/location";

type Link = { locationId: string; isDefault: boolean };
type Option = { id: string; name: string; kind: LocationKind };

/** Onde o item fica guardado: marque os locais e escolha o principal. */
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
  const { state, pending, formProps } = useFormAction(setItemLocationsAction);
  const byId = new Map(links.map((l) => [l.locationId, l]));
  if (!canEdit) {
    return (
      <Card className="grid gap-2 text-sm">
        <CardTitle>Onde fica guardado</CardTitle>
        {links.length === 0 && <p className="text-muted-foreground">Nenhum local definido.</p>}
        <ul>
          {options
            .filter((o) => byId.has(o.id))
            .map((o) => (
              <li key={o.id}>
                {o.name}
                {byId.get(o.id)?.isDefault && " · principal"}
              </li>
            ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card className="grid gap-2 text-sm">
      <CardTitle>Onde fica guardado</CardTitle>
      {options.length === 0 ? (
        <p className="text-muted-foreground">Cadastre os locais na tela Locais para escolher aqui.</p>
      ) : (
        <form {...formProps} className="grid gap-2" aria-label="Locais do item">
          <p className="text-muted-foreground">Marque onde o item fica. Se ficar em mais de um, escolha o principal.</p>
          <input type="hidden" name="itemId" value={itemId} />
          {options.map((o) => {
            const link = byId.get(o.id);
            return (
              <div key={o.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <input type="checkbox" name="loc" value={o.id} id={`loc_${o.id}`} defaultChecked={!!link} />
                <label htmlFor={`loc_${o.id}`}>
                  {o.name} <span className="text-muted-foreground">({LOCATION_KIND_LABELS[o.kind]})</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="default"
                    value={o.id}
                    defaultChecked={link?.isDefault}
                    aria-label={`Local principal: ${o.name}`}
                  />{" "}
                  principal
                </label>
              </div>
            );
          })}
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Salvar locais
          </Button>
          {state?.ok && <p role="status">Locais salvos.</p>}
          <FormError error={state && !state.ok ? state.error : null} />
        </form>
      )}
    </Card>
  );
}
