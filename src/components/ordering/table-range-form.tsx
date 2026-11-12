"use client";

import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** "Criar várias mesas" de um número a outro; diz quantas criou e quais já existiam. */
export function TableRangeForm({ action }: { action: Action }) {
  const { state, pending, saved, formProps } = useFormAction(action, { resetOnSuccess: true });
  const done = saved && state?.ok ? (state.data as { created: number; skipped: string[] }) : null;
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2" aria-label="Criar várias mesas">
      <div className="grid gap-1">
        <Label htmlFor="range-from">Da mesa</Label>
        <Input id="range-from" name="from" inputMode="numeric" className="w-24" required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="range-to">até a mesa</Label>
        <Input id="range-to" name="to" inputMode="numeric" className="w-24" required />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Criar várias mesas
      </Button>
      {done && (
        <p role="status" className="basis-full text-sm">
          {done.created === 1 ? "1 mesa criada" : `${done.created} mesas criadas`}
          {done.skipped.length > 0 && `. Já existiam: ${done.skipped.join(", ")}.`}
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
