import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listAddons } from "@/application/ordering/addons";
import { can } from "@/domain/access/permissions";
import { COST_BAND_LABELS } from "@/domain/inventory/product-cost";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { money, percent } from "@/components/costs/format";
import { priceOrFree } from "@/components/ordering/format";
import { NoAccess } from "@/components/layout/no-access";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Adicionais" };

export default async function Page({ searchParams }: PageProps<"/pedidos/adicionais">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const all = sp.situacao === "todos";
  const r = await listAddons(serverDeps(), ctx, { includeInactive: all });
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Adicionais"
        description={
          <>
            O que o cliente pode pôr a mais no prato, com preço. Ligue cada adicional aos produtos no quadro
            &quot;Adicionar e tirar&quot; da página do produto.
          </>
        }
        actions={
          can(ctx.roles, "addon.write") && (
            <Link href="/pedidos/adicionais/novo" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Novo adicional
            </Link>
          )
        }
      />
      <TextLink href={all ? "/pedidos/adicionais" : "/pedidos/adicionais?situacao=todos"} className="text-sm">
        {all ? "Mostrar só os ativos" : "Mostrar também os inativos"}
      </TextLink>
      {r.value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum adicional ainda.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>O que vai</Th>
              <Th className="text-right">Preço</Th>
              <Th className="text-right">Custo</Th>
              <Th className="text-right">Custo no preço</Th>
            </tr>
          </thead>
          <tbody>
            {r.value.map((a) => (
              <tr key={a.id}>
                <Td>
                  <TextLink href={`/pedidos/adicionais/${a.id}`}>{a.name}</TextLink>{" "}
                  {!a.active && <Badge tone="neutral">inativo</Badge>}
                </Td>
                <Td>
                  {a.componentName} · {formatBrDecimal(a.quantity)} {a.unit}
                </Td>
                <Td className="text-right">{priceOrFree(a.price)}</Td>
                <Td className="text-right">{a.cost ? money(a.cost) : "sem custo"}</Td>
                <Td className="text-right">
                  {a.costShare && a.band ? `${percent(a.costShare)} · ${COST_BAND_LABELS[a.band]}` : "–"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
