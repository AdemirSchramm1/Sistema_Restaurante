import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { setSmallOperationAction } from "@/actions/audit";
import { serverDeps } from "@/infra/server";
import { getSmallOperation } from "@/application/audit/small-operation";
import { SmallOperationForm } from "@/components/audit/small-operation-form";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Operação pequena" };
export const dynamic = "force-dynamic";

/** Modo operação pequena (spec 019, US2): só o gerente vê e muda. */
export default async function Page() {
  const ctx = await requireContext();
  const r = await getSmallOperation(serverDeps(), ctx);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Operação pequena"
        description="Para restaurante com um gerente só: deixa aprovar o próprio acerto de estoque, com registro."
      />
      <Card>
        {/* Nova chave a cada mudança: a confirmação fecha depois de salvar. */}
        <SmallOperationForm
          key={`${r.value.enabled}-${r.value.version}`}
          enabled={r.value.enabled}
          version={r.value.version}
          action={setSmallOperationAction}
        />
      </Card>
    </div>
  );
}
