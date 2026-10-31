import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function Page({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Criar nova senha</h1>
      <ResetForm token={typeof token === "string" ? token : ""} />
    </>
  );
}
