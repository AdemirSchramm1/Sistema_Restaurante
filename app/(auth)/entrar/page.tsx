import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";
import { Alert } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Entrar" };

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Entrar" description="Use o e-mail e a senha da sua conta." />
      {sp["senha-redefinida"] && <Alert tone="success">Senha redefinida. Entre com a nova senha.</Alert>}
      <SignInForm />
      <div className="flex justify-between text-sm">
        <TextLink href="/recuperar-senha">Esqueci a senha</TextLink>
        <TextLink href="/criar-conta">Criar conta do restaurante</TextLink>
      </div>
    </>
  );
}
