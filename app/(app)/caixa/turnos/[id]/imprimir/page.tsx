import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getCashSessionReport } from "@/application/cash/reports";
import { SessionReport } from "@/components/cash/session-report";
import { sessionReportView } from "@/components/cash/view";
import { NoAccess } from "@/components/layout/no-access";
import { PrintButton } from "@/components/ordering/print-button";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Imprimir turno" };
export const dynamic = "force-dynamic";

/** Relatório do turno para imprimir (spec 014, US5-4): sem menu e sem botões no papel. */
export default async function Page({ params }: PageProps<"/caixa/turnos/[id]/imprimir">) {
  const ctx = await requireContext();
  const { id } = await params;
  const r = await getCashSessionReport(serverDeps(), ctx, id);
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <TextLink href={`/caixa/turnos/${id}`}>Voltar para o turno</TextLink>
        <PrintButton />
      </div>
      <SessionReport report={sessionReportView(r.value)} print />
    </div>
  );
}
