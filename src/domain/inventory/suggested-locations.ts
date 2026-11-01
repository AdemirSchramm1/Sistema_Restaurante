import type { LocationData } from "./location";

/** Locais oferecidos no primeiro acesso (docs/produto/estoque/05-locais.md). */
export const SUGGESTED_LOCATIONS: readonly (LocationData & { key: string; purpose: string })[] = [
  {
    key: "dry",
    name: "Despensa seca",
    kind: "DRY",
    purpose: "Arroz, feijão, enlatados, bebidas fora da geladeira",
  },
  { key: "chilled", name: "Geladeira", kind: "CHILLED", purpose: "Carnes, frios, laticínios, verduras" },
  { key: "frozen", name: "Freezer", kind: "FROZEN", purpose: "Congelados" },
  { key: "bar", name: "Bar", kind: "BAR", purpose: "Bebidas" },
  { key: "cleaning", name: "Armário de limpeza", kind: "CHEMICALS", purpose: "Produtos de limpeza" },
  {
    key: "nonfood",
    name: "Depósito de descartáveis",
    kind: "NON_FOOD",
    purpose: "Embalagens, guardanapos, copos",
  },
];
