import Link from "next/link";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";
import { Alert } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {sp["senha-redefinida"] && <Alert tone="success">Senha redefinida. Entre com a nova senha.</Alert>}
      <SignInForm />
      <div className="flex justify-between text-sm">
        <Link className="text-primary hover:underline" href="/recuperar-senha">
          Esqueci a senha
        </Link>
        <Link className="text-primary hover:underline" href="/criar-conta">
          Criar conta do restaurante
        </Link>
      </div>
    </>
  );
}
