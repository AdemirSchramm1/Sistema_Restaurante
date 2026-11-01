import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  applySuggestedLocationsAction,
  createLocationAction,
  setLocationActiveAction,
  updateLocationAction,
} from "@/actions/locations";
import { serverDeps } from "@/infra/server";
import { listLocations } from "@/application/inventory/locations";
import { can } from "@/domain/access/permissions";
import { LOCATION_KIND_LABELS } from "@/domain/inventory/location";
import { SUGGESTED_LOCATIONS } from "@/domain/inventory/suggested-locations";
import { ActionForm } from "@/components/forms/action-form";
import { LocationFields } from "@/components/locations/location-fields";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/input";

export const metadata: Metadata = { title: "Locais" };

export default async function Page({ searchParams }: PageProps<"/estoque/locais">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const deps = serverDeps();
  const manage = can(ctx.roles, "location.manage");
  const locs = await listLocations(deps, ctx, true);
  if (!locs.ok) return <Alert>Não foi possível carregar os locais.</Alert>;
  const existing = new Set(locs.value.map((l) => l.name));
  const suggestions = SUGGESTED_LOCATIONS.filter((s) => !existing.has(s.name));
  const firstAccess = sp["primeiro-acesso"] === "1";

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Locais</h1>
        <p className="text-sm text-muted-foreground">
          Os lugares onde você guarda os itens: despensa, geladeira, freezer…
        </p>
      </div>
      {manage && suggestions.length > 0 && (firstAccess || locs.value.length === 0) && (
        <Card className="grid gap-3">
          <CardTitle>Comece pelos locais sugeridos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marque os que existem no seu restaurante. Dá para renomear e ajustar depois.
          </p>
          <ActionForm
            action={applySuggestedLocationsAction}
            submitLabel="Criar locais marcados"
            variant="default"
            className="grid gap-2"
            aria-label="Locais sugeridos"
          >
            {suggestions.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-sm">
                <Checkbox name="key" value={s.key} defaultChecked />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{s.purpose}</span>
              </label>
            ))}
          </ActionForm>
        </Card>
      )}
      {manage && (
        <Card className="grid gap-3">
          <CardTitle>Novo local</CardTitle>
          <ActionForm
            action={createLocationAction}
            submitLabel="Criar local"
            variant="default"
            aria-label="Novo local"
          >
            <LocationFields prefix="new" />
          </ActionForm>
        </Card>
      )}
      <div className="grid gap-4">
        {locs.value.map((l) => (
          <Card key={l.id} className="grid gap-3" aria-label={`Local ${l.name}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{l.name}</h2>
              <span className="text-sm text-muted-foreground">{LOCATION_KIND_LABELS[l.kind]}</span>
              {l.isSystem && <Badge tone="muted">padrão</Badge>}
              {!l.active && <Badge tone="warn">inativo</Badge>}
            </div>
            {manage && (
              <div className="flex flex-wrap items-end gap-4">
                <ActionForm
                  action={updateLocationAction}
                  hidden={{ id: l.id, version: l.version }}
                  submitLabel="Salvar"
                  aria-label={`Editar ${l.name}`}
                >
                  <LocationFields prefix={l.id} location={l} />
                </ActionForm>
                {!l.isSystem && (
                  <ActionForm
                    action={setLocationActiveAction}
                    hidden={{ id: l.id, version: l.version, active: String(!l.active) }}
                    submitLabel={l.active ? "Inativar" : "Reativar"}
                  />
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
