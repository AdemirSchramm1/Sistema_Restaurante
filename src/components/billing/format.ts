import { d, formatBrDecimal } from "@/domain/shared/decimal";

/** "há 35 min", "há 1 h 05 min" desde `from` até a hora do servidor. */
export function sinceText(from: string, now: string): string {
  const minutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `há ${h} h ${String(m).padStart(2, "0")} min` : `há ${h} h`;
}

/** "1 pedido ainda não foi entregue", "2 pedidos ainda não foram entregues". */
export const pendingText = (n: number) =>
  n === 1 ? "1 pedido ainda não foi entregue" : `${n} pedidos ainda não foram entregues`;

/** "10%", "12,5%". */
export const percent = (rate: string) => `${formatBrDecimal(d(rate), { minPlaces: 0, maxPlaces: 2 })}%`;

/** "18:10" no fuso do restaurante. */
export const timeIn = (at: string, timeZone: string) =>
  new Date(at).toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
