import type { ItemUsageRow } from "@/application/inventory/product-costs";
import { Card, CardTitle } from "@/components/ui/card";
import { money, percent } from "./format";
import { TextLink } from "@/components/ui/text-link";

/** Quadro "Usado nos produtos" da página do item (spec 008, US3). */
export function ItemUsage({ rows }: { rows: ItemUsageRow[] }) {
  return (
    <Card className="grid gap-2 text-sm">
      <CardTitle>Usado nos produtos</CardTitle>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Este item ainda não entra em nenhum produto.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Quando o preço deste item muda, o custo destes produtos muda junto.
          </p>
          <ul aria-label="Usado nos produtos" className="grid gap-1">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-2">
                <span>
                  <TextLink href={`/estoque/produtos/${r.id}`}>{r.name}</TextLink>
                  {r.kind === "SUB_RECIPE" && <span className="text-muted-foreground"> (preparo)</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {r.cost ? `custa ${money(r.cost)}` : "sem custo ainda"}
                  {r.share && ` · ${percent(r.share)} do preço`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
