import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { Photo } from "@/domain/menu/photo";
import { err, type Result } from "@/domain/shared/result";

export const setProductPhoto = async (
  _d: Deps,
  _c: RequestContext,
  _i: { id: string; bytes: Uint8Array },
): Promise<Result<{ photo: Photo }>> => err("NO_CHANGE");
export const removeProductPhoto = async (
  _d: Deps,
  _c: RequestContext,
  _i: { id: string },
): Promise<Result<void>> => err("VALIDATION");
