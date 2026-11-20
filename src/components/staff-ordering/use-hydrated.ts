import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` no servidor e na primeira pintura, `true` depois: o que vem do aparelho (carrinho,
 * modo Fotos/Lista) só é lido no navegador, sem desencontro entre servidor e tela.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
