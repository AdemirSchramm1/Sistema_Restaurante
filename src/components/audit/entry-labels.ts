import type { Origin } from "@/application/context";
import type { AuditAction } from "@/application/ports";
import { OPERATION_TYPE_LABELS, operationTypeOf } from "@/domain/audit/operation-types";
import { describeChange } from "./field-labels";

/**
 * Textos de um registro da trilha, usados pelo histórico de cada registro e pela Auditoria (spec
 * 019, FR-004): um tradutor só.
 */

type Entry = { action: AuditAction; changes: Record<string, unknown> | null };

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Criou",
  UPDATE: "Alterou",
  DEACTIVATE: "Inativou",
  REACTIVATE: "Reativou",
  DENIED: "Tentou sem permissão",
};

/** Mudanças feitas pela tela Cardápio (spec 013): o evento diz mais que a ação. */
const MENU_EVENT_LABELS: Record<string, string> = {
  "menu.details": "Alterou no cardápio",
  "menu.photo.remove": "Tirou a foto do cardápio",
  "menu.product.move": "Mudou a ordem no cardápio",
  "menu.section.create": "Criou a seção",
  "menu.section.rename": "Renomeou a seção",
  "menu.section.move": "Mudou a ordem da seção",
  "menu.section.delete": "Apagou a seção",
};

export function entryLabel(e: Entry): string {
  const event = e.changes?.event;
  if (event === "menu.photo.set") {
    const before = (e.changes!.photo as unknown[])[0];
    return before ? "Trocou a foto do cardápio" : "Pôs foto no cardápio";
  }
  // Ação que este código não conhece (registro antigo) aparece como veio.
  return (typeof event === "string" && MENU_EVENT_LABELS[event]) || (ACTION_LABELS[e.action] ?? e.action);
}

/** O endereço do arquivo da foto não diz nada a quem lê. */
const HIDDEN = new Set(["photo"]);

const pair = (v: unknown): v is [unknown, unknown] => Array.isArray(v) && v.length === 2;

/** "Campo: antes → depois" de cada campo alterado. Só a alteração mostra o que mudou. */
export function changeLines(e: Entry): string[] {
  if (e.action !== "UPDATE") return [];
  return Object.entries(e.changes ?? {})
    .filter(([field, v]) => pair(v) && !HIDDEN.has(field))
    .map(([field, v]) => {
      const [before, after] = v as [unknown, unknown];
      return describeChange(field, before, after);
    });
}

/** Nome do registro, quando a trilha o guardou nas mudanças (o mais novo). */
export function recordName(changes: Record<string, unknown> | null): string | null {
  for (const field of ["name", "description"]) {
    const v = changes?.[field];
    if (!pair(v)) continue;
    const name = v[1] ?? v[0];
    return typeof name === "string" ? name : null;
  }
  return null;
}

/** Quem fez: a pessoa; sem pessoa, o cliente pelo QR code (vem da web) ou o próprio sistema. */
export const whoDid = (e: { userName: string | null; origin: Origin }): string =>
  e.userName ?? (e.origin.channel === "web" ? "Cliente pelo QR code" : "Sistema");

const SCREENS: Record<string, string> = {
  item: "/estoque/itens/",
  recipe: "/estoque/produtos/",
  supplier: "/estoque/fornecedores/",
  addon: "/pedidos/adicionais/",
  order: "/pedidos/",
  table_tab: "/caixa/",
  cash_session: "/caixa/turnos/",
};

/** Tipo de operação da entidade; entidade que o código ainda não conhece aparece como veio. */
export function operationLabel(entity: string): string {
  const type = operationTypeOf(entity);
  return type ? OPERATION_TYPE_LABELS[type] : entity;
}

/** Endereço da tela do registro, quando ele tem uma. */
export function recordHref(entity: string, entityId: string | null): string | null {
  const base = SCREENS[entity];
  return base && entityId ? base + entityId : null;
}
