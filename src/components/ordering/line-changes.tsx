/**
 * Mudanças pedidas pelo cliente, embaixo do produto (spec 010, US4). "SEM" vai em maiúsculas e em
 * negrito, e as linhas têm sinal (+ ou SEM): o destaque não depende só de cor.
 */
export function LineChanges({ changes }: { changes: readonly string[] }) {
  if (!changes.length) return null;
  return (
    <ul className="ml-4 grid gap-0.5 text-sm">
      {changes.map((c) =>
        c.startsWith("SEM ") ? (
          <li key={c} className="text-destructive">
            <strong>SEM</strong>
            {c.slice(3)}
          </li>
        ) : (
          <li key={c}>{c}</li>
        ),
      )}
    </ul>
  );
}

/**
 * Observação para a cozinha (spec 015, FR-018): em destaque, com a palavra "Obs." na frente, para
 * não depender só de cor.
 */
export function KitchenNote({ note }: { note: string | null | undefined }) {
  if (!note) return null;
  return (
    <p className="ml-4 text-sm font-semibold text-warning-soft-foreground [overflow-wrap:anywhere]">
      <span className="rounded bg-warning-soft px-1">Obs.:</span> {note}
    </p>
  );
}
