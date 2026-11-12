import Link from "next/link";
import type { ProductCostPanel } from "@/application/inventory/product-costs";
import {
  COST_BAND_LABELS,
  COST_BAND_LIMITS,
  costBarPercent,
  type CostBand,
  type ProductCost,
} from "@/domain/inventory/product-cost";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { money, percent, products, wholePercent } from "./format";

/**
 * Painel de custo dos produtos (spec 008, US2). Renderizado no servidor, sem JavaScript no
 * navegador; a barra é HTML e CSS e o valor está sempre escrito ao lado.
 */

/** Faixa de custo com as cores do tema: manjericão (ok), açafrão (atenção) e beterraba (alto). */
const BAND_STYLE: Record<CostBand, { bar: string; tone: BadgeTone; text: string }> = {
  OK: { bar: "bg-chart-3", tone: "success", text: "text-success-soft-foreground" },
  WARN: { bar: "bg-chart-2", tone: "warning", text: "text-warning-soft-foreground" },
  HIGH: { bar: "bg-destructive", tone: "danger", text: "text-danger-soft-foreground" },
};

const link = "text-primary underline underline-offset-4";

function Summary({ s }: { s: ProductCostPanel["summary"] }) {
  const lines = [
    s.high > 0 && {
      key: "high",
      tone: BAND_STYLE.HIGH.text,
      text: `${products(s.high)} com custo alto (acima de 40% do preço)`,
    },
    s.warn > 0 && {
      key: "warn",
      tone: BAND_STYLE.WARN.text,
      text: `${products(s.warn)} em atenção (entre 35% e 40%)`,
    },
    s.ok > 0 && { key: "ok", tone: BAND_STYLE.OK.text, text: `${products(s.ok)} dentro da faixa (até 35%)` },
    s.noPrice > 0 && {
      key: "noPrice",
      tone: "text-muted-foreground",
      text: `${products(s.noPrice)} sem preço`,
    },
    s.noCost > 0 && {
      key: "noCost",
      tone: "text-muted-foreground",
      text: `${products(s.noCost)} sem custo ainda`,
    },
  ].filter((l): l is { key: string; tone: string; text: string } => !!l);
  return (
    <ul aria-label="Resumo" className="grid gap-1 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
      {lines.map((l) => (
        <li key={l.key} className={`font-medium ${l.tone}`}>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

function ShareCell({ p }: { p: ProductCost }) {
  if (!p.share || !p.band) return <span className="text-muted-foreground">—</span>;
  const style = BAND_STYLE[p.band];
  return (
    <div className="grid min-w-40 gap-1">
      <div className="flex items-center gap-2">
        <strong className="tabular-nums">{percent(p.share)}</strong>
        <Badge tone={style.tone}>{COST_BAND_LABELS[p.band]}</Badge>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-muted" aria-hidden="true">
        <div
          data-testid="cost-bar"
          className={`h-2.5 rounded-full ${style.bar}`}
          style={{ width: `${costBarPercent(p.share)}%` }}
        />
        <div
          data-testid="cost-bar-limit"
          className="absolute -top-0.5 h-3.5 w-0.5 bg-foreground/60"
          style={{ left: `${COST_BAND_LIMITS.ok.toString()}%` }}
        />
      </div>
    </div>
  );
}

function MarginCell({ p }: { p: ProductCost }) {
  if (!p.margin) return <span className="text-muted-foreground">—</span>;
  if (p.margin.isNegative())
    return <strong className="text-destructive">Prejuízo de {money(p.margin)}</strong>;
  return <span className="whitespace-nowrap tabular-nums">{money(p.margin)}</span>;
}

function HeaviestCell({ p }: { p: ProductCost }) {
  if (p.cost === null)
    return <span className="text-muted-foreground">Falta comprar: {p.missingCostNames.join(", ")}</span>;
  if (!p.heaviest) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {p.heaviest.name}{" "}
      <span className="text-muted-foreground">· {wholePercent(p.heaviest.share)} do custo</span>
    </span>
  );
}

export function ProductCostTable({ panel }: { panel: ProductCostPanel }) {
  if (!panel.rows.length)
    return (
      <div className="grid justify-items-start gap-3 text-sm">
        <p>Nenhum produto vendido cadastrado.</p>
        <Link href="/estoque/produtos/novo" className={buttonVariants()}>
          Novo produto
        </Link>
      </div>
    );
  return (
    <div className="grid gap-4">
      <Summary s={panel.summary} />
      <Table aria-label="Custo dos produtos">
        <thead>
          <tr>
            <Th>Produto</Th>
            <Th>Custo</Th>
            <Th>Preço</Th>
            <Th>Custo no preço</Th>
            <Th>Sobra por venda</Th>
            <Th>O que mais pesa</Th>
          </tr>
        </thead>
        <tbody>
          {panel.rows.map((p) => (
            <tr key={p.id} data-product={p.id}>
              <Td>
                <Link className={link} href={`/estoque/produtos/${p.id}`}>
                  {p.name}
                </Link>
              </Td>
              <Td className="whitespace-nowrap tabular-nums">
                {p.cost ? money(p.cost) : <span className="text-muted-foreground">Sem custo ainda</span>}
              </Td>
              <Td className="whitespace-nowrap tabular-nums">
                {p.salePrice ? (
                  money(p.salePrice)
                ) : (
                  <>
                    <span className="text-muted-foreground">Sem preço</span>{" "}
                    <Link className={link} href={`/estoque/produtos/${p.id}`}>
                      Definir preço
                    </Link>
                  </>
                )}
              </Td>
              <Td>
                <ShareCell p={p} />
              </Td>
              <Td>
                <MarginCell p={p} />
              </Td>
              <Td>
                <HeaviestCell p={p} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
