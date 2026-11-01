import Link from "next/link";

/** Página 404 em português. Também aparece quando o registro é de outro restaurante. */
export function NotFoundMessage() {
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Registro não encontrado</h1>
      <p className="text-sm text-muted-foreground">
        O endereço não existe ou o registro não pertence ao seu restaurante.
      </p>
      <Link href="/estoque/itens" className="text-primary underline underline-offset-4">
        Voltar para os itens
      </Link>
    </main>
  );
}
