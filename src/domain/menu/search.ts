import { normalizeDescription } from "../inventory/description";

/** Busca do cardápio da equipe (spec 015, US5-2): sem acento, sem caixa, sem espaços das pontas. */
export const normalizeSearch = (s: string): string => normalizeDescription(s);

/** Acha pelo pedaço do nome; busca vazia acha tudo. */
export const matchesSearch = (name: string, query: string): boolean =>
  normalizeSearch(name).includes(normalizeSearch(query));
