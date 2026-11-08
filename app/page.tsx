import { redirect } from "next/navigation";
import { currentContext } from "@/actions/_session";
import { homeFor } from "@/components/layout/nav";

export default async function Home() {
  const ctx = await currentContext();
  redirect(ctx ? homeFor(ctx.roles) : "/estoque/itens");
}
