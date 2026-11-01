"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/actions/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, fieldError } from "@/components/forms/form-error";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, null);
  const error = state && !state.ok ? state.error : null;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <FormError error={error} />
      <Field label="Seu nome" htmlFor="name" error={fieldError(error, "name")}>
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
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
        {pending ? "Entrando…" : "Aceitar convite"}
      </Button>
    </form>
  );
}
