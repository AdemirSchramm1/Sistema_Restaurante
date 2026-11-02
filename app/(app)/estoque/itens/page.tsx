import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listItems } from "@/application/inventory/list-items";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { ITEM_TYPES, ITEM_TYPE_LABELS, describePurchase, type ItemType } from "@/domain/inventory/item";
import { can } from "@/domain/access/permissions";
import { formatBrDecimal } from "@/domain/shared/decimal";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Itens" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function Page({ searchParams }: PageProps<"/estoque/itens">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const deps = serverDeps();
  const filter = {
    q: one(sp.q),
    groupId: one(sp.grupo),
    type: ITEM_TYPES.includes(one(sp.tipo) as ItemType) ? (one(sp.tipo) as ItemType) : undefined,
    status: (one(sp.situacao) as "active" | "inactive" | "all") ?? "active",
    page: Number.parseInt(one(sp.pagina) ?? "1", 10),
  };
  const [list, tree] = await Promise.all([listItems(deps, ctx, filter), listGroupTree(deps, ctx)]);
  const rows = list.ok ? list.value.rows : [];
  const total = list.ok ? list.value.total : 0;
  const pages = list.ok ? Math.max(1, Math.ceil(total / list.value.pageSize)) : 1;
  const qs = (page: number) => {
    const p = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
    );
    p.set("pagina", String(page));
    return `?${p.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Itens</h1>
        {can(ctx.roles, "item.write") && (
          <Link href="/estoque/itens/novo" className={buttonVariants()}>
            Novo item
          </Link>
        )}
      </div>
      <form className="grid gap-2 sm:grid-cols-5" role="search">
        <Input
          name="q"
          placeholder="Buscar por nome ou código"
          defaultValue={filter.q}
          aria-label="Buscar"
          className="sm:col-span-2"
        />
        <Select name="grupo" defaultValue={filter.groupId ?? ""} aria-label="Grupo">
          <option value="">Todos os grupos</option>
          {tree.ok &&
            tree.value.map((g) => <option key={g.id} value={g.id}>{`${g.code} · ${g.name}`}</option>)}
        </Select>
        <Select name="tipo" defaultValue={filter.type ?? ""} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ITEM_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Select name="situacao" defaultValue={filter.status} aria-label="Situação">
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="all">Todos</option>
          </Select>
          <button className={buttonVariants({ variant: "outline" })} type="submit">
            Filtrar
          </button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "item" : "itens"}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Código</Th>
            <Th>Nome</Th>
            <Th>Grupo</Th>
            <Th>Tipo</Th>
            <Th>Saldo</Th>
            <Th>Como compra</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="font-mono">{r.code}</Td>
              <Td>
                <Link className="text-primary underline underline-offset-4" href={`/estoque/itens/${r.id}`}>
                  {r.description}
                </Link>{" "}
                {!r.active && <Badge tone="muted">inativo</Badge>}
              </Td>
              <Td>
                {r.groupName} › {r.subgroupName}
              </Td>
              <Td>{ITEM_TYPE_LABELS[r.type]}</Td>
              <Td>
                {formatBrDecimal(r.balance, { maxPlaces: 4 })} {r.stockUnit}
              </Td>
              <Td>{describePurchase(r) ?? <span className="text-muted-foreground">solto</span>}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-muted-foreground">
                Nenhum item encontrado.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {pages > 1 && (
        <nav className="flex gap-2 text-sm" aria-label="Páginas">
          {filter.page > 1 && <Link href={qs(filter.page - 1)}>← Anterior</Link>}
          <span>
            Página {filter.page} de {pages}
          </span>
          {filter.page < pages && <Link href={qs(filter.page + 1)}>Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
