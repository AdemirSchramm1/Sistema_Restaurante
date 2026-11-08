/** Tela de quem entrou num endereço que o seu papel não vê (spec 009: garçom no estoque). */
export function NoAccess() {
  return (
    <div className="grid max-w-md gap-2 py-8">
      <h1 className="text-2xl font-semibold">Sem acesso</h1>
      <p className="text-sm text-muted-foreground">
        Seu papel não permite ver esta tela. Use o menu acima ou fale com o gerente.
      </p>
    </div>
  );
}
