import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listRecipes } from "@/application/inventory/recipes";
import { RECIPE_KINDS, RECIPE_KIND_LABELS, type RecipeKind } from "@/domain/inventory/recipe";
import { can } from "@/domain/access/permissions";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Produtos" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function Page({ searchParams }: PageProps<"/estoque/produtos">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const kind = RECIPE_KINDS.includes(one(sp.tipo) as RecipeKind) ? (one(sp.tipo) as RecipeKind) : undefined;
  const status = (["active", "inactive", "all"] as const).find((s) => s === one(sp.situacao)) ?? "active";
  const filter = { q: one(sp.q), kind, status };
  const list = await listRecipes(serverDeps(), ctx, filter);
  const rows = list.ok ? list.value : [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Produtos"
        description="O que o cliente pede e quanto de cada item vai nele. É com isso que o estoque baixa sozinho."
        actions={
          can(ctx.roles, "recipe.write") && (
            <Link href="/estoque/produtos/novo" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Novo produto
            </Link>
          )
        }
      />
      <form className="grid gap-2 sm:grid-cols-4" role="search">
        <Input
          name="q"
          placeholder="Buscar por nome"
          defaultValue={filter.q}
          aria-label="Buscar"
          className="sm:col-span-2"
        />
        <Select name="tipo" defaultValue={kind ?? ""} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {RECIPE_KINDS.map((k) => (
            <option key={k} value={k}>
              {RECIPE_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Select name="situacao" defaultValue={status} aria-label="Situação">
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
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
            <Th>Tipo</Th>
            <Th>Itens</Th>
            <Th>Versão</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <TextLink href={`/estoque/produtos/${r.id}`}>{r.name}</TextLink>{" "}
                {!r.active && <Badge tone="neutral">inativo</Badge>}
              </Td>
              <Td>{r.kind === "SUB_RECIPE" ? "Preparo" : "Vendido"}</Td>
              <Td>{r.lineCount}</Td>
              <Td>{r.versionNumber}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={4} className="text-center text-muted-foreground">
                Nenhum produto encontrado.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
