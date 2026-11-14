import { err, ok, type Result } from "../shared/result";

/** Ordem das seções e dos produtos no cardápio (spec 013, US2.3 e US3). */
export type Direction = "up" | "down";

export const isDirection = (v: unknown): v is Direction => v === "up" || v === "down";

/** Troca `id` com o vizinho de cima ou de baixo. Na ponta, `NO_CHANGE` (US3.1). */
export function move(ids: readonly string[], id: string, direction: Direction): Result<string[]> {
  const from = ids.indexOf(id);
  if (from < 0) return err("NOT_FOUND");
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return err("NO_CHANGE");
  const out = [...ids];
  out[from] = ids[to]!;
  out[to] = id;
  return ok(out);
}

/** Quem pode subir e quem pode descer, para ligar e desligar os botões. */
export function canMove(ids: readonly string[], id: string): { up: boolean; down: boolean } {
  const at = ids.indexOf(id);
  return { up: at > 0, down: at >= 0 && at < ids.length - 1 };
}

/** Produto novo, ou que muda de seção, entra no fim (US3.2 e US3.3). */
export const appendPosition = (positions: readonly number[]): number => Math.max(0, ...positions) + 1;
