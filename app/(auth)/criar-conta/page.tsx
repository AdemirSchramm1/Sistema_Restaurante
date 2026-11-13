import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Criar conta do restaurante"
        description="Você entra como gerente e depois convida a equipe."
      />
      <SignUpForm />
      <p className="text-sm">
        Já tem conta? <TextLink href="/entrar">Entrar</TextLink>
      </p>
    </>
  );
}
