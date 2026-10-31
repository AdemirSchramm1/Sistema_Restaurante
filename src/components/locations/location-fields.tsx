import { LOCATION_KINDS, LOCATION_KIND_LABELS, type Location } from "@/domain/inventory/location";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { Input, Select } from "@/components/ui/input";

export type MemberOption = { userId: string; name: string };

/** Campos do local. Refrigerado e congelado exigem faixa de temperatura (validado no servidor). */
export function LocationFields({
  location,
  members,
  prefix,
}: {
  location?: Location;
  members: MemberOption[];
  prefix: string;
}) {
  const temp = (v: Location["tempMinC"] | undefined) => (v ? formatBrDecimal(v) : "");
  const id = (f: string) => `${prefix}-${f}`;
  return (
    <>
      <label className="grid gap-1 text-sm" htmlFor={id("name")}>
        Nome
        <Input id={id("name")} name="name" defaultValue={location?.name} className="w-56" required />
      </label>
      <label className="grid gap-1 text-sm" htmlFor={id("kind")}>
        Tipo
        <Select
          id={id("kind")}
          name="kind"
          defaultValue={location?.kind ?? "DRY"}
          className="w-40"
          disabled={location?.isSystem}
        >
          {LOCATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {LOCATION_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        {location?.isSystem && <input type="hidden" name="kind" value={location.kind} />}
      </label>
      <label className="grid gap-1 text-sm" htmlFor={id("tempMinC")}>
        Temp. mín. (°C)
        <Input
          id={id("tempMinC")}
          name="tempMinC"
          inputMode="decimal"
          defaultValue={temp(location?.tempMinC)}
          className="w-24"
        />
      </label>
      <label className="grid gap-1 text-sm" htmlFor={id("tempMaxC")}>
        Temp. máx. (°C)
        <Input
          id={id("tempMaxC")}
          name="tempMaxC"
          inputMode="decimal"
          defaultValue={temp(location?.tempMaxC)}
          className="w-24"
        />
      </label>
      <label className="grid gap-1 text-sm" htmlFor={id("responsibleUserId")}>
        Responsável
        <Select
          id={id("responsibleUserId")}
          name="responsibleUserId"
          defaultValue={location?.responsibleUserId ?? ""}
          className="w-44"
        >
          <option value="">Ninguém</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm" htmlFor={id("countOrder")}>
        Ordem na contagem
        <Input
          id={id("countOrder")}
          name="countOrder"
          inputMode="numeric"
          defaultValue={location?.countOrder ?? 0}
          className="w-24"
        />
      </label>
    </>
  );
}
