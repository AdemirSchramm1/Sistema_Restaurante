import type { ActionState } from "@/actions/_session";
import type { WeekExceptions } from "@/application/audit/exception-review";
import { REVIEW_NOTE_MAX, weekText } from "@/domain/audit/week";
import { d, formatBrDecimal } from "@/domain/shared/decimal";
import { ActionForm } from "@/components/forms/action-form";
import { brl } from "@/components/ordering/format";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type WeekReviewProps = { week: WeekExceptions; timezone: string; action: Action };

const when = (at: Date, timeZone: string) => at.toLocaleString("pt-BR", { timeZone });
const qty = (v: string) => formatBrDecimal(d(v), { maxPlaces: 4 });

/**
 * Revisão da semana (spec 019, US3): as exceções da operação pequena (acertos aprovados por quem
 * pediu), o total e o saldo atual de cada item; semana encerrada pode ser marcada como revisada.
 */
export function WeekReview({ week, timezone, action }: WeekReviewProps) {
  const canMark = week.closed && !week.review && week.exceptions.length > 0;
  return (
    <Card className="grid gap-4">
      <CardTitle>Semana de {weekText(week.weekStart)}</CardTitle>

      {week.review && (
        <p className="text-sm">
          Revisada por {week.review.reviewedByName ?? "—"} em {when(week.review.reviewedAt, timezone)}.
          {week.review.note && ` Observação: ${week.review.note}`}
        </p>
      )}
      {!week.closed && (
        <p className="text-sm text-muted-foreground">
          A semana ainda não acabou. A revisão abre na segunda-feira.
        </p>
      )}

      {week.exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma exceção nesta semana.</p>
      ) : (
        <>
          <Table aria-label="Exceções da semana">
            <thead>
              <tr>
                <Th scope="col">Quando</Th>
                <Th scope="col">Quem</Th>
                <Th scope="col">Item</Th>
                <Th scope="col" numeric>
                  Quantidade
                </Th>
                <Th scope="col" numeric>
                  Valor
                </Th>
                <Th scope="col">Motivo</Th>
                <Th scope="col" numeric>
                  Saldo atual
                </Th>
              </tr>
            </thead>
            <tbody>
              {week.exceptions.map((e) => (
                <tr key={e.requestId} className="border-t border-border align-top">
                  <Td className="whitespace-nowrap">{when(e.decidedAt, timezone)}</Td>
                  <Td>{e.decidedByName}</Td>
                  <Td>
                    <TextLink href={`/estoque/itens/${e.itemId}`}>{e.itemName}</TextLink>
                  </Td>
                  <Td numeric>
                    {qty(e.difference)} {e.stockUnit}
                  </Td>
                  <Td numeric>{brl(e.value)}</Td>
                  <Td>
                    {e.reasonLabel}
                    {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                  </Td>
                  <Td numeric>
                    {qty(e.balance)} {e.stockUnit}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-sm font-medium">Total das exceções: {brl(week.total)}</p>
        </>
      )}

      {canMark && (
        <ActionForm
          action={action}
          hidden={{ weekStart: week.weekStart }}
          submitLabel="Marcar como revisada"
          variant="default"
          size="lg"
          className="grid max-w-md gap-2"
          aria-label="Marcar a semana como revisada"
        >
          <Label htmlFor="note">Observação (opcional)</Label>
          <Textarea id="note" name="note" maxLength={REVIEW_NOTE_MAX} size="lg" />
        </ActionForm>
      )}
    </Card>
  );
}
