export const SIMILAR_WINDOW_MINUTES = 0;
export type RecentOrder = {
  submittedAt: string;
  source: "QR" | "STAFF";
  placedById: string | null;
  placedByName: string | null;
  status: string;
  lines: { recipeId: string; productName: string; quantity: number }[];
};
export const similarRecentOrders = (_i: unknown): { who: string; items: string; minutes: number }[] => [];
export const similarText = (_w: { who: string; items: string; minutes: number }) => "";
