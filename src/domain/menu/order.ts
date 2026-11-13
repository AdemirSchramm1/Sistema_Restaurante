import { ok, type Result } from "../shared/result";

/** Ordem no cardápio (spec 013, US2.3 e US3). Esqueleto. */
export type Direction = "up" | "down";
export const isDirection = (_v: unknown): _v is Direction => false;
export function move(_ids: readonly string[], _id: string, _direction: Direction): Result<string[]> {
  return ok([]);
}
export function appendPosition(_positions: readonly number[]): number {
  return 0;
}
export function canMove(_ids: readonly string[], _id: string): { up: boolean; down: boolean } {
  return { up: false, down: false };
}
