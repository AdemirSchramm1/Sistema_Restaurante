import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listSuppliers } from "@/application/suppliers/suppliers";
import { can } from "@/domain/access/permissions";
import { formatCnpj } from "@/domain/suppliers/cnpj";
import { WEEKDAY_LABELS } from "@/domain/suppliers/supplier";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Fornecedores" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function Page({ searchParams }: PageProps<"/estoque/fornecedores">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const status = (["active", "blocked", "all"] as const).find((s) => s === one(sp.situacao)) ?? "active";
  const filter = { q: one(sp.q), status };
  const list = await listSuppliers(serverDeps(), ctx, filter);
  const rows = list.ok ? list.value : [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Fornecedores"
        description="De quem você compra, o contato, quando entrega e quanto cobra por cada item."
        actions={
          can(ctx.roles, "supplier.write") && (
            <Link href="/estoque/fornecedores/novo" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Novo fornecedor
            </Link>
          )
        }
      />
      <form className="grid gap-2 sm:grid-cols-4" role="search">
        <Input
          name="q"
          placeholder="Buscar por nome ou CNPJ"
          defaultValue={filter.q}
          aria-label="Buscar"
          className="sm:col-span-2"
        />
        <div className="flex gap-2">
          <Select name="situacao" defaultValue={status} aria-label="Situação">
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
            <option value="all">Todos</option>
          </Select>
          <button className={buttonVariants({ variant: "outline" })} type="submit">
            Filtrar
          </button>
        </div>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>CNPJ</Th>
            <Th>Contato</Th>
            <Th>Entrega</Th>
            <Th>Itens</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <TextLink href={`/estoque/fornecedores/${r.id}`}>{r.name}</TextLink>{" "}
                {!r.active && <Badge tone="danger">bloqueado</Badge>}
              </Td>
              <Td className="font-mono text-xs">{r.cnpj ? formatCnpj(r.cnpj) : "—"}</Td>
              <Td>{[r.contactName, r.phone].filter(Boolean).join(" · ") || "—"}</Td>
              <Td>{r.deliveryDays.map((d) => WEEKDAY_LABELS[d]).join(", ") || "—"}</Td>
              <Td>{r.itemCount}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={5} className="text-center text-muted-foreground">
                Nenhum fornecedor encontrado.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
