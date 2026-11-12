import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Sem acesso a um restaurante"
        description="Seu login não está ligado a nenhum restaurante ativo. Peça um convite ao gerente."
      />
      <form action={signOutAction}>
        <Button variant="outline" type="submit">
          Sair
        </Button>
      </form>
    </>
  );
}
