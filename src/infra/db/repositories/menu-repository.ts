import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { MenuBoardRepo, MenuProductRecord } from "@/application/menu/ports";
import { err, ok } from "@/domain/shared/result";
import type { Tx } from "../db";
import { menuSections, recipes } from "../schema";
import { dec, isUniqueViolation, withSavepoint } from "./util";

const stale = async (found: () => Promise<unknown[]>) =>
  (await found()).length ? err("STALE_RECORD") : err("NOT_FOUND");

/** Seções, ordem, descrição e foto do cardápio (spec 013). */
export function menuBoardRepository(tx: Tx, restaurantId: string): MenuBoardRepo {
  async function load(where: SQL): Promise<MenuProductRecord[]> {
    const rows = await tx
      .select({
        id: recipes.id,
        name: recipes.name,
        kind: recipes.kind,
        active: recipes.active,
        salePrice: recipes.salePrice,
        soldOutOn: recipes.soldOutOn,
        description: recipes.description,
        photoBase: recipes.photoBase,
        photoWidths: recipes.photoWidths,
        sectionId: recipes.menuSectionId,
        menuPosition: recipes.menuPosition,
        version: recipes.version,
      })
      .from(recipes)
      .where(where)
      .orderBy(asc(recipes.menuSectionId), asc(recipes.menuPosition));
    return rows.map(({ photoBase, photoWidths, salePrice, ...r }) => ({
      ...r,
      salePrice: dec(salePrice),
      photo: photoBase ? { base: photoBase, widths: photoWidths! } : null,
    }));
  }

  /** Nome repetido vira `NAME_IN_USE` sem estragar a transação. */
  const uniqueName = (write: () => Promise<{ id: string }[]>) =>
    withSavepoint(tx, write).catch((e: unknown) => {
      if (isUniqueViolation(e, "menu_sections_name")) return null;
      throw e;
    });

  return {
    async lock() {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`menu:${restaurantId}`}, 0))`);
    },

    async sections() {
      return tx
        .select({
          id: menuSections.id,
          name: menuSections.name,
          normalized: menuSections.nameNormalized,
          position: menuSections.position,
          version: menuSections.version,
        })
        .from(menuSections)
        .orderBy(asc(menuSections.position));
    },

    async insertSection(s, audit) {
      const inserted = await uniqueName(() =>
        tx
          .insert(menuSections)
          .values({
            id: s.id,
            restaurantId,
            name: s.name,
            nameNormalized: s.normalized,
            position: s.position,
            createdAt: audit.at,
            createdBy: audit.by,
            updatedAt: audit.at,
            updatedBy: audit.by,
          })
          .returning({ id: menuSections.id }),
      );
      return inserted ? ok(undefined) : err("NAME_IN_USE", "name");
    },

    async renameSection(id, s, version, audit) {
      const updated = await uniqueName(() =>
        tx
          .update(menuSections)
          .set({
            name: s.name,
            nameNormalized: s.normalized,
            version: version + 1,
            updatedAt: audit.at,
            updatedBy: audit.by,
          })
          .where(and(eq(menuSections.id, id), eq(menuSections.version, version)))
          .returning({ id: menuSections.id }),
      );
      if (!updated) return err("NAME_IN_USE", "name");
      if (updated.length) return ok(undefined);
      return stale(() =>
        tx.select({ id: menuSections.id }).from(menuSections).where(eq(menuSections.id, id)),
      );
    },

    async orderSections(ids) {
      for (const [index, id] of ids.entries())
        await tx
          .update(menuSections)
          .set({ position: index + 1 })
          .where(eq(menuSections.id, id));
    },

    async deleteSection(id) {
      await tx.delete(menuSections).where(eq(menuSections.id, id));
    },

    products: () => load(eq(recipes.kind, "DISH")),

    async product(id) {
      const [found] = await load(eq(recipes.id, id));
      return found ?? null;
    },

    async placeProducts(sectionId, ids) {
      if (!ids.length) return;
      // Uma ida ao banco para o grupo todo: a posição é o lugar do id na lista.
      await tx
        .update(recipes)
        .set({
          menuSectionId: sectionId,
          menuPosition: sql`array_position(${sql.param(ids)}::uuid[], ${recipes.id})`,
        })
        .where(inArray(recipes.id, [...ids]));
    },

    async setDescription(id, description, version, audit) {
      const updated = await tx
        .update(recipes)
        .set({ description, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(recipes.id, id), eq(recipes.version, version)))
        .returning({ id: recipes.id });
      if (updated.length) return ok(undefined);
      return stale(() => tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)));
    },

    async setPhoto(id, photo, audit) {
      await tx
        .update(recipes)
        .set({
          photoBase: photo?.base ?? null,
          photoWidths: photo?.widths ?? null,
          updatedAt: audit.at,
          updatedBy: audit.by,
        })
        .where(eq(recipes.id, id));
    },
  };
}
