import type { HistoryEntry } from "@/application/audit/get-audit-history";
import { describeChange } from "./field-labels";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criou",
  UPDATE: "Alterou",
  DEACTIVATE: "Inativou",
  REACTIVATE: "Reativou",
  DENIED: "Tentativa negada",
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

function label(e: HistoryEntry): string {
  const event = e.changes?.event;
  if (event === "menu.photo.set") {
    const before = (e.changes!.photo as unknown[])[0];
    return before ? "Trocou a foto do cardápio" : "Pôs foto no cardápio";
  }
  return (typeof event === "string" && MENU_EVENT_LABELS[event]) || (ACTION_LABELS[e.action] ?? e.action);
}

/** O endereço do arquivo da foto não diz nada a quem lê o histórico. */
const HIDDEN = new Set(["photo"]);

export function HistoryList({ entries, timezone }: { entries: HistoryEntry[]; timezone: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="grid gap-3 text-sm" aria-label="Histórico de alterações">
      {entries.map((e, i) => {
        const changes = Object.entries(e.changes ?? {}).filter(
          ([field, v]) => Array.isArray(v) && v.length === 2 && !HIDDEN.has(field),
        ) as [string, [unknown, unknown]][];
        return (
          <li key={i} className="border-b border-border pb-2 last:border-0">
            <p>
              <strong>{label(e)}</strong> · {e.userName ?? "sistema"} ·{" "}
              {e.occurredAt.toLocaleString("pt-BR", { timeZone: timezone })}
            </p>
            {e.action === "UPDATE" && changes.length > 0 && (
              <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {changes.map(([field, [before, after]]) => (
                  <li key={field}>{describeChange(field, before, after)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
