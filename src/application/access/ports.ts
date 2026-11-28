import type { Role } from "@/domain/access/permissions";

export type MemberRecord = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  active: boolean;
  roles: Role[];
  version: number;
};

export type InvitationRecord = {
  id: string;
  email: string;
  roles: Role[];
  tokenHash: string;
  expiresAt: Date;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  version: number;
};

export type Audit = { at: Date; by: string | null };

export interface RestaurantRepo {
  create(
    r: { id: string; name: string; timezone: string; nextGroupCode: number },
    audit: Audit,
  ): Promise<void>;
  get(): Promise<{ id: string; name: string; timezone: string } | null>;
  /** Modo operação pequena (spec 019), travado para leitura até o fim da transação (`for share`). */
  smallOperation(): Promise<{ enabled: boolean; version: number }>;
  /** Trava otimista pela versão do restaurante. */
  setSmallOperation(enabled: boolean, version: number, audit: Audit): Promise<boolean>;
}

export interface MemberRepo {
  create(m: { id: string; userId: string; roles: Role[] }, audit: Audit): Promise<void>;
  list(): Promise<MemberRecord[]>;
  get(membershipId: string): Promise<MemberRecord | null>;
  setRoles(membershipId: string, roles: Role[], version: number, audit: Audit): Promise<boolean>;
  setActive(membershipId: string, active: boolean, version: number, audit: Audit): Promise<boolean>;
  isActiveMember(userId: string): Promise<boolean>;
}

export interface InvitationRepo {
  create(i: Omit<InvitationRecord, "version" | "status">, audit: Audit): Promise<void>;
  findPendingByEmail(email: string): Promise<InvitationRecord | null>;
  get(id: string): Promise<InvitationRecord | null>;
  listPending(): Promise<InvitationRecord[]>;
  setStatus(id: string, status: InvitationRecord["status"], version: number, audit: Audit): Promise<boolean>;
}

export type AccessRepos = { restaurants: RestaurantRepo; members: MemberRepo; invitations: InvitationRepo };
