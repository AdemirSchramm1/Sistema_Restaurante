import type { Role } from "@/domain/access/permissions";

export type Origin = { channel: "web" | "test" | "system"; ip?: string | null; userAgent?: string | null };

/** Quem está fazendo a operação. Sempre montado a partir da sessão, nunca de dado do cliente. */
export type RequestContext = {
  userId: string;
  restaurantId: string;
  membershipId: string;
  roles: readonly Role[];
  origin: Origin;
};
