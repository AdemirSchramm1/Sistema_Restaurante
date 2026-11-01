/** Lista fechada do anexo da RDC Anvisa 26/2015 (research R13). */
export const ALLERGEN_LABELS = {
  WHEAT_GLUTEN_CEREALS: "Trigo, centeio, cevada, aveia e suas estirpes hibridizadas",
  CRUSTACEANS: "Crustáceos",
  EGGS: "Ovos",
  FISH: "Peixes",
  PEANUT: "Amendoim",
  SOY: "Soja",
  MILK: "Leites de todas as espécies de mamíferos",
  ALMOND: "Amêndoa",
  HAZELNUT: "Avelãs",
  CASHEW: "Castanha-de-caju",
  BRAZIL_NUT: "Castanha-do-brasil ou castanha-do-pará",
  MACADAMIA: "Macadâmias",
  WALNUT: "Nozes",
  PECAN: "Pecãs",
  PISTACHIO: "Pistaches",
  PINE_NUT: "Pinoli",
  CHESTNUT: "Castanhas",
  NATURAL_LATEX: "Látex natural",
} as const;

export type Allergen = keyof typeof ALLERGEN_LABELS;
export const ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];
export const isAllergen = (v: string): v is Allergen => v in ALLERGEN_LABELS;
