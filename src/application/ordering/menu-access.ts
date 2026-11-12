import type { Deps, Repos } from "../ports";
import { accessExpiresAt } from "@/domain/ordering/menu-access";
import { err, ok, type Result } from "@/domain/shared/result";

/** Acesso ao cardápio de 20 minutos desde a leitura do QR code (spec 009, US3, research R2). */

export type AccessOrigin = { ip: string | null; userAgent: string | null };

/** Encerra o acesso do cookie antigo deste celular, em qualquer restaurante. */
async function endPrevious(deps: Deps, cookie: string | null) {
  if (!cookie) return;
  const prev = await deps.global.menuAccessByTokenHash(deps.tokens.hash(cookie));
  if (!prev) return;
  await deps.tenant(prev.restaurantId, async (repos) => {
    await repos.menuAccesses.end(prev.menuAccessId, deps.clock.now(), "RESCAN");
    return ok(undefined);
  });
}

/**
 * Leitura do QR code. Token desconhecido: `NOT_FOUND` (a mesma resposta para token de outro
 * restaurante). Mesa inativa e chave desligada não abrem acesso.
 */
export async function openMenuAccess(
  deps: Deps,
  input: { qrToken: string; previousCookie: string | null; origin: AccessOrigin },
): Promise<Result<{ cookie: string; expiresAt: Date }>> {
  const table = input.qrToken ? await deps.global.tableByQrToken(input.qrToken) : null;
  if (!table) return err("NOT_FOUND");
  if (!table.active) return err("TABLE_INACTIVE");
  const paused = await deps.tenant(table.restaurantId, async (repos) =>
    (await repos.orderingSettings.get()).acceptingQrOrders ? ok(undefined) : err("ORDERING_PAUSED"),
  );
  if (!paused.ok) return paused;

  await endPrevious(deps, input.previousCookie);
  const now = deps.clock.now();
  const expiresAt = accessExpiresAt(now);
  const { token, hash } = deps.tokens.create();
  return deps.tenant(table.restaurantId, async (repos) => {
    await repos.menuAccesses.insert({
      id: deps.ids.next(),
      tableId: table.tableId,
      tokenHash: hash,
      openedAt: now,
      expiresAt,
      endedAt: null,
      ip: input.origin.ip?.slice(0, 64) ?? null,
      userAgent: input.origin.userAgent?.slice(0, 300) ?? null,
    });
    return ok({ cookie: token, expiresAt });
  });
}

/** Restaurante e acesso do cookie, ou `ACCESS_EXPIRED`. */
export async function accessFromCookie(
  deps: Deps,
  cookie: string | null,
): Promise<Result<{ restaurantId: string; menuAccessId: string }>> {
  if (!cookie) return err("ACCESS_EXPIRED");
  const found = await deps.global.menuAccessByTokenHash(deps.tokens.hash(cookie));
  return found ? ok(found) : err("ACCESS_EXPIRED");
}

/** Dentro da transação do restaurante: acesso, mesa e chave, na ordem das conferências. */
export async function loadAccess(repos: Repos, menuAccessId: string) {
  const access = await repos.menuAccesses.get(menuAccessId);
  if (!access) return err("ACCESS_EXPIRED");
  const table = await repos.tables.get(access.tableId);
  if (!table) return err("ACCESS_EXPIRED");
  const settings = await repos.orderingSettings.get();
  return ok({ access, table, settings });
}
