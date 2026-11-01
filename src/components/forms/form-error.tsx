import { Alert } from "@/components/ui/card";
import type { ActionError } from "@/actions/_session";

export function FormError({ error }: { error?: ActionError | null }) {
  if (!error) return null;
  return <Alert>{error.message}</Alert>;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Mensagem do erro quando ele se refere ao campo dado. */
export const fieldError = (error: ActionError | undefined | null, field: string) =>
  error?.field === field ? error.message : null;
