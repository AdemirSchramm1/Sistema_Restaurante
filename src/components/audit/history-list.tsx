import type { HistoryEntry } from "@/application/audit/get-audit-history";
import { describeChange } from "./field-labels";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criou",
  UPDATE: "Alterou",
  DEACTIVATE: "Inativou",
  REACTIVATE: "Reativou",
  DENIED: "Tentativa negada",
};

export function HistoryList({ entries, timezone }: { entries: HistoryEntry[]; timezone: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="grid gap-3 text-sm" aria-label="Histórico de alterações">
      {entries.map((e, i) => {
        const changes = Object.entries(e.changes ?? {}).filter(
          ([, v]) => Array.isArray(v) && v.length === 2,
        ) as [string, [unknown, unknown]][];
        return (
          <li key={i} className="border-b border-border pb-2 last:border-0">
            <p>
              <strong>{ACTION_LABELS[e.action] ?? e.action}</strong> · {e.userName ?? "sistema"} ·{" "}
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
