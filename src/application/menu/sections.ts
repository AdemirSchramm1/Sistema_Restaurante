import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { auditStamp } from "../shared";
import { recordMenuEvent, SECTION_ENTITY, withMenuAccess } from "./shared";
import { checkSectionName } from "@/domain/menu/section";
import { move, type Direction } from "@/domain/menu/order";
import { err, ok, type Result } from "@/domain/shared/result";

/** Seções do cardápio (spec 013, US2). Gerente e chef. */

export function createSection(
  deps: Deps,
  ctx: RequestContext,
  input: { name: string },
): Promise<Result<{ id: string }>> {
  return withMenuAccess(deps, ctx, { entity: SECTION_ENTITY }, async (repos) => {
    await repos.menuBoard.lock();
    const sections = await repos.menuBoard.sections();
    const checked = checkSectionName(input.name, sections);
    if (!checked.ok) return checked;
    const id = deps.ids.next();
    const position = sections.length + 1;
    await repos.menuBoard.insertSection({ id, ...checked.value, position }, auditStamp(deps, ctx));
    await recordMenuEvent(repos, ctx, { entity: SECTION_ENTITY, id }, "CREATE", "menu.section.create", {
      name: [null, checked.value.name],
      position: [null, position],
    });
    return ok({ id });
  });
}

export function renameSection(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; version: number; name: string },
): Promise<Result<void>> {
  const target = { entity: SECTION_ENTITY, id: input.id };
  return withMenuAccess(deps, ctx, target, async (repos) => {
    await repos.menuBoard.lock();
    const sections = await repos.menuBoard.sections();
    const current = sections.find((s) => s.id === input.id);
    if (!current) return err("NOT_FOUND");
    const checked = checkSectionName(input.name, sections, input.id);
    if (!checked.ok) return checked;
    if (checked.value.name === current.name) return ok(undefined);
    const renamed = await repos.menuBoard.renameSection(
      input.id,
      checked.value,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!renamed) return err("STALE_RECORD");
    await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.section.rename", {
      name: [current.name, checked.value.name],
    });
    return ok(undefined);
  });
}

export function moveSection(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; direction: Direction },
): Promise<Result<void>> {
  const target = { entity: SECTION_ENTITY, id: input.id };
  return withMenuAccess(deps, ctx, target, async (repos) => {
    await repos.menuBoard.lock();
    const sections = await repos.menuBoard.sections();
    const ids = sections.map((s) => s.id);
    const moved = move(ids, input.id, input.direction);
    if (!moved.ok) return moved;
    await repos.menuBoard.orderSections(moved.value);
    await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.section.move", {
      name: sections[ids.indexOf(input.id)]!.name,
      position: [ids.indexOf(input.id) + 1, moved.value.indexOf(input.id) + 1],
    });
    return ok(undefined);
  });
}

/** Apaga a seção de verdade; os produtos dela vão para o fim de "Outros" (US2.6). */
export function deleteSection(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<{ movedProducts: number }>> {
  const target = { entity: SECTION_ENTITY, id: input.id };
  return withMenuAccess(deps, ctx, target, async (repos) => {
    await repos.menuBoard.lock();
    const sections = await repos.menuBoard.sections();
    const current = sections.find((s) => s.id === input.id);
    if (!current) return err("NOT_FOUND");
    const products = await repos.menuBoard.products();
    const idsIn = (sectionId: string | null) =>
      products.filter((p) => p.sectionId === sectionId).map((p) => p.id);
    const moving = idsIn(input.id);
    await repos.menuBoard.placeProducts(null, [...idsIn(null), ...moving]);
    await repos.menuBoard.deleteSection(input.id);
    await repos.menuBoard.orderSections(sections.filter((s) => s.id !== input.id).map((s) => s.id));
    await recordMenuEvent(repos, ctx, target, "DEACTIVATE", "menu.section.delete", {
      name: [current.name, null],
      movedProducts: moving.length,
    });
    return ok({ movedProducts: moving.length });
  });
}
