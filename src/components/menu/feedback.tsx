/** "Salvo" e erro dos formulários da tela Cardápio: só aparecem com a resposta do servidor. */
export function Saved({ children = "Salvo" }: { children?: React.ReactNode }) {
  return (
    <p
      role="status"
      className="w-fit rounded-md bg-success-soft px-2 py-1 text-sm font-medium text-success-soft-foreground"
    >
      {children}
    </p>
  );
}

export function Problem({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

/**
 * Botão cujo texto pode quebrar em duas linhas (nome comprido, letra em 200%), sem estourar a
 * largura do celular. Continua com pelo menos 44 px de altura.
 */
export const WRAPPING_BUTTON = "h-auto min-h-11 max-w-full whitespace-normal py-2";
