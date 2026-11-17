import { ENTRY_KIND_LABELS, WITHDRAWAL_REASON_LABELS } from "@/domain/cash/entries";
import { brl } from "@/components/ordering/format";
import { timeIn } from "@/components/billing/format";
import { atBy, dateIn } from "./format";
import type { EntryView } from "./view";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="py-0.5 pr-2 text-left align-top font-normal">
        {label}
      </th>
      <td className="py-0.5 text-right">{value}</td>
    </tr>
  );
}

/**
 * Comprovante de sangria ou reforço para assinar (spec 014, US3-4): folha de 80 mm com valor,
 * motivo, hora, quem lançou e a linha da assinatura. Não é documento fiscal.
 */
export function EntryReceipt({
  entry,
  restaurantName,
  timezone,
}: {
  entry: EntryView;
  restaurantName: string;
  timezone: string;
}) {
  const kind = ENTRY_KIND_LABELS[entry.kind];
  return (
    <article
      className="tab-print mx-auto grid max-w-sm gap-3 font-mono text-sm"
      aria-label={`Comprovante de ${kind.toLowerCase()}`}
    >
      <header className="grid gap-0.5 text-center">
        <h1 className="text-base font-bold">{restaurantName}</h1>
        <p className="font-semibold">{kind}</p>
        <p>{`${dateIn(entry.at, timezone)} ${timeIn(entry.at, timezone)}`}</p>
      </header>
      <p className="border-y border-dashed border-foreground py-2 text-center text-lg font-bold tabular-nums">
        {brl(entry.amount)}
      </p>
      <table className="w-full">
        <tbody>
          {entry.reason && <Row label="Motivo" value={WITHDRAWAL_REASON_LABELS[entry.reason]} />}
          {entry.note && <Row label="Observação" value={entry.note} />}
          {entry.byName && <Row label="Lançado por" value={entry.byName} />}
        </tbody>
      </table>
      {entry.removedAt && (
        <p className="text-center font-semibold">
          {`Lançamento tirado ${atBy(entry.removedAt, entry.removedByName, timezone)}`}
        </p>
      )}
      <div className="mt-8 grid gap-1 text-center">
        <span className="border-t border-foreground" aria-hidden="true" />
        <span>Assinatura</span>
      </div>
      <p className="text-center font-semibold">Não é documento fiscal</p>
    </article>
  );
}
