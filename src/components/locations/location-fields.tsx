import { LOCATION_KIND_LABELS, LOCATION_KIND_OPTIONS, type Location } from "@/domain/inventory/location";
import { Input, Select } from "@/components/ui/input";

/** Campos do local: só nome e tipo (docs/produto/estoque/05-locais.md). */
export function LocationFields({ location, prefix }: { location?: Location; prefix: string }) {
  const id = (f: string) => `${prefix}-${f}`;
  const kinds =
    location && !LOCATION_KIND_OPTIONS.includes(location.kind)
      ? [location.kind, ...LOCATION_KIND_OPTIONS]
      : LOCATION_KIND_OPTIONS;
  return (
    <>
      <label className="grid gap-1 text-sm font-medium" htmlFor={id("name")}>
        Nome do local
        <Input
          id={id("name")}
          name="name"
          defaultValue={location?.name}
          placeholder="Ex.: Geladeira da cozinha"
          className="w-64"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium" htmlFor={id("kind")}>
        Tipo
        <Select id={id("kind")} name="kind" defaultValue={location?.kind ?? "DRY"} className="w-48">
          {kinds.map((k) => (
            <option key={k} value={k}>
              {LOCATION_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </label>
    </>
  );
}
