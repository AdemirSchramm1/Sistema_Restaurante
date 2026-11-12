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
