import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { tableQrCodes } from "@/application/ordering/tables";
import { TableQrCard } from "@/components/ordering/table-qr-card";
import { PrintButton } from "@/components/ordering/print-button";
import { NoAccess } from "@/components/layout/no-access";
import { TextLink } from "@/components/ui/text-link";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Imprimir QR codes" };

/** Folha para imprimir: um cartão por mesa, sem menu e sem botões. */
export default async function Page({ searchParams }: PageProps<"/pedidos/mesas/imprimir">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const ids = firstParam(sp.ids)?.split(",");
  const r = await tableQrCodes(serverDeps(), ctx, { ids });
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <TextLink href="/pedidos/mesas">Voltar para as mesas</TextLink>
        <PrintButton />
      </div>
      <ul className="qr-sheet grid grid-cols-2 gap-4 sm:grid-cols-3">
        {r.value.tables.map((t) => (
          <li key={t.id} className="break-inside-avoid">
            <TableQrCard restaurantName={r.value.restaurantName} table={{ ...t, version: 0 }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
