import { PAYMENT_METHOD_LABELS } from "@/domain/billing/payment";
import { Card, CardTitle } from "@/components/ui/card";
import { brl } from "@/components/ordering/format";
import { EntriesList } from "./entries-list";
import { STEP_LABELS, atBy, countsText, dateIn, dayText, outcomeText } from "./format";
import type { MethodAmountView, SessionReportView } from "./view";

const SIGNS = { "+": "+ ", "-": "− ", "=": "= " } as const;

function Row({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        {label}
      </th>
      <td className={`py-1 text-right tabular-nums ${danger ? "font-semibold text-destructive" : ""}`}>
        {value}
      </td>
    </tr>
  );
}

function Methods({ rows }: { rows: MethodAmountView[] }) {
  return rows.map((m) => (
    <Row key={m.method} label={PAYMENT_METHOD_LABELS[m.method]} value={brl(m.amount)} />
  ));
}

/**
 * Relatório do turno (spec 014, US5): abertura e fechamento, recebido por forma, sangrias e
 * reforços e a conta do dinheiro passo a passo. O turno aberto sai parcial; para o caixa, sem o
 * esperado (`steps` nulo: o valor nem chega à tela). `print` é a folha de 80 mm ou A4.
 */
export function SessionReport({ report: r, print = false }: { report: SessionReportView; print?: boolean }) {
  const Section = print ? "section" : Card;
  const opened = `Aberto em ${dateIn(r.openedAt, r.timezone)} ${atBy(r.openedAt, r.openedByName, r.timezone)}`;
  const keptBefore = r.previousKept !== null && r.previousKept !== r.openingFloat ? r.previousKept : null;
  return (
    <article
      aria-label={`Relatório do turno de ${dayText(r.businessDay)}`}
      className={print ? "tab-print mx-auto grid max-w-md gap-4 font-mono text-sm" : "grid gap-4"}
    >
      {print && (
        <header className="grid gap-0.5 text-center">
          <h1 className="text-base font-bold">{r.restaurantName}</h1>
          <p>{`Turno do caixa · ${dayText(r.businessDay)}`}</p>
        </header>
      )}

      <Section className="grid gap-1">
        <CardTitle>Abertura e fechamento</CardTitle>
        <p>{opened}</p>
        <p>{`Troco inicial: ${brl(r.openingFloat)}`}</p>
        {keptBefore && <p>{`Ficaram ${brl(keptBefore)} na gaveta no fechamento anterior.`}</p>}
        {r.openingNote && <p>{`Observação da abertura: ${r.openingNote}`}</p>}
        {r.closedAt ? (
          <p>{`Fechado em ${dateIn(r.closedAt, r.timezone)} ${atBy(r.closedAt, r.closedByName, r.timezone)}`}</p>
        ) : (
          <p className="font-medium">Caixa aberto: relatório parcial, sem o contado e a diferença.</p>
        )}
      </Section>

      <Section className="grid gap-2">
        <CardTitle id="report-received">Recebido por forma de pagamento</CardTitle>
        <table className="w-full" aria-labelledby="report-received">
          <tbody>
            <Methods rows={r.receivedByMethod} />
            <Row label="Total recebido" value={brl(r.received)} strong />
            <Row label="Taxa de serviço das contas fechadas no turno" value={brl(r.serviceCharge)} />
          </tbody>
        </table>
        {r.removedFromOtherSessions.length > 0 && (
          <>
            <h3 id="report-removed" className="mt-2 font-semibold">
              Pagamentos tirados de outro turno
            </h3>
            <p className="text-sm text-muted-foreground">
              Foram recebidos num turno já fechado e tirados neste. O turno antigo continua como foi
              conferido.
            </p>
            <table className="w-full" aria-labelledby="report-removed">
              <tbody>
                <Methods rows={r.removedFromOtherSessions} />
              </tbody>
            </table>
          </>
        )}
      </Section>

      <Section className="grid gap-2">
        <CardTitle>Sangrias e reforços</CardTitle>
        <EntriesList entries={r.entries} timezone={r.timezone} receipts={false} />
      </Section>

      <Section className="grid gap-2">
        <CardTitle id="report-cash">Conta do dinheiro</CardTitle>
        {r.steps ? (
          <table className="w-full" aria-labelledby="report-cash">
            <tbody>
              {r.steps.map((s) => (
                <Row
                  key={s.key}
                  label={`${s.sign ? SIGNS[s.sign] : ""}${STEP_LABELS[s.key]}`}
                  value={brl(s.amount)}
                  strong={s.key === "EXPECTED"}
                  danger={s.key === "EXPECTED" && s.amount.startsWith("-")}
                />
              ))}
              {r.counted !== null && <Row label="Contado" value={brl(r.counted)} strong />}
              {r.result && r.difference !== null && (
                <Row label="Diferença" value={outcomeText(r.result, r.difference)} strong />
              )}
              {r.kept !== null && <Row label="Fica na gaveta" value={brl(r.kept)} />}
              {r.takenToSafe !== null && <Row label="Retirada do fechamento" value={brl(r.takenToSafe)} />}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">
            O dinheiro esperado aparece depois da contagem, em Fechar caixa.
          </p>
        )}
        {r.counts.length > 0 && <p className="text-sm">{countsText(r.counts)}</p>}
        {r.closeNote && <p>{`Observação do fechamento: ${r.closeNote}`}</p>}
      </Section>

      {print && <p className="text-center font-semibold">Não é documento fiscal</p>}
    </article>
  );
}
