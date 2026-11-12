import type { Metadata } from "next";
import { ResetForm } from "./reset-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Nova senha" };

export default async function Page({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token } = await searchParams;
  return (
    <>
      <PageHeader title="Criar nova senha" />
      <ResetForm token={typeof token === "string" ? token : ""} />
    </>
  );
}
