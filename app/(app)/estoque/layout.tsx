import { requireContext } from "@/actions/_session";
import { can } from "@/domain/access/permissions";
import { NoAccess } from "@/components/layout/no-access";

/** Telas do estoque: só para quem tem `catalog.read` (o garçom não tem). */
export default async function EstoqueLayout({ children }: LayoutProps<"/estoque">) {
  const ctx = await requireContext();
  if (!can(ctx.roles, "catalog.read")) return <NoAccess />;
  return children;
}
