"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, fieldError } from "@/components/forms/form-error";

export function SignUpForm() {
  const { state, pending, formProps } = useFormAction(signUpAction);
  const error = state && !state.ok ? state.error : null;
  return (
    <form {...formProps} className="grid gap-4">
      <FormError error={error} />
      <Field label="Nome do restaurante" htmlFor="restaurantName" error={fieldError(error, "restaurantName")}>
        <Input id="restaurantName" name="restaurantName" required minLength={2} maxLength={120} />
      </Field>
      <Field label="Seu nome" htmlFor="userName" error={fieldError(error, "userName")}>
        <Input id="userName" name="userName" autoComplete="name" required minLength={2} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={fieldError(error, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Senha"
        htmlFor="password"
        hint="Pelo menos 8 caracteres."
        error={fieldError(error, "password")}
      >
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
        {pending ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
