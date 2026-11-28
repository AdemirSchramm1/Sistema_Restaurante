/**
 * O que o pedido de acerto pendente oferece a quem olha (spec 004, US3; spec 019, US2): o gerente
 * decide o pedido dos outros, e o próprio só com o modo operação pequena ligado; quem pediu cancela.
 */
export function adjustmentActions(p: { canApprove: boolean; own: boolean; smallOperation: boolean }): {
  decide: boolean;
  cancel: boolean;
  hint: string | null;
} {
  if (!p.own) return { decide: p.canApprove, cancel: false, hint: null };
  if (p.canApprove && p.smallOperation)
    return {
      decide: true,
      cancel: true,
      hint: "Operação pequena: se você aprovar, fica marcado como exceção.",
    };
  return {
    decide: false,
    cancel: true,
    hint: p.canApprove ? "Outro gerente precisa aprovar." : "Um gerente precisa aprovar.",
  };
}
