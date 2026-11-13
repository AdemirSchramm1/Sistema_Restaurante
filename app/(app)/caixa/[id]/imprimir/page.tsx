import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getTab } from "@/application/billing/tabs";
import { TabPrint } from "@/components/billing/tab-print";
import { tabDetailView } from "@/components/billing/view";
import { PrintButton } from "@/components/ordering/print-button";
import { NoAccess } from "@/components/layout/no-access";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Imprimir conta" };
export const dynamic = "force-dynamic";

/** Conta para imprimir (spec 011, US1-9): sem menu e sem botões no papel. */
export default async function Page({ params }: PageProps<"/caixa/[id]/imprimir">) {
  const ctx = await requireContext();
  const { id } = await params;
  const r = await getTab(serverDeps(), ctx, id);
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  const t = r.value;
  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <TextLink href={`/caixa/${t.id}`}>Voltar para a conta</TextLink>
        <PrintButton />
      </div>
      <TabPrint
        tab={tabDetailView(t)}
        restaurantName={t.restaurantName}
        timezone={t.timezone}
        printedAt={t.serverNow}
      />
    </div>
  );
}
