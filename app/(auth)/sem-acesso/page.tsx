import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sem acesso a um restaurante</h1>
      <p className="text-sm text-muted-foreground">
        Seu login não está ligado a nenhum restaurante ativo. Peça um convite ao gerente.
      </p>
      <form action={signOutAction}>
        <Button variant="outline" type="submit">
          Sair
        </Button>
      </form>
    </>
  );
}
