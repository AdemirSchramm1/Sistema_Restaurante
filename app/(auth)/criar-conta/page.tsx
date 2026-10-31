import Link from "next/link";
import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Criar conta do restaurante</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você entra como gerente e depois convida a equipe.
        </p>
      </div>
      <SignUpForm />
      <p className="text-sm">
        Já tem conta?{" "}
        <Link className="text-primary hover:underline" href="/entrar">
          Entrar
        </Link>
      </p>
    </>
  );
}
