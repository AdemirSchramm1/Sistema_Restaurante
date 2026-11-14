/** Dados de teste da edição do cardápio (spec 013). */
export const SECTION_NAMES = ["Entradas", "Lanches", "Bebidas"] as const;

/** Texto com exatamente `n` caracteres, para os limites de 40 (seção) e 300 (descrição). */
export const textOf = (n: number, letter = "a") => letter.repeat(n);

/**
 * Nome do restaurante nos testes de tela: sempre o mesmo, para a imagem de referência não mudar a
 * cada preparo dos dados, e com uma palavra comprida sem espaço (16 letras), que é o pior caso do
 * nome em maiúsculas no topo do cardápio em 320 px com a letra em 200%.
 */
export const RESTAURANT_NAME = "Cantina Saporedellanonna";

export const LONG_NAME = "X-Burger duplo com bacon crocante, cheddar, cebola caramelizada e molho"; // 70
export const LONG_DESCRIPTION = (
  "Pão brioche, dois hambúrgueres de 150 g, cheddar derretido, bacon crocante e cebola caramelizada. " +
  "Acompanha batata frita e molho da casa. Feito na hora, com carne moída todos os dias. "
)
  .repeat(2)
  .slice(0, 300);
