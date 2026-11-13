import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  createSectionAction,
  deleteSectionAction,
  moveSectionAction,
  renameSectionAction,
} from "@/actions/menu-board";
import { serverDeps } from "@/infra/server";
import { getMenuBoard } from "@/application/menu/board";
import { can } from "@/domain/access/permissions";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { MenuBoard } from "@/components/menu/menu-board";

export const metadata: Metadata = { title: "Cardápio" };

/** Tela Cardápio da equipe (spec 013): o gerente e o chef organizam o que o cliente vê. */
export default async function Page() {
  const ctx = await requireContext();
  const board = await getMenuBoard(serverDeps(), ctx);
  if (!board.ok) return <NoAccess />;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cardápio"
        description="As seções e os produtos na ordem em que o cliente vê. Toque num produto para pôr foto, descrição e preço."
      />
      <MenuBoard
        board={board.value}
        canCreateProduct={can(ctx.roles, "recipe.write")}
        actions={{
          createSection: createSectionAction,
          renameSection: renameSectionAction,
          moveSection: moveSectionAction,
          deleteSection: deleteSectionAction,
          moveProduct: moveSectionAction,
        }}
      />
    </div>
  );
}
