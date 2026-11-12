import { Lock } from "lucide-react";

/** Tela de quem entrou num endereço que o seu papel não vê (spec 009: garçom no estoque). */
export function NoAccess() {
  return (
    <div className="grid max-w-md justify-items-start gap-3 py-10">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"
      >
        <Lock className="size-5" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Sem acesso</h1>
      <p className="text-sm text-muted-foreground">
        Seu papel não permite ver esta tela. Escolha outra no menu ou fale com o gerente.
      </p>
    </div>
  );
}
