import type { OrderSource, OrderStatus } from "@/domain/ordering/order";
import type { BadgeTone } from "@/components/ui/badge";

/** "há 35 min", "há 1 h 05 min" (grade de mesas, US1-1). */
export function sinceText(from: string, now: string): string {
  const minutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `há ${h} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "3 itens", "1 item". */
export const itemsText = (n: number) => (n === 1 ? "1 item" : `${n} itens`);

/** "QR code", "Tablet da mesa" (016) ou o nome de quem lançou (FR-017: nunca "origem EQUIPE"). */
export const placedByText = (o: { source: OrderSource; placedByName: string | null }) =>
  o.source === "QR" ? "QR code" : o.source === "TABLET" ? "Tablet da mesa" : (o.placedByName ?? "Equipe");

export const STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  RECEIVED: "info",
  PREPARING: "warning",
  READY: "success",
  DELIVERED: "neutral",
  CANCELLED: "danger",
};
