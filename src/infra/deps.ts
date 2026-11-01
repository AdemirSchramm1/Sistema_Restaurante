import { v7 as uuidv7 } from "uuid";
import type { BetterAuthPlugin } from "better-auth";
import type { Clock, Deps, GlobalLookups, Mailer, Repos } from "@/application/ports";
import type { Result } from "@/domain/shared/result";
import { withTenantTx, type Db, type Tx } from "./db/db";
import { auditRepository } from "./db/repositories/audit-repository";
import {
  invitationRepository,
  memberRepository,
  restaurantRepository,
} from "./db/repositories/access-repositories";
import { groupRepository } from "./db/repositories/group-repository";
import { itemRepository } from "./db/repositories/item-repository";
import { createAuth, type Auth } from "./auth/auth";
import { betterAuthService } from "./auth/auth-service";
import { cryptoTokens } from "./tokens";

class Rollback<T> extends Error {
  constructor(readonly result: Result<T>) {
    super("rollback");
  }
}

export const systemClock: Clock = { now: () => new Date() };
export const uuidIds = { next: () => uuidv7() };

function repos(tx: Tx, restaurantId: string, clock: Clock): Repos {
  return {
    audit: auditRepository(tx, restaurantId, uuidIds, clock),
    restaurants: restaurantRepository(tx, restaurantId),
    members: memberRepository(tx, restaurantId, uuidIds.next),
    invitations: invitationRepository(tx, restaurantId),
    groups: groupRepository(tx, restaurantId),
    items: itemRepository(tx, restaurantId),
  };
}

function globalLookups(db: Db): GlobalLookups {
  return {
    async membershipForUser(userId) {
      const r = await db.$client.query<{ restaurant_id: string; membership_id: string; active: boolean }>(
        "select * from app_membership_for_user($1)",
        [userId],
      );
      const row = r.rows[0];
      return row
        ? { restaurantId: row.restaurant_id, membershipId: row.membership_id, active: row.active }
        : null;
    },
    async invitationByTokenHash(hash) {
      const r = await db.$client.query<{ restaurant_id: string; invitation_id: string }>(
        "select * from app_invitation_by_token_hash($1)",
        [hash],
      );
      const row = r.rows[0];
      return row ? { restaurantId: row.restaurant_id, invitationId: row.invitation_id } : null;
    },
    async userIdByEmail(email) {
      const r = await db.$client.query<{ id: string }>("select id from users where email = $1", [
        email.trim().toLowerCase(),
      ]);
      return r.rows[0]?.id ?? null;
    },
  };
}

export type DepsConfig = {
  db: Db;
  mailer: Mailer;
  clock?: Clock;
  appUrl: string;
  authSecret: string;
  authPlugins?: BetterAuthPlugin[];
};

export function makeDeps(cfg: DepsConfig): Deps & { betterAuth: Auth } {
  const clock = cfg.clock ?? systemClock;
  const betterAuth = createAuth({
    db: cfg.db,
    mailer: cfg.mailer,
    baseURL: cfg.appUrl,
    secret: cfg.authSecret,
    plugins: cfg.authPlugins,
  });
  return {
    clock,
    ids: uuidIds,
    mailer: cfg.mailer,
    appUrl: cfg.appUrl,
    auth: betterAuthService(betterAuth, cfg.db),
    tokens: cryptoTokens,
    global: globalLookups(cfg.db),
    betterAuth,
    async tenant(restaurantId, fn) {
      try {
        return await withTenantTx(cfg.db, restaurantId, async (tx) => {
          const r = await fn(repos(tx, restaurantId, clock));
          if (!r.ok) throw new Rollback(r);
          return r;
        });
      } catch (e) {
        if (e instanceof Rollback) return e.result;
        throw e;
      }
    },
  };
}
