/**
 * Texto que veio de um formulário ou de JSON (spec 012, FR-011): sem espaços nas pontas; o que não
 * é texto vira "" e a validação de cada caso de uso decide se pode ficar vazio.
 */
export const formText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
