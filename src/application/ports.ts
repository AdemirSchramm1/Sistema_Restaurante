import type { Result } from "@/domain/shared/result";
import type { FieldChanges } from "@/domain/shared/audit";
import type { Role } from "@/domain/access/permissions";
import type { Origin } from "./context";
import type { AccessRepos } from "./access/ports";
import type { CatalogRepos } from "./inventory/ports";
import type { SupplierRepos } from "./suppliers/ports";
import type { OrderingRepos } from "./ordering/ports";
import type { BillingRepos } from "./billing/ports";
import type { MenuRepos, PhotoProcessor, PhotoStorage } from "./menu/ports";

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export type MailMessage = { to: string; subject: string; text: string };
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Token secreto de link (convite). Só o hash vai para o banco. */
export interface TokenService {
  create(): { token: string; hash: string };
  hash(token: string): string;
}

/** Desenho do QR code da mesa (spec 009). */
export interface QrRenderer {
  svg(url: string): Promise<string>;
}

/** Criação de login (Better Auth em produção). */
export interface AuthService {
  createUser(input: { email: string; password: string; name: string }): Promise<Result<{ userId: string }>>;
  deleteUser(userId: string): Promise<void>;
}

export type AuditAction = "CREATE" | "UPDATE" | "DEACTIVATE" | "REACTIVATE" | "DENIED";
export type AuditEntry = {
  entity: string;
  entityId: string | null;
  action: AuditAction;
  changes: FieldChanges | Record<string, unknown>;
  userId: string | null;
  origin: Origin;
};

export interface AuditRepo {
  record(entry: AuditEntry): Promise<void>;
  history(
    entity: string,
    entityId: string,
  ): Promise<(AuditEntry & { occurredAt: Date; userName: string | null })[]>;
}

export type Repos = AccessRepos &
  CatalogRepos &
  SupplierRepos &
  OrderingRepos &
  BillingRepos &
  MenuRepos & { audit: AuditRepo };

/** Consultas que atravessam restaurantes antes de saber qual é o do usuário. */
export interface GlobalLookups {
  /** Membro do usuário com os papéis, numa consulta só (spec 012, R4). */
  membershipForUser(
    userId: string,
  ): Promise<{ restaurantId: string; membershipId: string; active: boolean; roles: Role[] } | null>;
  invitationByTokenHash(hash: string): Promise<{ restaurantId: string; invitationId: string } | null>;
  userIdByEmail(email: string): Promise<string | null>;
  /** Mesa pelo token do QR code (spec 009). Devolve só o mínimo. */
  tableByQrToken(token: string): Promise<{ restaurantId: string; tableId: string; active: boolean } | null>;
  /** Acesso ao cardápio pelo hash do cookie (spec 009). */
  menuAccessByTokenHash(hash: string): Promise<{ restaurantId: string; menuAccessId: string } | null>;
}

export type Deps = {
  clock: Clock;
  ids: IdGenerator;
  mailer: Mailer;
  auth: AuthService;
  tokens: TokenService;
  qr: QrRenderer;
  /** Fotos do cardápio (spec 013). */
  photos: { processor: PhotoProcessor; storage: PhotoStorage };
  global: GlobalLookups;
  appUrl: string;
  /** Roda `fn` numa transação do restaurante. Se `fn` devolver erro, a transação é desfeita. */
  tenant<T>(restaurantId: string, fn: (repos: Repos) => Promise<Result<T>>): Promise<Result<T>>;
};
