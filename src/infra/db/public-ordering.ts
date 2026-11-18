import type { GlobalLookups } from "@/application/ports";
import type { MenuAccessKind } from "@/domain/ordering/menu-access";
import type { Db } from "./db";

/**
 * Consultas da rota pública do cardápio (spec 009, ADR 0005). Funções `SECURITY DEFINER` que
 * devolvem só o restaurante e o id: nada mais do restaurante sai antes do `withTenantTx`.
 */
export function publicOrderingLookups(
  db: Db,
): Pick<GlobalLookups, "tableByQrToken" | "menuAccessByTokenHash" | "tableByTabletToken"> {
  const table = async (fn: string, token: string) => {
    const r = await db.$client.query<{ restaurant_id: string; table_id: string; active: boolean }>(
      `select * from ${fn}($1)`,
      [token],
    );
    const row = r.rows[0];
    return row ? { restaurantId: row.restaurant_id, tableId: row.table_id, active: row.active } : null;
  };
  return {
    tableByQrToken: (token) => table("app_table_by_qr_token", token),
    tableByTabletToken: (token) => table("app_table_by_tablet_token", token),
    async menuAccessByTokenHash(hash) {
      const r = await db.$client.query<{
        restaurant_id: string;
        menu_access_id: string;
        kind: MenuAccessKind;
      }>("select * from app_menu_access_by_token_hash($1)", [hash]);
      const row = r.rows[0];
      return row
        ? { restaurantId: row.restaurant_id, menuAccessId: row.menu_access_id, kind: row.kind }
        : null;
    },
  };
}
