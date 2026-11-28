import type { Deps } from "@/application/ports";
import type { RequestContext } from "@/application/context";
import { searchAudit, type AuditReport } from "@/application/audit/search-audit";
import { toCsv, type CsvCell } from "@/domain/cash/csv";
import { changeLines, entryLabel, operationLabel, recordName, whoDid } from "@/components/audit/entry-labels";

/** Planilha da auditoria (spec 019, FR-005). A lógica fica aqui para ser testada sem o Next. */

const dayText = (day: string) => day.split("-").reverse().join("/");

const when = (at: Date, timeZone: string) => at.toLocaleString("pt-BR", { timeZone }).replace(",", "");

export function auditCsvRows(r: AuditReport): CsvCell[][] {
  return [
    [`Auditoria de ${dayText(r.filter.from)} a ${dayText(r.filter.to)}`],
    [],
    ["Quando", "Quem", "Tipo", "Registro", "Ação", "O que mudou"],
    ...r.rows.map((e) => [
      when(e.occurredAt, r.timezone),
      whoDid(e),
      operationLabel(e.entity),
      recordName(e.changes) ?? "",
      entryLabel(e),
      changeLines(e).join(" · "),
    ]),
  ];
}

const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

/** `GET /equipe/auditoria/planilha?de=&ate=&pessoa=&tipo=&negadas=`: o período inteiro, sem página. */
export async function auditCsvResponse(deps: Deps, ctx: RequestContext | null, url: URL): Promise<Response> {
  if (!ctx) return plain(401, "Entre de novo para baixar a planilha.");
  const r = await searchAudit(deps, ctx, Object.fromEntries(url.searchParams), { allPages: true });
  if (!r.ok)
    return r.error.code === "FORBIDDEN"
      ? plain(403, "Só o gerente baixa a planilha da auditoria.")
      : plain(400, "Escolha um período de até 31 dias, com o início antes do fim.");
  const { from, to } = r.value.filter;
  return new Response(toCsv(auditCsvRows(r.value)), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="auditoria-${from}-a-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
