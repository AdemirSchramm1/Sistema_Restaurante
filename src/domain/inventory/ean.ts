const LENGTHS = [8, 12, 13, 14];

/** GTIN-8/12/13/14 com dígito verificador (módulo 10, pesos 3 e 1 a partir da direita). */
export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || !LENGTHS.includes(value.length)) return false;
  const digits = [...value].map((c) => c.charCodeAt(0) - 48);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
