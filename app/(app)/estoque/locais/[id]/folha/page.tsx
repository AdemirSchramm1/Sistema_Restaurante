import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getCountSheet } from "@/application/inventory/locations";
import { LOCATION_KIND_LABELS } from "@/domain/inventory/location";
import { PrintButton } from "@/components/locations/print-button";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Folha de contagem" };

/** Folha impressa na ordem física do local (FR-030). Sem saldo: contagem cega. */
export default async function Page({ params }: PageProps<"/estoque/locais/[id]/folha">) {
  const ctx = await requireContext();
  const { id } = await params;
  const sheet = await getCountSheet(serverDeps(), ctx, id);
  if (!sheet.ok) notFound();
  const { location, rows } = sheet.value;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Folha de contagem · {location.name}</h1>
          <p className="text-sm text-muted-foreground">
            {LOCATION_KIND_LABELS[location.kind]} · Data: ____/____/______ · Contado por: ____________________
          </p>
        </div>
        <PrintButton />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item ligado a este local.</p>
      ) : (
        <Table aria-label="Itens da folha de contagem">
          <thead>
            <tr>
              <Th>Pos.</Th>
              <Th>Código</Th>
              <Th>Descrição</Th>
              <Th>Unidade</Th>
              <Th className="w-40">Quantidade contada</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId}>
                <Td>{r.sheetPosition}</Td>
                <Td className="font-mono">{r.code}</Td>
                <Td>{r.description}</Td>
                <Td>{r.stockUnit}</Td>
                <Td className="border-b border-foreground/40" />
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
