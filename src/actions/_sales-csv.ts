import type { Deps } from "@/application/ports";
import type { RequestContext } from "@/application/context";
import { salesReport, type SalesReport } from "@/application/cash/sales";
import { PAYMENT_METHOD_LABELS } from "@/domain/billing/payment";
import { toCsv, type CsvCell } from "@/domain/cash/csv";

/** Planilha de vendas para o contador (spec 014, US6-7). A lógica fica aqui para ser testada sem o Next. */

const dayText = (day: string) => day.split("-").reverse().join("/");

/** As seções da tela Vendas, uma depois da outra, com uma linha em branco entre elas. */
export function salesCsvRows(r: SalesReport, from: string, to: string): CsvCell[][] {
  return [
    [`Vendas de ${dayText(from)} a ${dayText(to)}`],
    [],
    ["Forma de pagamento", "Valor (R$)"],
    ...r.byMethod.map((m) => [PAYMENT_METHOD_LABELS[m.method], m.amount]),
    ["Total recebido", r.received],
    ["Taxa de serviço", r.serviceCharge],
    [],
    ["Produto", "Quantidade", "Valor (R$)", "Parte (%)"],
    ...r.products.map((p) => [p.name, p.quantity, p.amount, p.share.toFixed(1).replace(".", ",")]),
    ["Total dos produtos", "", r.productsTotal, ""],
    [],
    ["Adicional", "Vezes", "Valor (R$)"],
    ...r.addons.map((a) => [a.name, a.times, a.amount]),
  ];
}

const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

/** `GET /vendas/planilha?de=AAAA-MM-DD&ate=AAAA-MM-DD`. */
export async function salesCsvResponse(deps: Deps, ctx: RequestContext | null, url: URL): Promise<Response> {
  if (!ctx) return plain(401, "Entre de novo para baixar a planilha.");
  const from = url.searchParams.get("de") ?? "";
  const to = url.searchParams.get("ate") ?? "";
  const r = await salesReport(deps, ctx, { from, to });
  if (!r.ok)
    return r.error.code === "FORBIDDEN"
      ? plain(403, "Só o gerente baixa a planilha de vendas.")
      : plain(400, "Escolha um período de até 31 dias, com o início antes do fim.");
  return new Response(toCsv(salesCsvRows(r.value, from, to)), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vendas-${from}-a-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
