/** Forma usada para comparar descrições: sem acentos, minúsculas, espaços simples (FR-019). */
export function normalizeDescription(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
