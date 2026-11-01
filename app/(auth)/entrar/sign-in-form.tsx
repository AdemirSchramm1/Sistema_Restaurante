"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { signInAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-error";

export function SignInForm() {
  const { state, pending, formProps } = useFormAction(signInAction);
  return (
    <form {...formProps} className="grid gap-4">
      <FormError error={state && !state.ok ? state.error : null} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
