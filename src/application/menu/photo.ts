import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { auditStamp } from "../shared";
import { loadDish, PRODUCT_ENTITY, recordMenuEvent, withMenuAccess } from "./shared";
import type { Photo } from "@/domain/menu/photo";
import { err, ok, type Result } from "@/domain/shared/result";

/** Foto do produto no cardápio (spec 013, US1 e FR-003). Os arquivos ficam fora do banco. */

/** Apaga os arquivos de uma foto. Se a loja falhar, sobra um arquivo sem dono, e só. */
const discard = (deps: Deps, photo: Photo) =>
  deps.photos.storage.remove(photo.base, photo.widths).catch(() => undefined);

/**
 * Trata a foto, grava os arquivos novos e só então liga a foto ao produto. Os arquivos da foto
 * anterior saem depois do commit; se o banco falhar, saem os novos e o produto fica como estava.
 */
export async function setProductPhoto(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; bytes: Uint8Array },
): Promise<Result<{ photo: Photo }>> {
  const target = { entity: PRODUCT_ENTITY, id: input.id };
  const found = await withMenuAccess(deps, ctx, target, (repos) => loadDish(repos, input.id));
  if (!found.ok) return found;
  const previous = found.value.photo;

  const processed = await deps.photos.processor.process(input.bytes, "PRODUCT");
  if (!processed.ok) return processed;
  const { variants } = processed.value;
  // O identificador da foto não diz de qual restaurante nem de qual produto ela é.
  const stored = await deps.photos.storage.put(crypto.randomUUID(), variants).catch(() => null);
  if (!stored) return err("PHOTO_STORAGE_FAILED");
  const photo: Photo = { base: stored.base, widths: variants.map((v) => v.width) };

  try {
    await deps.tenant(ctx.restaurantId, async (repos) => {
      await repos.menuBoard.setPhoto(input.id, photo, auditStamp(deps, ctx));
      await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.photo.set", {
        photo: [previous?.base ?? null, photo.base],
      });
      return ok(undefined);
    });
  } catch (e) {
    await discard(deps, photo);
    throw e;
  }
  if (previous) await discard(deps, previous);
  return ok({ photo });
}

export async function removeProductPhoto(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const target = { entity: PRODUCT_ENTITY, id: input.id };
  const removed = await withMenuAccess(deps, ctx, target, async (repos) => {
    const found = await loadDish(repos, input.id);
    if (!found.ok) return found;
    const { photo } = found.value;
    if (!photo) return err("NO_CHANGE");
    await repos.menuBoard.setPhoto(input.id, null, auditStamp(deps, ctx));
    await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.photo.remove", { photo: [photo.base, null] });
    return ok(photo);
  });
  if (!removed.ok) return removed;
  await discard(deps, removed.value);
  return ok(undefined);
}
