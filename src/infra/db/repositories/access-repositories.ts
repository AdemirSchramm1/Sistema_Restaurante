import { and, asc, eq, inArray } from "drizzle-orm";
import type { InvitationRepo, MemberRepo, RestaurantRepo, MemberRecord } from "@/application/access/ports";
import type { Role } from "@/domain/access/permissions";
import type { Tx } from "../db";
import { invitations, membershipRoles, memberships, restaurants, users } from "../schema";

export function restaurantRepository(tx: Tx, restaurantId: string): RestaurantRepo {
  return {
    async create(r, audit) {
      await tx.insert(restaurants).values({
        id: r.id,
        name: r.name,
        timezone: r.timezone,
        nextGroupCode: r.nextGroupCode,
        createdAt: audit.at,
        createdBy: audit.by,
        updatedAt: audit.at,
        updatedBy: audit.by,
      });
    },
    async get() {
      const [row] = await tx
        .select({ id: restaurants.id, name: restaurants.name, timezone: restaurants.timezone })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      return row ?? null;
    },
  };
}

export function memberRepository(tx: Tx, restaurantId: string, ids: () => string): MemberRepo {
  async function load(where?: ReturnType<typeof eq>): Promise<MemberRecord[]> {
    const rows = await tx
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        active: memberships.active,
        version: memberships.version,
        name: users.name,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(where)
      .orderBy(asc(users.name));
    if (rows.length === 0) return [];
    const roleRows = await tx
      .select({ membershipId: membershipRoles.membershipId, role: membershipRoles.role })
      .from(membershipRoles)
      .where(
        inArray(
          membershipRoles.membershipId,
          rows.map((r) => r.membershipId),
        ),
      );
    return rows.map((r) => ({
      ...r,
      roles: roleRows.filter((x) => x.membershipId === r.membershipId).map((x) => x.role as Role),
    }));
  }

  async function writeRoles(membershipId: string, roles: Role[], at: Date, by: string | null) {
    await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId));
    if (roles.length)
      await tx.insert(membershipRoles).values(
        roles.map((role) => ({
          id: ids(),
          restaurantId,
          membershipId,
          role,
          createdAt: at,
          createdBy: by,
        })),
      );
  }

  return {
    async create(m, audit) {
      await tx.insert(memberships).values({
        id: m.id,
        restaurantId,
        userId: m.userId,
        createdAt: audit.at,
        createdBy: audit.by,
        updatedAt: audit.at,
        updatedBy: audit.by,
      });
      await writeRoles(m.id, m.roles, audit.at, audit.by);
    },
    list: () => load(),
    async get(membershipId) {
      return (await load(eq(memberships.id, membershipId)))[0] ?? null;
    },
    async setRoles(membershipId, roles, version, audit) {
      const r = await tx
        .update(memberships)
        .set({ version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(memberships.id, membershipId), eq(memberships.version, version)))
        .returning({ id: memberships.id });
      if (r.length === 0) return false;
      await writeRoles(membershipId, roles, audit.at, audit.by);
      return true;
    },
    async setActive(membershipId, active, version, audit) {
      const r = await tx
        .update(memberships)
        .set({ active, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(memberships.id, membershipId), eq(memberships.version, version)))
        .returning({ id: memberships.id });
      return r.length > 0;
    },
    async isActiveMember(userId) {
      const r = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.active, true)));
      return r.length > 0;
    },
  };
}

export function invitationRepository(tx: Tx, restaurantId: string): InvitationRepo {
  const cols = {
    id: invitations.id,
    email: invitations.email,
    roles: invitations.roles,
    tokenHash: invitations.tokenHash,
    expiresAt: invitations.expiresAt,
    status: invitations.status,
    version: invitations.version,
  };
  return {
    async create(i, audit) {
      await tx.insert(invitations).values({
        ...i,
        restaurantId,
        createdAt: audit.at,
        createdBy: audit.by,
        updatedAt: audit.at,
        updatedBy: audit.by,
      });
    },
    async findPendingByEmail(email) {
      const [row] = await tx
        .select(cols)
        .from(invitations)
        .where(and(eq(invitations.email, email), eq(invitations.status, "PENDING")));
      return row ? { ...row, roles: row.roles as Role[] } : null;
    },
    async get(id) {
      const [row] = await tx.select(cols).from(invitations).where(eq(invitations.id, id));
      return row ? { ...row, roles: row.roles as Role[] } : null;
    },
    async listPending() {
      const rows = await tx
        .select(cols)
        .from(invitations)
        .where(eq(invitations.status, "PENDING"))
        .orderBy(asc(invitations.createdAt));
      return rows.map((r) => ({ ...r, roles: r.roles as Role[] }));
    },
    async setStatus(id, status, version, audit) {
      const r = await tx
        .update(invitations)
        .set({ status, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(invitations.id, id), eq(invitations.version, version)))
        .returning({ id: invitations.id });
      return r.length > 0;
    },
  };
}
