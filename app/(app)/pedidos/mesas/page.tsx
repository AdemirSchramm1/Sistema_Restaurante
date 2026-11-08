import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  createTableAction,
  createTablesInRangeAction,
  renameTableAction,
  rotateTableQrAction,
  setTableActiveAction,
} from "@/actions/tables";
import { serverDeps } from "@/infra/server";
import { listTables, tableQrCodes } from "@/application/ordering/tables";
import { ActionForm } from "@/components/forms/action-form";
import { TableQrCard } from "@/components/ordering/table-qr-card";
import { TableRangeForm } from "@/components/ordering/table-range-form";
import { NoAccess } from "@/components/layout/no-access";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export const metadata: Metadata = { title: "Mesas" };

export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const [list, qrs] = await Promise.all([
    listTables(deps, ctx, { includeInactive: true }),
    tableQrCodes(deps, ctx, {}),
  ]);
  if (!list.ok || !qrs.ok) return <NoAccess />;
  const svgById = new Map(qrs.value.tables.map((t) => [t.id, t]));
  const active = list.value.filter((t) => t.active);
  const inactive = list.value.filter((t) => !t.active);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Mesas e QR codes</h1>
        {active.length > 0 && (
          <Link href="/pedidos/mesas/imprimir" className={buttonVariants({ variant: "outline" })}>
            Imprimir todos
          </Link>
        )}
      </div>

      <Card className="grid gap-4">
        <CardTitle>Nova mesa</CardTitle>
        <ActionForm action={createTableAction} submitLabel="Criar mesa" aria-label="Criar uma mesa">
          <div className="grid gap-1">
            <Label htmlFor="table-name">Nome da mesa</Label>
            <Input id="table-name" name="name" maxLength={30} placeholder="12 ou Varanda 3" required />
          </div>
        </ActionForm>
        <TableRangeForm action={createTablesInRangeAction} />
      </Card>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mesa ainda. Crie a primeira acima.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((t) => {
            const qr = svgById.get(t.id);
            return (
              <li key={t.id} className="grid gap-2">
                {qr && (
                  <TableQrCard
                    restaurantName={qrs.value.restaurantName}
                    table={{ ...qr, version: t.version }}
                    rotateAction={rotateTableQrAction}
                  />
                )}
                <div className="grid gap-2 text-sm">
                  <Link
                    href={`/pedidos/mesas/imprimir?ids=${t.id}`}
                    className="text-primary underline underline-offset-4"
                  >
                    Imprimir este QR code
                  </Link>
                  <ActionForm
                    action={renameTableAction}
                    hidden={{ id: t.id, version: t.version }}
                    submitLabel="Renomear"
                    aria-label={`Renomear a mesa ${t.name}`}
                  >
                    <Input name="name" defaultValue={t.name} maxLength={30} aria-label="Nome da mesa" className="w-32" />
                  </ActionForm>
                  <ActionForm
                    action={setTableActiveAction}
                    hidden={{ id: t.id, version: t.version, active: "false" }}
                    submitLabel="Inativar mesa"
                    variant="ghost"
                    aria-label={`Inativar a mesa ${t.name}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {inactive.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Mesas inativas</h2>
          <ul className="grid gap-2">
            {inactive.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span>Mesa {t.name}</span>
                <ActionForm
                  action={setTableActiveAction}
                  hidden={{ id: t.id, version: t.version, active: "true" }}
                  submitLabel="Reativar"
                  aria-label={`Reativar a mesa ${t.name}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
