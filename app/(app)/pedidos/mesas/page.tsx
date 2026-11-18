import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  createTableAction,
  createTablesInRangeAction,
  renameTableAction,
  createTabletLinkAction,
  releaseTabletAction,
  rotateTableQrAction,
  rotateTabletLinkAction,
  setTableActiveAction,
} from "@/actions/tables";
import { listTabletStatus } from "@/application/ordering/tablets";
import { TableTabletCard } from "@/components/ordering/table-tablet-card";
import { qrSvg } from "@/infra/qr";
import { setAcceptingQrOrdersAction } from "@/actions/orders";
import { getOrderingSettings } from "@/application/ordering/orders";
import { serverDeps } from "@/infra/server";
import { listTables, tableQrCodes } from "@/application/ordering/tables";
import { ActionForm } from "@/components/forms/action-form";
import { TableQrCard } from "@/components/ordering/table-qr-card";
import { TableRangeForm } from "@/components/ordering/table-range-form";
import { NoAccess } from "@/components/layout/no-access";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";
import { Printer } from "lucide-react";

export const metadata: Metadata = { title: "Mesas" };

export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const [list, qrs, settings, tablets] = await Promise.all([
    listTables(deps, ctx, { includeInactive: true }),
    tableQrCodes(deps, ctx, {}),
    getOrderingSettings(deps, ctx),
    // Tablet da mesa (spec 016): só o gerente vê; os outros papéis recebem FORBIDDEN e não veem o quadro.
    listTabletStatus(deps, ctx),
  ]);
  if (!list.ok || !qrs.ok) return <NoAccess />;
  const svgById = new Map(qrs.value.tables.map((t) => [t.id, t]));
  const active = list.value.filter((t) => t.active);
  const inactive = list.value.filter((t) => !t.active);
  const tabletRows = tablets.ok
    ? new Map(
        await Promise.all(
          tablets.value.tables.map(
            async (t) => [t.tableId, { ...t, svg: t.link ? await qrSvg(t.link) : null }] as const,
          ),
        ),
      )
    : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mesas e QR codes"
        description="Cada mesa tem o seu QR code. O cliente escaneia, vê o cardápio e pede pelo celular."
        actions={
          active.length > 0 && (
            <Link href="/pedidos/mesas/imprimir" className={buttonVariants({ variant: "outline" })}>
              <Printer aria-hidden="true" />
              Imprimir todos
            </Link>
          )
        }
      />

      {tablets.ok && (
        <p role="status" className="text-sm">
          {tablets.value.bound === 1
            ? "1 mesa com tablet ligado"
            : `${tablets.value.bound} mesas com tablet ligado`}
        </p>
      )}

      {settings.ok && (
        <Card className="grid gap-2" aria-label="Recebendo pedidos pelo QR code">
          <CardTitle>Recebendo pedidos pelo QR code</CardTitle>
          {settings.value.acceptingQrOrders ? (
            <p className="text-sm">Ligado: os clientes podem pedir pelo celular.</p>
          ) : (
            <Alert tone="info">
              Desligado: quem escanear vê &quot;O restaurante não está recebendo pedidos agora. Chame um
              garçom.&quot;
            </Alert>
          )}
          <ActionForm
            action={setAcceptingQrOrdersAction}
            hidden={{ accepting: String(!settings.value.acceptingQrOrders), version: settings.value.version }}
            submitLabel={
              settings.value.acceptingQrOrders ? "Parar de receber pedidos" : "Voltar a receber pedidos"
            }
          />
        </Card>
      )}

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
                  <TextLink href={`/pedidos/mesas/imprimir?ids=${t.id}`}>Imprimir este QR code</TextLink>
                  <ActionForm
                    action={renameTableAction}
                    hidden={{ id: t.id, version: t.version }}
                    submitLabel="Renomear"
                    aria-label={`Renomear a mesa ${t.name}`}
                  >
                    <Input
                      name="name"
                      defaultValue={t.name}
                      maxLength={30}
                      aria-label="Nome da mesa"
                      className="w-32"
                    />
                  </ActionForm>
                  <ActionForm
                    action={setTableActiveAction}
                    hidden={{ id: t.id, version: t.version, active: "false" }}
                    submitLabel="Inativar mesa"
                    variant="ghost"
                    aria-label={`Inativar a mesa ${t.name}`}
                  />
                </div>
                {tabletRows?.get(t.id) && (
                  <TableTabletCard
                    table={tabletRows.get(t.id)!}
                    now={tablets.ok ? tablets.value.now : ""}
                    timezone={tablets.ok ? tablets.value.timezone : "America/Sao_Paulo"}
                    createAction={createTabletLinkAction}
                    releaseAction={releaseTabletAction}
                    rotateAction={rotateTabletLinkAction}
                  />
                )}
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
