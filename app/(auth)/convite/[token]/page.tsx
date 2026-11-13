import type { Metadata } from "next";
import { serverDeps } from "@/infra/server";
import { peekInvitation } from "@/application/access/accept-invitation";
import { messageFor } from "@/components/forms/error-messages";
import { Alert } from "@/components/ui/alert";
import { AcceptForm } from "./accept-form";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function Page({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const inv = await peekInvitation(serverDeps(), token);
  if (!inv.ok)
    return (
      <>
        <PageHeader title="Convite" />
        <Alert>{messageFor(inv.error)}</Alert>
        <TextLink href="/entrar" className="text-sm">
          Ir para o login
        </TextLink>
      </>
    );
  return (
    <>
      <PageHeader
        title={`Entrar na equipe do ${inv.value.restaurantName}`}
        description={`Defina seu nome e uma senha para ${inv.value.email}.`}
      />
      <AcceptForm token={token} email={inv.value.email} />
    </>
  );
}
