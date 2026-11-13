import { err, ok, type Result } from "../shared/result";

/** Descrição do produto no cardápio (spec 013, US1.6 e US1.7): texto simples, até 300 caracteres. */
export const MAX_DESCRIPTION = 300;

const unifyBreaks = (text: string) => text.replace(/\r\n?/g, "\n");

/** Conta como o banco (`char_length`): um emoji ou uma letra com acento é um caractere. */
export const descriptionLength = (text: string): number => [...unifyBreaks(text)].length;

/** Tira os espaços das pontas e mantém as quebras de linha; vazio vira `null`. */
export function cleanDescription(text: string | null | undefined): Result<string | null> {
  const clean = unifyBreaks(text ?? "").trim();
  if (clean === "") return ok(null);
  if (descriptionLength(clean) > MAX_DESCRIPTION)
    return err("INVALID_DESCRIPTION", "description", { max: MAX_DESCRIPTION });
  return ok(clean);
}
