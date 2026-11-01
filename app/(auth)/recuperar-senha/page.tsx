"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { Field } from "@/components/forms/form-error";

export default function Page() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  return (
    <>
      <h1 className="text-2xl font-semibold">Recuperar senha</h1>
      {state?.ok ? (
        <Alert tone="info">
          Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.
        </Alert>
      ) : (
        <form action={action} className="grid gap-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Button type="submit" disabled={pending}>
            Enviar link
          </Button>
        </form>
      )}
      <Link className="text-sm text-primary underline underline-offset-4" href="/entrar">
        Voltar para entrar
      </Link>
    </>
  );
}
