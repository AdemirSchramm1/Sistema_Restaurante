import { TextLink } from "@/components/ui/text-link";
import { barPercents } from "@/domain/inventory/stock-report";
import type { Decimal } from "@/domain/shared/decimal";

/**
 * Gráficos de barras leves (spec 006, FR-007): HTML e CSS renderizados no servidor, sem
 * biblioteca e sem JavaScript no navegador. O texto traz o valor; a barra é só visual.
 */

/** Cores de gráfico do tema (spec 012): páprica, açafrão, manjericão e mirtilo. */
const CHART_COLORS = { 1: "bg-chart-1", 2: "bg-chart-2", 3: "bg-chart-3", 4: "bg-chart-4" } as const;
export type ChartColor = keyof typeof CHART_COLORS;

export type BarRow = {
  key: string;
  label: string;
  href?: string;
  amount: Decimal;
  valueText: string;
  detail?: string;
};

function Bar({ percent, color = 1 }: { percent: number; color?: ChartColor }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-muted" aria-hidden="true">
      <div
        data-testid="bar"
        className={`h-2.5 rounded-full ${CHART_COLORS[color]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const Empty = () => <p className="text-sm text-muted-foreground">Nada no período.</p>;

export function BarList({ title, rows, color = 1 }: { title: string; rows: BarRow[]; color?: ChartColor }) {
  if (!rows.length) return <Empty />;
  const pct = barPercents(rows.map((r) => r.amount));
  return (
    <ul aria-label={title} className="grid gap-3">
      {rows.map((r, i) => (
        <li key={r.key} className="grid gap-1 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">
              {r.href ? <TextLink href={r.href}>{r.label}</TextLink> : r.label}
              {r.detail && <span className="ml-2 font-normal text-muted-foreground">{r.detail}</span>}
            </span>
            <span className="tabular-nums">{r.valueText}</span>
          </div>
          <Bar percent={pct[i]!} color={color} />
        </li>
      ))}
    </ul>
  );
}

export type PairedRow = {
  key: string;
  label: string;
  first: Decimal;
  second: Decimal;
  firstText: string;
  secondText: string;
};

/** Duas barras por linha (ex.: entradas e saídas da semana) na mesma escala. */
export function PairedBars({
  title,
  firstLabel,
  secondLabel,
  rows,
}: {
  title: string;
  firstLabel: string;
  secondLabel: string;
  rows: PairedRow[];
}) {
  if (!rows.length) return <Empty />;
  const pct = barPercents(rows.flatMap((r) => [r.first, r.second]));
  return (
    <div className="grid gap-3">
      <p className="flex gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className={`inline-block size-2.5 rounded-full ${CHART_COLORS[1]}`} /> {firstLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block size-2.5 rounded-full ${CHART_COLORS[2]}`} /> {secondLabel}
        </span>
      </p>
      <ul aria-label={title} className="grid gap-3">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-1 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {firstLabel}: {r.firstText} · {secondLabel}: {r.secondText}
              </span>
            </div>
            <Bar percent={pct[2 * i]!} />
            <Bar percent={pct[2 * i + 1]!} color={2} />
          </li>
        ))}
      </ul>
    </div>
  );
}
