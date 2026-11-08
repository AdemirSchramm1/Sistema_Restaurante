import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { refKey, type ComponentRef } from "@/domain/inventory/recipe";
import { validateCustomizationConfig, type CustomizationConfig } from "@/domain/ordering/customization";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Quadro "Adicionar e tirar" do produto (spec 010, US2). Não cria versão nova do produto. */

const ENTITY = "recipe";

export type ProductCustomizationView = {
  /** Trava otimista do produto. */
  version: number;
  addons: { addonId: string; name: string; price: Decimal; maxTimes: number }[];
  /** `orphan`: o componente saiu da versão mais nova do produto e o botão não aparece mais. */
  removables: { component: ComponentRef; label: string; orphan: boolean }[];
  /** O que está na versão mais nova (para escolher o que pode tirar). */
  candidates: { component: ComponentRef; name: string }[];
  /** Adicionais ativos para ligar. */
  available: { addonId: string; name: string; price: Decimal }[];
};

/** "Adicionar: Fatia de queijo (até 2). Tirar: Sem cebola." */
function describe(c: {
  addons: readonly { name: string; maxTimes: number }[];
  removables: readonly { label: string }[];
}): string {
  const parts: string[] = [];
  if (c.addons.length) parts.push(`Adicionar: ${c.addons.map((a) => `${a.name} (até ${a.maxTimes})`).join(", ")}.`);
  if (c.removables.length) parts.push(`Tirar: ${c.removables.map((r) => r.label).join(", ")}.`);
  return parts.join(" ") || "Nada para adicionar ou tirar";
}

export async function getProductCustomization(
  deps: Deps,
  ctx: RequestContext,
  recipeId: string,
): Promise<Result<ProductCustomizationView>> {
  const allowed = await authorize(deps, ctx, "addon.read", ENTITY, recipeId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const recipe = await repos.recipes.get(recipeId);
    if (!recipe) return err("NOT_FOUND");
    if (recipe.kind !== "DISH") return err("NOT_A_DISH");
    const current = await repos.customization.get(recipeId);
    const refs = recipe.current.lines.map((l) => l.component);
    const found = refs.length ? await repos.recipes.components(refs) : [];
    const nameOf = new Map(found.map((c) => [refKey(c.ref), c.name]));
    const inLatest = new Set(refs.map(refKey));
    const available = (await repos.addons.list(false)).map((a) => ({ addonId: a.id, name: a.name, price: a.price }));
    return ok({
      version: recipe.version,
      addons: current.addons.map(({ addonId, name, price, maxTimes }) => ({ addonId, name, price, maxTimes })),
      removables: current.removables.map((r) => ({ ...r, orphan: !inLatest.has(refKey(r.component)) })),
      candidates: refs.map((component) => ({ component, name: nameOf.get(refKey(component)) ?? "?" })),
      available,
    });
  });
}

export async function setProductCustomization(
  deps: Deps,
  ctx: RequestContext,
  input: {
    recipeId: string;
    version: number;
    addons: { addonId: string; maxTimes: number }[];
    removables: { component: ComponentRef; label?: string | null }[];
  },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "addon.write", ENTITY, input.recipeId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const recipe = await repos.recipes.get(input.recipeId);
    if (!recipe) return err("NOT_FOUND");
    if (recipe.kind !== "DISH") return err("NOT_A_DISH");

    const addons = new Map((await repos.addons.getMany(input.addons.map((a) => a.addonId))).map((a) => [a.id, a]));
    const refs = recipe.current.lines.map((l) => l.component);
    const found = refs.length ? await repos.recipes.components(refs) : [];
    const nameOf = new Map(found.map((c) => [refKey(c.ref), c.name]));
    const valid = validateCustomizationConfig(
      {
        addons: input.addons.map((a) => ({ ...a, active: addons.get(a.addonId)?.active === true })),
        removables: input.removables.map((r) => ({
          component: r.component,
          label: r.label ?? null,
          name: nameOf.get(refKey(r.component)) ?? "",
        })),
      },
      new Set(refs.map(refKey)),
    );
    if (!valid.ok) return valid;
    const config: CustomizationConfig = valid.value;

    const before = await repos.customization.get(input.recipeId);
    const r = await repos.customization.replace(input.recipeId, config, input.version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    const beforeText = describe(before);
    const afterText = describe({
      addons: config.addons.map((a) => ({ name: addons.get(a.addonId)!.name, maxTimes: a.maxTimes })),
      removables: config.removables,
    });
    if (beforeText !== afterText)
      await repos.audit.record({
        entity: ENTITY,
        entityId: input.recipeId,
        action: "UPDATE",
        changes: { customization: [beforeText, afterText] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}
