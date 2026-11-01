import { err, ok, type Result } from "../shared/result";

export const INVITATION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export function invitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_DAYS * DAY_MS);
}

/** Convite só vale pendente e dentro do prazo. */
export function checkInvitationUsable(
  inv: { status: InvitationStatus; expiresAt: Date },
  now: Date,
): Result<void> {
  if (inv.status === "EXPIRED") return err("INVITATION_EXPIRED");
  if (inv.status !== "PENDING") return err("INVITATION_INVALID");
  if (now.getTime() > inv.expiresAt.getTime()) return err("INVITATION_EXPIRED");
  return ok(undefined);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): Result<string> {
  const e = email.trim().toLowerCase();
  return EMAIL.test(e) && e.length <= 254 ? ok(e) : err("VALIDATION", "email");
}
