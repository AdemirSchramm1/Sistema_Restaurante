import type { OfferView } from "@/application/suppliers/suppliers";
import type { UnitCode } from "@/domain/inventory/units";
import { formatBrDecimal, formatBrl, type Decimal } from "@/domain/shared/decimal";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";

const money = (v: Decimal, max = 2) => formatBrl(v, { maxPlaces: max });

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
        <TextLink href="/estoque/fornecedores">fornecedor</TextLink>.
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
              <TextLink href={`/estoque/fornecedores/${o.supplierId}`}>{o.supplierName}</TextLink>{" "}
              {o.preferred && <Badge tone="primary">Preferido</Badge>}{" "}
              {o.cheapest && <Badge tone="success">mais barato</Badge>}{" "}
              {!o.supplierActive && <Badge tone="danger">bloqueado</Badge>}
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
