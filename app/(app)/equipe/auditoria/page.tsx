import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { searchAudit } from "@/application/audit/search-audit";
import { listMembers } from "@/application/access/members";
import { AuditReportPage, type AuditQuery } from "@/components/audit/audit-report";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

/** Auditoria (spec 019, US1): o que a equipe fez no período. Só o gerente; padrão hoje. */
export default async function Page({ searchParams }: PageProps<"/equipe/auditoria">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const deps = serverDeps();
  // A busca checa a permissão e registra a tentativa negada (US1-5).
  const r = await searchAudit(deps, ctx, sp);
  if (!r.ok && r.error.code === "FORBIDDEN") return <NoAccess />;
  const members = await listMembers(deps, ctx);
  const people = members.ok ? members.value.map((m) => ({ userId: m.userId, name: m.name })) : [];
  const query: AuditQuery = r.ok
    ? {
        de: r.value.filter.from,
        ate: r.value.filter.to,
        pessoa: r.value.filter.userId ?? "",
        tipo: r.value.filter.type ?? "",
        negadas: r.value.filter.deniedOnly,
      }
    : {
        de: firstParam(sp.de) ?? "",
        ate: firstParam(sp.ate) ?? "",
        pessoa: firstParam(sp.pessoa) ?? "",
        tipo: firstParam(sp.tipo) ?? "",
        negadas: firstParam(sp.negadas) === "1",
      };
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Auditoria"
        description="Tudo o que a equipe fez no período: quem, quando, o que mudou e as tentativas sem permissão."
      />
      <AuditReportPage
        query={query}
        people={people}
        timezone={r.ok ? r.value.timezone : "America/Sao_Paulo"}
        page={r.ok ? r.value.filter.page : 1}
        total={r.ok ? r.value.total : 0}
        rows={r.ok ? r.value.rows : []}
        error={r.ok ? null : "INVALID_PERIOD"}
      />
    </div>
  );
}
