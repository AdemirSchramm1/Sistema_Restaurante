import type { ReorderAlert } from "@/application/inventory/reorder";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";

const q = (v: Decimal) => formatBrDecimal(v, { maxPlaces: 2 });
/** "Caixa" → "Caixas" quando é mais de uma; nome já no plural fica como está. */
const plural = (label: string, count: Decimal) => (count.gt(1) && !/s$/i.test(label) ? `${label}s` : label);

function HowMuch({ a }: { a: ReorderAlert }) {
  const { quantity, packages } = a.order;
  if (quantity === null)
    return <span className="text-muted-foreground">Defina &quot;Comprar até&quot; no item</span>;
  if (quantity.isZero()) return <span className="text-muted-foreground">Nada por enquanto</span>;
  if (packages)
    return (
      <>
        <strong>
          {q(packages.count)} {plural(packages.label, packages.count)}
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

/** Tabela da tela Repor (spec 006, US2). */
export function ReorderTable({ rows }: { rows: ReorderAlert[] }) {
  if (!rows.length) return <Alert tone="success">Nenhum item precisa de reposição agora.</Alert>;
  return (
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
          <tr key={a.itemId} data-item={a.itemId}>
            <Td>
              <TextLink href={`/estoque/itens/${a.itemId}`}>{a.name}</TextLink>{" "}
              {a.balance.lte(0) && <Badge tone="danger">acabou</Badge>}
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
                      entrega em {a.supplier.leadTimeDays} {a.supplier.leadTimeDays === 1 ? "dia" : "dias"}
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
  );
}
