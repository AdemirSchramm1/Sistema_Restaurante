import type { Result } from "@/domain/shared/result";
import type { FieldChanges } from "@/domain/shared/audit";
import type { Origin } from "./context";
import type { AccessRepos } from "./access/ports";
import type { CatalogRepos } from "./inventory/ports";

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

export type Repos = AccessRepos & CatalogRepos & { audit: AuditRepo };

/** Consultas que atravessam restaurantes antes de saber qual é o do usuário. */
export interface GlobalLookups {
  membershipForUser(
    userId: string,
  ): Promise<{ restaurantId: string; membershipId: string; active: boolean } | null>;
  invitationByTokenHash(hash: string): Promise<{ restaurantId: string; invitationId: string } | null>;
  userIdByEmail(email: string): Promise<string | null>;
}

export type Deps = {
  clock: Clock;
  ids: IdGenerator;
  mailer: Mailer;
  auth: AuthService;
  global: GlobalLookups;
  appUrl: string;
  /** Roda `fn` numa transação do restaurante. Se `fn` devolver erro, a transação é desfeita. */
  tenant<T>(restaurantId: string, fn: (repos: Repos) => Promise<Result<T>>): Promise<Result<T>>;
};
