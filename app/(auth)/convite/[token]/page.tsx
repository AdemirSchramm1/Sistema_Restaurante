import Link from "next/link";
import type { Metadata } from "next";
import { serverDeps } from "@/infra/server";
import { peekInvitation } from "@/application/access/accept-invitation";
import { messageFor } from "@/components/forms/error-messages";
import { Alert } from "@/components/ui/card";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function Page({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const inv = await peekInvitation(serverDeps(), token);
  if (!inv.ok)
    return (
      <>
        <h1 className="text-2xl font-semibold">Convite</h1>
        <Alert>{messageFor(inv.error)}</Alert>
        <Link className="text-sm text-primary underline underline-offset-4" href="/entrar">
          Ir para o login
        </Link>
      </>
    );
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Entrar na equipe do {inv.value.restaurantName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina seu nome e uma senha para {inv.value.email}.
        </p>
      </div>
      <AcceptForm token={token} email={inv.value.email} />
    </>
  );
}
