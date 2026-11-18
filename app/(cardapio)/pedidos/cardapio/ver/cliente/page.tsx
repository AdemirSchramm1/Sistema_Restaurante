import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { getMenuPreview } from "@/application/menu/preview";
import { messageFor } from "@/components/forms/error-messages";
import { MenuApp } from "@/components/ordering/menu-app";
import { TabletPreview } from "@/components/ordering/tablet-preview";

export const metadata: Metadata = { title: "Pré-visualização do cardápio" };
export const dynamic = "force-dynamic";

/**
 * O cardápio do cliente em modo pré-visualização (spec 013, US5): é o conteúdo da moldura de "Ver
 * como o cliente" e também abre sozinho, em tela cheia. Fica fora do casco da equipe para ter a
 * mesma largura e as mesmas colunas que o cliente vê. Com `?modo=tablet`, como o tablet da mesa.
 */
export default async function Page({ searchParams }: PageProps<"/pedidos/cardapio/ver/cliente">) {
  const ctx = await requireContext();
  // `?modo=tablet`: como o tablet da mesa, com as boas-vindas (spec 016).
  const tablet = (await searchParams).modo === "tablet";
  const menu = await getMenuPreview(serverDeps(), ctx);
  if (!menu.ok)
    return (
      <p role="alert" className="grid min-h-[60vh] place-items-center text-center text-lg">
        {messageFor(menu.error)}
      </p>
    );
  return (
    <>
      {/* Sem a barra de rolagem ocupando largura, a moldura de 1024 px tem 1024 px de conteúdo, como
          num tablet (onde a barra flutua). A rolagem continua funcionando. */}
      <style>{"html { scrollbar-width: none; }"}</style>
      {tablet ? <TabletPreview menu={menu.value} /> : <MenuApp preview menu={menu.value} />}
    </>
  );
}
