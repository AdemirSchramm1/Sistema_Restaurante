/** Data local (AAAA-MM-DD) no fuso do restaurante. O número do pedido reinicia a cada dia. */
export function businessDay(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
