import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/actions/_session";
import { closeCashSessionAction, countCashAction } from "@/actions/cash";
import { serverDeps } from "@/infra/server";
import { getCashClosing } from "@/application/cash/closing";
import { messageFor } from "@/components/forms/error-messages";
import { CloseResult } from "@/components/cash/close-result";
import { CountForm } from "@/components/cash/count-form";
import { closeResultView } from "@/components/cash/view";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Fechar caixa" };
export const dynamic = "force-dynamic";

/**
 * Fechar caixa (spec 014, US4): primeiro a contagem, sem ver o esperado; depois de gravada, o
 * resultado e o fechamento. `?recontar=1` volta à contagem. Fechou: vai para o relatório do turno.
 */
export default async function Page({ searchParams }: PageProps<"/caixa/fechar">) {
  const ctx = await requireContext();
  const recount = firstParam((await searchParams).recontar) === "1";
  const r = await getCashClosing(serverDeps(), ctx);
  const back = { href: "/caixa", label: "Voltar para o caixa" };
  if (!r.ok) {
    if (r.error.code === "FORBIDDEN") return <NoAccess />;
    return (
      <div className="grid gap-4">
        <PageHeader title="Fechar caixa" back={back} />
        <Alert tone="info">{messageFor(r.error)}</Alert>
        <Link href="/caixa" className={buttonVariants({ variant: "outline", className: "w-fit" })}>
          Ir para o Caixa
        </Link>
      </div>
    );
  }
  const closing = r.value;
  const result = recount ? null : closeResultView(closing);
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Fechar caixa"
        description={
          result
            ? "Confira o resultado, diga quanto fica na gaveta e feche o caixa."
            : "Conte o dinheiro da gaveta. O valor esperado aparece depois que você confirmar a contagem."
        }
        back={back}
      />
      <Card className="max-w-3xl">
        {result ? (
          <CloseResult closing={result} action={closeCashSessionAction} />
        ) : (
          <CountForm
            sessionId={closing.sessionId}
            counts={closing.counts.map((c) => c.toFixed(2))}
            outdated={!recount && Boolean(closing.lastCount?.outdated)}
            action={countCashAction}
          />
        )}
      </Card>
    </div>
  );
}
