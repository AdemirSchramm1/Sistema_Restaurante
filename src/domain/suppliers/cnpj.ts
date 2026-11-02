import { err, ok, type Result } from "../shared/result";

/**
 * CNPJ numérico e alfanumérico (Receita Federal, a partir de julho de 2026).
 * Cada caractere vale o código ASCII − 48 (0–9 → 0–9, A–Z → 17–42); pesos e cálculo dos dois
 * dígitos verificadores são os mesmos do CNPJ só de números. Os dois últimos são sempre números.
 */
const SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;
const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, ...W1];

/** Tira pontuação e espaços e põe em maiúsculas. */
export const normalizeCnpj = (text: string) => text.replace(/[\s./-]/g, "").toUpperCase();

function checkDigit(chars: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += (chars.charCodeAt(i) - 48) * weights[i]!;
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

/** Recebe o CNPJ já normalizado (14 caracteres). */
export function isValidCnpj(cnpj: string): boolean {
  if (!SHAPE.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const dv1 = checkDigit(cnpj, W1);
  const dv2 = checkDigit(cnpj.slice(0, 12) + dv1, W2);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

/** Texto do formulário → CNPJ normalizado, ou null se vazio. */
export function parseCnpj(text: string): Result<string | null> {
  const n = normalizeCnpj(text);
  if (!n) return ok(null);
  return isValidCnpj(n) ? ok(n) : err("INVALID_CNPJ", "cnpj");
}

/** "11222333000181" → "11.222.333/0001-81". */
export const formatCnpj = (cnpj: string) =>
  `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
