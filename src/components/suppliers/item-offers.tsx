import Link from "next/link";
import type { OfferView } from "@/application/suppliers/suppliers";
import type { UnitCode } from "@/domain/inventory/units";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { Badge } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";

const money = (v: Decimal, max = 2) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: max })}`;

/** Quem vende o item e por quanto, para comparar (spec 007, US3). */
export function ItemOffers({
  offers,
  unit,
  timezone,
}: {
  offers: OfferView[];
  unit: UnitCode;
  timezone: string;
}) {
  if (offers.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum fornecedor vende este item ainda. Cadastre na página do{" "}
        <Link className="text-primary underline underline-offset-4" href="/estoque/fornecedores">
          fornecedor
        </Link>
        .
      </p>
    );
  return (
    <Table aria-label="Fornecedores do item">
      <thead>
        <tr>
          <Th>Fornecedor</Th>
          <Th>Embalagem</Th>
          <Th>Preço</Th>
          <Th>Por medida</Th>
          <Th>Última compra</Th>
        </tr>
      </thead>
      <tbody>
        {offers.map((o) => (
          <tr key={o.id}>
            <Td>
              <Link
                className="text-primary underline underline-offset-4"
                href={`/estoque/fornecedores/${o.supplierId}`}
              >
                {o.supplierName}
              </Link>{" "}
              {o.preferred && <Badge>Preferido</Badge>}{" "}
              {o.cheapest && <Badge tone="muted">mais barato</Badge>}{" "}
              {!o.supplierActive && <Badge tone="warn">bloqueado</Badge>}
            </Td>
            <Td>
              {o.packageLabel
                ? `${o.packageLabel} de ${formatBrDecimal(o.packageQuantity!)} ${unit}`
                : `Solto (por ${unit})`}
            </Td>
            <Td>{money(o.price, 4)}</Td>
            <Td data-testid="offer-unit-price">
              {money(o.pricePerUnit)}/{unit}
            </Td>
            <Td>
              {o.lastPurchase
                ? `${o.lastPurchase.at.toLocaleDateString("pt-BR", { timeZone: timezone })}: ${money(o.lastPurchase.unitCost)}/${unit}`
                : "—"}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
