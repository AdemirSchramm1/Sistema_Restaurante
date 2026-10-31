export type StorageClass = "FOOD" | "CHEMICAL" | "OTHER_NON_FOOD";

export const STORAGE_CLASS_LABELS: Record<StorageClass, string> = {
  FOOD: "Alimentar",
  CHEMICAL: "Químico (limpeza)",
  OTHER_NON_FOOD: "Não alimentar",
};

export type DefaultGroup = {
  code: string;
  name: string;
  storageClass: StorageClass;
  inCogs: boolean;
  subgroups: { code: string; name: string }[];
};

const sub = (...names: string[]) => names.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name }));

/** Árvore padrão do doc 01. Criada para cada restaurante novo; grupos padrão não podem ser apagados. */
export const DEFAULT_GROUP_TREE: readonly DefaultGroup[] = [
  {
    code: "01",
    name: "Hortifrúti (FLV)",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Folhosas", "Legumes", "Frutas", "Ervas"),
  },
  {
    code: "02",
    name: "Carnes e aves",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Bovinos", "Suínos", "Aves", "Embutidos"),
  },
  {
    code: "03",
    name: "Pescados e frutos do mar",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Peixes", "Crustáceos", "Moluscos"),
  },
  {
    code: "04",
    name: "Laticínios, frios e ovos",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Queijos", "Creme e manteiga", "Frios fatiados", "Ovos"),
  },
  {
    code: "05",
    name: "Congelados",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Proteínas congeladas", "Batata pré-frita", "Polpas", "Sorvetes"),
  },
  {
    code: "06",
    name: "Secos e mercearia",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Grãos", "Farinhas", "Massas", "Açúcares", "Enlatados", "Óleos", "Temperos", "Molhos"),
  },
  {
    code: "07",
    name: "Padaria",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Pães", "Massas prontas"),
  },
  {
    code: "08",
    name: "Bebidas",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Não alcoólicas", "Cervejas", "Chope", "Vinhos", "Destilados", "Insumos de bar"),
  },
  {
    code: "09",
    name: "Produção própria",
    storageClass: "FOOD",
    inCogs: true,
    subgroups: sub("Fundos", "Molhos", "Bases", "Porcionados", "Sobremesas"),
  },
  {
    code: "10",
    name: "Embalagens de delivery",
    storageClass: "OTHER_NON_FOOD",
    inCogs: true,
    subgroups: sub("Potes", "Sacolas", "Talheres descartáveis"),
  },
  {
    code: "11",
    name: "Descartáveis de produção",
    storageClass: "OTHER_NON_FOOD",
    inCogs: false,
    subgroups: sub("Filmes e papel-alumínio", "Luvas", "Toucas"),
  },
  {
    code: "12",
    name: "Higiene e limpeza",
    storageClass: "CHEMICAL",
    inCogs: false,
    subgroups: sub("Sanitizantes", "Detergentes", "Insumos de lava-louças"),
  },
  {
    code: "13",
    name: "EPIs, uniformes, utensílios, louças, enxoval, escritório, manutenção",
    storageClass: "OTHER_NON_FOOD",
    inCogs: false,
    subgroups: sub("EPIs", "Uniformes", "Utensílios", "Louças", "Enxoval", "Escritório", "Manutenção"),
  },
];

export const NEXT_GROUP_CODE_AFTER_DEFAULT = DEFAULT_GROUP_TREE.length + 1;
