import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { auditStamp, authorize } from "../shared";
import type { Appearance, AppearanceKind } from "./ports";
import type { Photo } from "@/domain/menu/photo";
import { can } from "@/domain/access/permissions";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Aparência do cardápio: logo e capa do restaurante (spec 016, US1; contracts "Aparência do
 * restaurante"). Mesma ordem da foto do prato (013): arquivos novos antes do banco, os antigos
 * depois do commit; se o banco falhar, saem os novos.
 */
const ENTITY = "restaurant";

const discard = (deps: Deps, photo: Photo) =>
  deps.photos.storage.remove(photo.base, photo.widths).catch(() => undefined);

export async function getAppearance(deps: Deps, ctx: RequestContext): Promise<Result<Appearance>> {
  if (!can(ctx.roles, "menu.appearance")) {
    const allowed = await authorize(deps, ctx, "menu.write", ENTITY, ctx.restaurantId);
    if (!allowed.ok) return allowed;
  }
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.menuBoard.appearance()));
}

/** Auditoria como na research R14: `{ logo: [base anterior, base nova] }` ou `{ cover: […] }`. */
const record = (
  repos: Parameters<Parameters<Deps["tenant"]>[1]>[0],
  ctx: RequestContext,
  kind: AppearanceKind,
  base: [string | null, string | null],
) =>
  repos.audit.record({
    entity: ENTITY,
    entityId: ctx.restaurantId,
    action: "UPDATE",
    changes: { [kind === "LOGO" ? "logo" : "cover"]: base },
    userId: ctx.userId,
    origin: ctx.origin,
  });

const current = (a: Appearance, kind: AppearanceKind) => (kind === "LOGO" ? a.logo : a.cover);

export async function setAppearanceImage(
  deps: Deps,
  ctx: RequestContext,
  input: { kind: AppearanceKind; bytes: Uint8Array },
): Promise<Result<{ photo: Photo }>> {
  const allowed = await authorize(deps, ctx, "menu.appearance", ENTITY, ctx.restaurantId);
  if (!allowed.ok) return allowed;

  const processed = await deps.photos.processor.process(input.bytes, input.kind);
  if (!processed.ok) return processed;
  const { variants } = processed.value;
  const stored = await deps.photos.storage.put(crypto.randomUUID(), variants).catch(() => null);
  if (!stored) return err("PHOTO_STORAGE_FAILED");
  const photo: Photo = { base: stored.base, widths: variants.map((v) => v.width) };

  // A transação sempre termina em `ok`; o anterior sai por aqui para ser apagado depois do commit.
  const replaced: { photo: Photo | null } = { photo: null };
  try {
    await deps.tenant(ctx.restaurantId, async (repos) => {
      replaced.photo = current(await repos.menuBoard.appearance(), input.kind);
      await repos.menuBoard.setAppearance(input.kind, photo, auditStamp(deps, ctx));
      await record(repos, ctx, input.kind, [replaced.photo?.base ?? null, photo.base]);
      return ok(undefined);
    });
  } catch (e) {
    await discard(deps, photo);
    throw e;
  }
  if (replaced.photo) await discard(deps, replaced.photo);
  return ok({ photo });
}

export async function removeAppearanceImage(
  deps: Deps,
  ctx: RequestContext,
  input: { kind: AppearanceKind },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "menu.appearance", ENTITY, ctx.restaurantId);
  if (!allowed.ok) return allowed;
  const removed = await deps.tenant(ctx.restaurantId, async (repos) => {
    const before = current(await repos.menuBoard.appearance(), input.kind);
    if (!before) return err("NO_CHANGE");
    await repos.menuBoard.setAppearance(input.kind, null, auditStamp(deps, ctx));
    await record(repos, ctx, input.kind, [before.base, null]);
    return ok(before);
  });
  if (!removed.ok) return removed;
  await discard(deps, removed.value);
  return ok(undefined);
}
