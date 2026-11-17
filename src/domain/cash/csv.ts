import { isDecimal, type Decimal } from "../shared/decimal";

/** Planilha (CSV) que o Excel em português abre direto em colunas (spec 014, research R8). */

export type CsvCell = string | number | Decimal;

const BOM = "﻿";
const FORMULA_START = /^[=+\-@]/;
const NEEDS_QUOTES = /[";\r\n]/;

/** Texto: sem virar fórmula (apóstrofo na frente) e entre aspas quando tem aspas, `;` ou quebra. */
function text(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Dinheiro (`Decimal`) sai com vírgula e 2 casas; número inteiro sai como está. */
const cell = (value: CsvCell): string =>
  isDecimal(value)
    ? value.toFixed(2).replace(".", ",")
    : typeof value === "number"
      ? String(value)
      : text(value);

/** Separador `;`, quebra `\r\n` e BOM no começo (acentos certos no Excel). */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return BOM + rows.map((r) => `${r.map(cell).join(";")}\r\n`).join("");
}
