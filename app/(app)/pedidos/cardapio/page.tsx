import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  createSectionAction,
  deleteSectionAction,
  moveProductAction,
  moveSectionAction,
  renameSectionAction,
} from "@/actions/menu-board";
import { serverDeps } from "@/infra/server";
import { getMenuBoard } from "@/application/menu/board";
import { can } from "@/domain/access/permissions";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { MenuBoard } from "@/components/menu/menu-board";
import { AppearanceForm } from "@/components/menu/appearance-form";
import { getAppearance } from "@/application/menu/appearance";
import { removeAppearanceImageAction } from "@/actions/appearance";

export const metadata: Metadata = { title: "Cardápio" };

/** Tela Cardápio da equipe (spec 013): o gerente e o chef organizam o que o cliente vê. */
export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const appearanceAllowed = can(ctx.roles, "menu.appearance");
  const [board, appearance] = await Promise.all([
    getMenuBoard(deps, ctx),
    appearanceAllowed ? getAppearance(deps, ctx) : null,
  ]);
  if (!board.ok) return <NoAccess />;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cardápio"
        description="As seções e os produtos na ordem em que o cliente vê. Toque num produto para pôr foto, descrição e preço."
      />
      {appearance?.ok && (
        <AppearanceForm appearance={appearance.value} removeAction={removeAppearanceImageAction} />
      )}
      <MenuBoard
        board={board.value}
        canCreateProduct={can(ctx.roles, "recipe.write")}
        actions={{
          createSection: createSectionAction,
          renameSection: renameSectionAction,
          moveSection: moveSectionAction,
          deleteSection: deleteSectionAction,
          moveProduct: moveProductAction,
        }}
      />
    </div>
  );
}
