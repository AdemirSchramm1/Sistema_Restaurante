import type { Metadata } from "next";
import { ResetForm } from "./reset-form";
import { PageHeader } from "@/components/layout/page-header";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nova senha" };

export default async function Page({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token } = await searchParams;
  return (
    <>
      <PageHeader title="Criar nova senha" />
      <ResetForm token={firstParam(token) ?? ""} />
    </>
  );
}
