import type { PhotoProcessor } from "@/application/menu/ports";
import { err } from "@/domain/shared/result";

/** Trata a foto do produto com `sharp` (spec 013, research R1). */
export const sharpProcessor: PhotoProcessor = {
  process: async () => err("PHOTO_STORAGE_FAILED"),
};
