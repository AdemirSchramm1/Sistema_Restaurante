import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getTab } from "@/application/billing/tabs";
import { can } from "@/domain/access/permissions";
import {
  addPaymentAction,
  closeTabAction,
  removePaymentAction,
  setServiceWaivedAction,
} from "@/actions/billing";
import { CloseTabForm, PaymentList } from "@/components/billing/payment-form";
import { PaymentPanel } from "@/components/billing/payment-panel";
import { ServiceChargeToggle } from "@/components/billing/service-charge";
import { TabDetail } from "@/components/billing/tab-detail";
import { tabDetailView } from "@/components/billing/view";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Conta da mesa" };
export const dynamic = "force-dynamic";

/**
 * Conta da mesa (spec 011): aberta ou fechada. A aberta atualiza sozinha a cada 10 segundos e,
 * para quem recebe (gerente e caixa), tem o pagamento, a taxa e o fechamento.
 */
export default async function Page({ params }: PageProps<"/caixa/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  const r = await getTab(serverDeps(), ctx, id);
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  const t = r.value;
  const view = tabDetailView(t);
  const canPay = t.status === "OPEN" && can(ctx.roles, "tab.pay");
  const owing = t.remaining.gt(0);
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
        <Link
          href={`/caixa/${t.id}/imprimir`}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          Imprimir conta
        </Link>
      </div>
      <TabDetail tab={view} timezone={t.timezone}>
        {canPay && owing && (
          <Card className="grid gap-3">
            <CardTitle>Receber</CardTitle>
            <PaymentPanel tabId={t.id} remaining={view.remaining} action={addPaymentAction} />
          </Card>
        )}
        <Card className="grid gap-3">
          <CardTitle>Pagamentos</CardTitle>
          <PaymentList
            tabId={t.id}
            payments={view.payments}
            timezone={t.timezone}
            remove={canPay ? removePaymentAction : undefined}
          />
        </Card>
        {canPay && (
          <Card className="grid gap-3">
            <ServiceChargeToggle tab={{ ...view, version: t.version }} action={setServiceWaivedAction} />
            <CloseTabForm
              tab={{ id: t.id, version: t.version, remaining: view.remaining, blockers: t.blockers, tableName: t.tableName }}
              action={closeTabAction}
            />
          </Card>
        )}
      </TabDetail>
    </div>
  );
}
