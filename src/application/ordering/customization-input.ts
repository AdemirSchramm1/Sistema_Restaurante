import type { ComponentRef } from "@/domain/inventory/recipe";
import { err, ok, type Result } from "@/domain/shared/result";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^(addons|removables)\.(\d{1,2})\.(addonId|maxTimes|component|label)$/;
const ALLOWED = new Set(["recipeId", "version"]);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type CustomizationForm = {
  addons: { addonId: string; maxTimes: number }[];
  removables: { component: ComponentRef; label: string | null }[];
};

/** Quadro "Adicionar e tirar": `addons.N.addonId`, `addons.N.maxTimes`, `removables.N.component`, `removables.N.label`. */
export function parseCustomizationForm(raw: Record<string, unknown>): Result<CustomizationForm> {
  const rows = { addons: new Map<number, Record<string, string>>(), removables: new Map<number, Record<string, string>>() };
  for (const [k, v] of Object.entries(raw)) {
    const m = KEY.exec(k);
    if (!m) {
      if (ALLOWED.has(k)) continue;
      return err("VALIDATION", undefined, { keys: [k] });
    }
    const list = rows[m[1] as "addons" | "removables"];
    const i = Number.parseInt(m[2]!, 10);
    list.set(i, { ...list.get(i), [m[3]!]: text(v) });
  }
  const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const addons: CustomizationForm["addons"] = [];
  for (const [i, a] of sorted(rows.addons).entries()) {
    if (!UUID.test(a.addonId ?? "")) return err("VALIDATION", `addons.${i}`);
    addons.push({ addonId: a.addonId!, maxTimes: Number.parseInt(a.maxTimes ?? "", 10) });
  }
  const removables: CustomizationForm["removables"] = [];
  for (const [i, r] of sorted(rows.removables).entries()) {
    const [kind, id] = (r.component ?? "").split(":");
    if ((kind !== "ITEM" && kind !== "RECIPE") || !UUID.test(id ?? "")) return err("VALIDATION", `removables.${i}`);
    removables.push({ component: { kind, id: id! }, label: r.label ? r.label : null });
  }
  return ok({ addons, removables });
}
