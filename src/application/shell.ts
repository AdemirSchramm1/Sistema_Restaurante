import type { Deps } from "./ports";
import type { RequestContext } from "./context";
import { err, type Result } from "@/domain/shared/result";

export type ShellInfo = { restaurantName: string; reorderCount: number | null };

export async function getShellInfo(_deps: Deps, _ctx: RequestContext): Promise<Result<ShellInfo>> {
  return err("NOT_FOUND");
}
