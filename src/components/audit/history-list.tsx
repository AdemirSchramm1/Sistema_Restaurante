import type { HistoryEntry } from "@/application/audit/get-audit-history";
import { changeLines, entryLabel } from "./entry-labels";

export function HistoryList({ entries, timezone }: { entries: HistoryEntry[]; timezone: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="grid gap-3 text-sm" aria-label="Histórico de alterações">
      {entries.map((e, i) => {
        const changes = changeLines(e);
        return (
          <li key={i} className="border-b border-border pb-2 last:border-0">
            <p>
              <strong>{entryLabel(e)}</strong> · {e.userName ?? "sistema"} ·{" "}
              {e.occurredAt.toLocaleString("pt-BR", { timeZone: timezone })}
            </p>
            {changes.length > 0 && (
              <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
