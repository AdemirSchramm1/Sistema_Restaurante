"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/forms/form-error";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  return (
    <>
      <PageHeader title="Recuperar senha" description="Mandamos um link para você criar uma senha nova." />
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
      <TextLink href="/entrar" className="text-sm">
        Voltar para entrar
      </TextLink>
    </>
  );
}
