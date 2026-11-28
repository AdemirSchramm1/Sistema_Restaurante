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
  reopenTabAction,
  setServiceWaivedAction,
} from "@/actions/billing";
import { CloseTabForm, PaymentList } from "@/components/billing/payment-form";
import { PaymentPanel } from "@/components/billing/payment-panel";
import { ServiceChargeToggle } from "@/components/billing/service-charge";
import { TabDetail } from "@/components/billing/tab-detail";
import { ReopenTabForm } from "@/components/billing/tabs-report";
import { tabDetailView } from "@/components/billing/view";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

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
  const canReopen = t.status === "CLOSED" && can(ctx.roles, "tab.reopen");
  const owing = t.remaining.gt(0);
  return (
    <div className="grid gap-4">
      {t.status === "OPEN" && <AutoRefresh seconds={10} />}
      <PageHeader
        title={`Mesa ${t.tableName} · ${t.status === "OPEN" ? "conta aberta" : "conta fechada"}`}
        back={
          t.status === "OPEN"
            ? { href: "/caixa", label: "Voltar para o caixa" }
            : { href: "/caixa/contas", label: "Voltar para as contas fechadas" }
        }
        actions={
          <>
            {t.status === "OPEN" && can(ctx.roles, "order.place") && (
              <Link
                href={`/pedidos/lancar/${t.tableId}?aba=pedidos`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Voltar à Mesa {t.tableName}
              </Link>
            )}
            <Link
              href={`/caixa/${t.id}/imprimir`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Printer aria-hidden="true" />
              Imprimir conta
            </Link>
          </>
        }
      />
      <TabDetail tab={view} timezone={t.timezone}>
        {canPay && owing && (
          <Card className="grid gap-3">
            <CardTitle>Receber</CardTitle>
            <PaymentPanel
              tabId={t.id}
              remaining={view.remaining}
              action={addPaymentAction}
              cashSessionOpen={t.cashSessionOpen}
            />
          </Card>
        )}
        <Card className="grid gap-3">
          <CardTitle>Pagamentos</CardTitle>
          <PaymentList
            tabId={t.id}
            payments={view.payments}
            timezone={t.timezone}
            remove={canPay ? removePaymentAction : undefined}
            cashSessionOpen={t.cashSessionOpen}
          />
        </Card>
        {canReopen && (
          <Card className="grid gap-3">
            <ReopenTabForm tab={{ id: t.id, version: t.version }} action={reopenTabAction} />
          </Card>
        )}
        {canPay && (
          <Card className="grid gap-3">
            <ServiceChargeToggle tab={{ ...view, version: t.version }} action={setServiceWaivedAction} />
            <CloseTabForm
              tab={{
                id: t.id,
                version: t.version,
                remaining: view.remaining,
                blockers: t.blockers,
                tableName: t.tableName,
              }}
              action={closeTabAction}
            />
          </Card>
        )}
      </TabDetail>
    </div>
  );
}
