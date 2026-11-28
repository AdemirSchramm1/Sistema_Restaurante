import type { Result } from "@/domain/shared/result";
import type { FieldChanges } from "@/domain/shared/audit";
import type { Role } from "@/domain/access/permissions";
import type { MenuAccessKind } from "@/domain/ordering/menu-access";
import type { Origin } from "./context";
import type { AccessRepos, Audit } from "./access/ports";
import type { Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { CatalogRepos } from "./inventory/ports";
import type { SupplierRepos } from "./suppliers/ports";
import type { OrderingRepos } from "./ordering/ports";
import type { BillingRepos } from "./billing/ports";
import type { CashRepos } from "./cash/ports";
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
  /** Relatório de auditoria (spec 019): dias locais no fuso do restaurante, mais novo primeiro. */
  search(f: AuditSearch): Promise<{ total: number; rows: AuditRow[] }>;
}

export type AuditSearch = {
  fromDay: string;
  toDay: string;
  userId: string | null;
  entities: readonly string[] | null;
  deniedOnly: boolean;
  /** Sem limite: a planilha leva o período inteiro. */
  limit: number | null;
  offset: number;
};

export type AuditRow = AuditEntry & { id: string; occurredAt: Date; userName: string | null };

/** Exceção da operação pequena: acerto aprovado por quem pediu (spec 019, US3). */
export type ExceptionRow = {
  requestId: string;
  decidedAt: Date;
  /** Quem pediu e aprovou (a exceção sempre tem pessoa). */
  decidedByName: string;
  itemId: string;
  itemName: string;
  stockUnit: UnitCode;
  difference: Decimal;
  /** Valor do lançamento do acerto (quantidade × custo médio). */
  value: Decimal;
  reasonId: string;
  notes: string | null;
  /** Saldo do item agora. */
  balance: Decimal;
};

export type WeekReviewRecord = { reviewedByName: string | null; reviewedAt: Date; note: string | null };

export interface ExceptionReviewRepo {
  /** Semanas (segundas) com exceção, antes de `beforeWeek` e sem revisão, da mais antiga. */
  pendingWeeks(beforeWeek: string): Promise<string[]>;
  weekExceptions(weekStart: string): Promise<ExceptionRow[]>;
  review(weekStart: string): Promise<WeekReviewRecord | null>;
  /** Falso se a semana já tinha revisão (índice único). */
  insert(r: { id: string; weekStart: string; note: string | null }, audit: Audit): Promise<boolean>;
}

export type Repos = AccessRepos &
  CatalogRepos &
  SupplierRepos &
  OrderingRepos &
  BillingRepos &
  CashRepos &
  MenuRepos & { audit: AuditRepo; exceptionReviews: ExceptionReviewRepo };

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
  menuAccessByTokenHash(
    hash: string,
  ): Promise<{ restaurantId: string; menuAccessId: string; kind: MenuAccessKind } | null>;
  /** Restaurante e mesa pelo link do tablet (spec 016). */
  tableByTabletToken(
    token: string,
  ): Promise<{ restaurantId: string; tableId: string; active: boolean } | null>;
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
