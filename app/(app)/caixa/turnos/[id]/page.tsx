import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getCashSessionReport } from "@/application/cash/reports";
import { SessionReport } from "@/components/cash/session-report";
import { dayText } from "@/components/cash/format";
import { sessionReportView } from "@/components/cash/view";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Relatório do turno" };
export const dynamic = "force-dynamic";

/** Relatório do turno (spec 014, US5): completo se fechado, parcial se o caixa está aberto. */
export default async function Page({ params, searchParams }: PageProps<"/caixa/turnos/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const justClosed = firstParam((await searchParams).fechado) === "1";
  const r = await getCashSessionReport(serverDeps(), ctx, id);
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  const report = sessionReportView(r.value);
  const open = report.status === "OPEN";
  return (
    <div className="grid gap-4">
      <PageHeader
        title={`Turno de ${dayText(report.businessDay)}`}
        badges={<Badge tone={open ? "warning" : "neutral"}>{open ? "Caixa aberto" : "Fechado"}</Badge>}
        back={{ href: "/caixa/turnos", label: "Voltar para os turnos" }}
        actions={
          <Link
            href={`/caixa/turnos/${report.id}/imprimir`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Printer aria-hidden="true" />
            Imprimir
          </Link>
        }
      />
      {justClosed && !open && (
        <Alert tone="success">Caixa fechado. Confira o relatório e imprima para o gerente.</Alert>
      )}
      <SessionReport report={report} />
    </div>
  );
}
