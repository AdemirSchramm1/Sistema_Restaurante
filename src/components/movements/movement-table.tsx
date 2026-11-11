import { ActionForm } from "@/components/forms/action-form";
import { reverseMovementAction } from "@/actions/movements";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import type { MovementView } from "@/application/inventory/movements";
import { MOVEMENT_TYPE_LABELS } from "@/domain/inventory/movement";
import { manualReasons } from "@/domain/inventory/movement-reasons";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";

const qty = (v: Decimal) => `${v.gt(0) ? "+" : ""}${formatBrDecimal(v, { maxPlaces: 4 })}`;
const money = (v: Decimal) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`;
const REVERSAL_REASONS = manualReasons("REVERSAL");

/** Motivo, pedido (venda e cancelamento, spec 011) ou fornecedor. */
function source(m: MovementView): string {
  if (m.type === "SALE_RECIPE" && m.order) return `Pedido ${m.order.number}, Mesa ${m.order.tableName}`;
  if (m.reasonLabel)
    return m.order ? `${m.reasonLabel} · pedido ${m.order.number}, Mesa ${m.order.tableName}` : m.reasonLabel;
  return m.supplierName ? `De ${m.supplierName}` : "—";
}

/** Lista de movimentações do livro, com "Estornar" para quem pode. */
export function MovementTable({
  rows,
  timezone,
  canReverse,
  showItem = true,
}: {
  rows: MovementView[];
  timezone: string;
  canReverse: boolean;
  showItem?: boolean;
}) {
  const date = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: timezone });
  return (
    <Table>
      <thead>
        <tr>
          <Th>Data</Th>
          {showItem && <Th>Item</Th>}
          <Th>Tipo</Th>
          <Th>Quantidade</Th>
          <Th>Valor</Th>
          <Th>Motivo ou fornecedor</Th>
          <Th>Quem</Th>
          {canReverse && <Th>Corrigir</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <Td>{date(m.occurredAt)}</Td>
            {showItem && <Td>{m.itemName}</Td>}
            <Td>
              {MOVEMENT_TYPE_LABELS[m.type]} {m.reversedById && <Badge tone="muted">estornado</Badge>}
            </Td>
            <Td>
              {qty(m.quantity)} {m.stockUnit}
              {m.enteredUnit !== m.stockUnit && m.type !== "REVERSAL" && (
                <span className="text-muted-foreground">
                  {" "}
                  ({formatBrDecimal(m.enteredQuantity)} {m.enteredUnit})
                </span>
              )}
            </Td>
            <Td>{m.type === "SALE_RECIPE" && m.totalCost.isZero() ? "Sem custo" : money(m.totalCost)}</Td>
            <Td>
              {source(m)}
              {m.notes && <span className="block text-xs text-muted-foreground">{m.notes}</span>}
            </Td>
            <Td>
              {m.recordedByName ?? "—"}
              {m.approvedByName && (
                <span className="block text-xs text-muted-foreground">aprovado por {m.approvedByName}</span>
              )}
            </Td>
            {canReverse && (
              <Td>
                {m.type !== "REVERSAL" && m.type !== "SALE_RECIPE" && !m.reversedById && (
                  <ActionForm
                    action={reverseMovementAction}
                    hidden={{ movementId: m.id, idempotencyKey: crypto.randomUUID() }}
                    submitLabel="Estornar"
                    aria-label={`Estornar lançamento de ${m.itemName}`}
                  >
                    <Select
                      name="reasonId"
                      aria-label="Motivo do estorno"
                      required
                      defaultValue=""
                      className="w-40"
                    >
                      <option value="">Motivo…</option>
                      {REVERSAL_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </ActionForm>
                )}
              </Td>
            )}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <Td colSpan={8} className="text-center text-muted-foreground">
              Nenhum lançamento ainda.
            </Td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
