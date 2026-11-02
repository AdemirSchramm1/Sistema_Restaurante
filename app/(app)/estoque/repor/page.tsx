import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listReorderAlerts, type ReorderAlert } from "@/application/inventory/reorder";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { Alert, Badge } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Repor" };

const q = (v: Parameters<typeof formatBrDecimal>[0]) => formatBrDecimal(v, { maxPlaces: 2 });

function HowMuch({ a }: { a: ReorderAlert }) {
  const { quantity, packages } = a.order;
  if (quantity === null)
    return <span className="text-muted-foreground">Defina &quot;Comprar até&quot; no item</span>;
  if (quantity.isZero()) return <span className="text-muted-foreground">Nada por enquanto</span>;
  if (packages)
    return (
      <>
        <strong>
          {q(packages.count)} {packages.label}
          {packages.count.gt(1) && !/s$/i.test(packages.label) ? "s" : ""}
        </strong>{" "}
        <span className="text-muted-foreground">
          ({q(packages.total)} {a.unit})
        </span>
      </>
    );
  return (
    <strong>
      {q(quantity)} {a.unit}
    </strong>
  );
}

export default async function Page() {
  const ctx = await requireContext();
  const r = await listReorderAlerts(serverDeps(), ctx);
  const rows = r.ok ? r.value : [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Repor</h1>
        <p className="text-sm text-muted-foreground">
          Itens que chegaram no ponto de reposição, os que acabaram primeiro. O aviso de cada item é definido
          na página do item, no quadro &quot;Aviso de reposição&quot;.
        </p>
      </div>
      {rows.length === 0 ? (
        <Alert tone="success">Nenhum item precisa de reposição agora.</Alert>
      ) : (
        <Table aria-label="Itens para repor">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Tem agora</Th>
              <Th>Avisar em</Th>
              <Th>Quanto comprar</Th>
              <Th>De quem</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.itemId}>
                <Td>
                  <Link
                    className="text-primary underline underline-offset-4"
                    href={`/estoque/itens/${a.itemId}`}
                  >
                    {a.name}
                  </Link>{" "}
                  {a.balance.lte(0) && <Badge tone="warn">acabou</Badge>}
                </Td>
                <Td>
                  {q(a.balance)} {a.unit}
                </Td>
                <Td>
                  {q(a.reorderPoint)} {a.unit}
                </Td>
                <Td>
                  <HowMuch a={a} />
                </Td>
                <Td>
                  {a.supplier ? (
                    <>
                      {a.supplier.name}
                      {a.supplier.phone && <div className="text-muted-foreground">{a.supplier.phone}</div>}
                      {a.supplier.leadTimeDays !== null && (
                        <div className="text-muted-foreground">
                          entrega em {a.supplier.leadTimeDays}{" "}
                          {a.supplier.leadTimeDays === 1 ? "dia" : "dias"}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem fornecedor preferido</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        Quanto comprar = &quot;Comprar até&quot; − (o que tem agora − o que se gasta até a entrega),
        arredondado para cima na embalagem do fornecedor preferido (ou na do item).
      </p>
    </div>
  );
}
