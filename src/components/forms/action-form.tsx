"use client";

import type { ActionState } from "@/actions/_session";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormError } from "./form-error";
import { useFormAction } from "./use-form-action";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Formulário curto ligado a uma Server Action, com botão e mensagem de erro. */
export function ActionForm({
  action,
  hidden = {},
  submitLabel,
  variant = "outline",
  successMessage,
  className,
  children,
  ...rest
}: {
  action: Action;
  hidden?: Record<string, string | number>;
  submitLabel: string;
  variant?: ButtonProps["variant"];
  successMessage?: string;
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
}) {
  const { state, pending, formProps } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form
      {...formProps}
      className={className ?? "flex flex-wrap items-end gap-2"}
      aria-label={rest["aria-label"]}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {submitLabel}
      </Button>
      {state?.ok && successMessage && (
        <p role="status" className="text-sm">
          {successMessage}
        </p>
      )}
      {state && !state.ok && (
        <div className="basis-full">
          <FormError error={state.error} />
        </div>
      )}
    </form>
  );
}
