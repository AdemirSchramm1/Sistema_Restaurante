import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getCashEntry } from "@/application/cash/entries";
import { EntryReceipt } from "@/components/cash/entry-receipt";
import { entryView } from "@/components/cash/view";
import { NoAccess } from "@/components/layout/no-access";
import { PrintButton } from "@/components/ordering/print-button";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Comprovante" };
export const dynamic = "force-dynamic";

/** Comprovante de sangria ou reforço para assinar (spec 014, US3-4). */
export default async function Page({ params }: PageProps<"/caixa/lancamentos/[id]/imprimir">) {
  const ctx = await requireContext();
  const { id } = await params;
  const r = await getCashEntry(serverDeps(), ctx, id);
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <TextLink href="/caixa">Voltar para o caixa</TextLink>
        <PrintButton />
      </div>
      <EntryReceipt
        entry={entryView(r.value.entry)}
        restaurantName={r.value.restaurantName}
        timezone={r.value.timezone}
      />
    </div>
  );
}
