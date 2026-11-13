import { BrandMark } from "@/components/layout/brand";
import { TextLink } from "@/components/ui/text-link";

/** Página 404 em português. Também aparece quando o registro é de outro restaurante. */
export function NotFoundMessage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-4 px-4 py-16 text-center">
      <BrandMark className="size-12 rounded-2xl" />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Registro não encontrado</h1>
      <p className="text-sm text-muted-foreground">
        O endereço não existe ou o registro não pertence ao seu restaurante.
      </p>
      <TextLink href="/estoque/itens">Voltar para os itens</TextLink>
    </main>
  );
}
