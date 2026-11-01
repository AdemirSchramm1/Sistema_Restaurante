"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { resetPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-error";

export function ResetForm({ token }: { token: string }) {
  const { state, pending, formProps } = useFormAction(resetPasswordAction);
  return (
    <form {...formProps} className="grid gap-4">
      <FormError error={state && !state.ok ? state.error : null} />
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" htmlFor="password" hint="Pelo menos 8 caracteres.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        Salvar senha
      </Button>
    </form>
  );
}
