import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { stockReport } from "@/application/inventory/stock-report";
import { PERIOD_OPTIONS } from "@/domain/inventory/stock-report";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { BarList, PairedBars } from "@/components/reports/bar-list";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Gráficos" };

const money = (v: Decimal) => `R$ ${formatBrDecimal(v, { minPlaces: 2, maxPlaces: 2 })}`;
const qty = (v: Decimal, unit: string) => `${formatBrDecimal(v, { maxPlaces: 2 })} ${unit}`;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function Tile({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </>
  );
  return (
    <Card className="grid gap-1 p-4">
      {href ? (
        <Link href={href} className="grid gap-1 hover:text-primary">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export default async function Page({ searchParams }: PageProps<"/estoque/graficos">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const r = await stockReport(serverDeps(), ctx, one(sp.dias));
  if (!r.ok) return <Alert>Não foi possível carregar os gráficos.</Alert>;
  const { period, summary, most, least, byReason, weeks, timezone } = r.value;
  const dateBr = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y!.slice(2)}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Gráficos do estoque"
        description={`Últimos ${period.days} dias, até ${period.to.toLocaleDateString("pt-BR", { timeZone: timezone })}. Ordenado pelo valor em R$, porque quilo, litro e unidade não se comparam.`}
        actions={
          <nav
            aria-label="Período"
            className="inline-flex rounded-lg border border-border bg-card p-1 shadow-xs"
          >
            {PERIOD_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`?dias=${d}`}
                aria-current={d === period.days ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  d === period.days
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {d} dias
              </Link>
            ))}
          </nav>
        }
      />

      <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Entrou (compras)" value={money(summary.inflow)} />
        <Tile label="Saiu" value={money(summary.outflow)} />
        <Tile label="Perdas" value={money(summary.losses)} />
        <Tile label="Itens para repor" value={String(summary.reorderCount)} href="/estoque/repor" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <CardTitle>Itens que mais saíram</CardTitle>
          <BarList
            title="Itens que mais saíram"
            rows={most.map((x) => ({
              key: x.itemId,
              label: x.name,
              href: `/estoque/itens/${x.itemId}`,
              amount: x.value,
              valueText: money(x.value),
              detail: qty(x.quantity, x.unit),
            }))}
          />
        </Card>
        <Card className="grid content-start gap-3">
          <CardTitle>Itens que menos saíram</CardTitle>
          <p className="-mt-2 text-sm text-muted-foreground">
            &quot;Parado&quot; = tem estoque e não saiu nada no período.
          </p>
          <BarList
            title="Itens que menos saíram"
            color={4}
            rows={least.map((x) => ({
              key: x.itemId,
              label: x.name,
              href: `/estoque/itens/${x.itemId}`,
              amount: x.value,
              valueText: x.stopped ? "parado" : money(x.value),
              detail: x.stopped ? `${qty(x.balance, x.unit)} em estoque` : qty(x.quantity, x.unit),
            }))}
          />
        </Card>
        <Card className="grid content-start gap-3">
          <CardTitle>Saídas por motivo</CardTitle>
          <BarList
            title="Saídas por motivo"
            color={2}
            rows={byReason.map((x) => ({
              key: x.label,
              label: x.label,
              amount: x.value,
              valueText: money(x.value),
            }))}
          />
        </Card>
        <Card className="grid content-start gap-3">
          <CardTitle>Entradas e saídas por semana</CardTitle>
          <PairedBars
            title="Entradas e saídas por semana"
            firstLabel="Entradas"
            secondLabel="Saídas"
            rows={weeks.map((w) => ({
              key: w.weekStart,
              label: `Semana de ${dateBr(w.weekStart)}`,
              first: w.inflow,
              second: w.outflow,
              firstText: money(w.inflow),
              secondText: money(w.outflow),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
