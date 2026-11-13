import { err, type Result } from "@/domain/shared/result";

export type MenuDetailsInput = { id: string; version: number; description: string; sectionId: string | null };
export const parseMenuDetails = (_raw: Record<string, unknown>): Result<MenuDetailsInput> => err("NO_CHANGE");
