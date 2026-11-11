import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getTab } from "@/application/billing/tabs";
import { TabDetail } from "@/components/billing/tab-detail";
import { tabDetailView } from "@/components/billing/view";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";

export const metadata: Metadata = { title: "Conta da mesa" };
export const dynamic = "force-dynamic";

/** Conta da mesa (spec 011): aberta ou fechada. A aberta atualiza sozinha a cada 10 segundos. */
export default async function Page({ params }: PageProps<"/caixa/[id]">) {
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
      {t.status === "OPEN" && <AutoRefresh seconds={10} />}
      <Link href="/caixa" className="text-sm text-primary underline underline-offset-4">
        Voltar para o caixa
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          Mesa {t.tableName} · {t.status === "OPEN" ? "conta aberta" : "conta fechada"}
        </h1>
      </div>
      <TabDetail tab={tabDetailView(t)} timezone={t.timezone} />
    </div>
  );
}
