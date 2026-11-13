import type { RecipeLineData } from "@/domain/inventory/recipe";
import type { Decimal } from "@/domain/shared/decimal";
import { err, type Result } from "@/domain/shared/result";

export type MenuProductInput = {
  name: string;
  lines: RecipeLineData[];
  salePrice: Decimal | null;
  sectionId: string | null;
  description: string;
};

export function parseMenuProductCreate(_raw: Record<string, unknown>): Result<MenuProductInput> {
  return err("NOT_FOUND");
}
