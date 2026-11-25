import type { Role } from "@/domain/access/permissions";
import type { ItemType } from "@/domain/inventory/item";
import type { UnitCode } from "@/domain/inventory/units";

/**
 * O restaurante de exemplo (spec 017): um restaurante de comida caseira com almoço executivo,
 * lanches e porções à noite. Só dados; quem grava é `seed.ts`, pelos casos de uso do app.
 * Valores em texto para virar decimal exato.
 */

export const DEMO_RESTAURANT_NAME = "Restaurante Sabor da Serra";
export const DEMO_OWNER = { name: "Ademir Souza", email: "dono@sabordaserra.com.br" };
/** Senha de todos os logins criados pelo povoamento (só desenvolvimento). */
export const DEMO_PASSWORD = "sabor12345";

/** Equipe convidada pelo gerente; o e-mail usa o domínio do e-mail do dono. */
export const DEMO_STAFF: { key: string; name: string; local: string; roles: Role[] }[] = [
  { key: "chef", name: "Marcos Oliveira", local: "chef", roles: ["CHEF"] },
  { key: "cook", name: "Patrícia Lima", local: "cozinha", roles: ["CHEF"] },
  { key: "waiter1", name: "Carlos Pereira", local: "garcom", roles: ["WAITER"] },
  { key: "waiter2", name: "Juliana Santos", local: "garconete", roles: ["WAITER"] },
  { key: "cashier", name: "Fernanda Rocha", local: "caixa", roles: ["CASHIER"] },
  { key: "stock", name: "Roberto Alves", local: "estoque", roles: ["STOCKKEEPER", "BUYER"] },
];

export type DemoSupplier = {
  key: string;
  name: string;
  legalName: string;
  cnpj: string;
  contactName: string;
  phone: string;
  email: string;
  /** 0 = domingo … 6 = sábado. */
  deliveryDays: number[];
  leadTimeDays: number;
  minOrderValue: string;
  paymentTerms: string;
};

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    key: "flv",
    name: "Hortifrúti Vale Verde",
    legalName: "Vale Verde Comércio de Hortifrutigranjeiros Ltda",
    cnpj: "12.345.678/0001-95",
    contactName: "Seu Valdir",
    phone: "(54) 99811-2040",
    email: "pedidos@valeverde.exemplo.com.br",
    deliveryDays: [2, 3, 4, 5, 6],
    leadTimeDays: 1,
    minOrderValue: "150.00",
    paymentTerms: "Boleto 7 dias",
  },
  {
    key: "meat",
    name: "Casa de Carnes Boi Nobre",
    legalName: "Boi Nobre Frigorífico e Comércio de Carnes Ltda",
    cnpj: "23.456.789/0001-95",
    contactName: "Rogério",
    phone: "(54) 99902-3311",
    email: "vendas@boinobre.exemplo.com.br",
    deliveryDays: [2, 4, 6],
    leadTimeDays: 1,
    minOrderValue: "300.00",
    paymentTerms: "Boleto 14 dias",
  },
  {
    key: "fish",
    name: "Peixaria Mar Azul",
    legalName: "Mar Azul Pescados Ltda",
    cnpj: "34.567.890/0001-30",
    contactName: "Dona Cida",
    phone: "(54) 99645-7788",
    email: "contato@marazul.exemplo.com.br",
    deliveryDays: [3, 5],
    leadTimeDays: 2,
    minOrderValue: "200.00",
    paymentTerms: "PIX na entrega",
  },
  {
    key: "dairy",
    name: "Laticínios Campo Bom",
    legalName: "Campo Bom Indústria de Laticínios Ltda",
    cnpj: "45.678.901/0001-75",
    contactName: "Luciana",
    phone: "(54) 3222-1080",
    email: "pedidos@campobom.exemplo.com.br",
    deliveryDays: [2, 5],
    leadTimeDays: 1,
    minOrderValue: "250.00",
    paymentTerms: "Boleto 21 dias",
  },
  {
    key: "dry",
    name: "Atacado Central Alimentos",
    legalName: "Central Distribuidora de Alimentos Ltda",
    cnpj: "56.789.012/0001-00",
    contactName: "Anderson",
    phone: "(54) 3025-4400",
    email: "televendas@atacadocentral.exemplo.com.br",
    deliveryDays: [2, 5],
    leadTimeDays: 2,
    minOrderValue: "500.00",
    paymentTerms: "Boleto 28 dias",
  },
  {
    key: "drinks",
    name: "Distribuidora Serra Gelada",
    legalName: "Serra Gelada Distribuidora de Bebidas Ltda",
    cnpj: "67.890.123/0001-16",
    contactName: "Thiago",
    phone: "(54) 99733-5500",
    email: "pedidos@serragelada.exemplo.com.br",
    deliveryDays: [2, 5],
    leadTimeDays: 1,
    minOrderValue: "400.00",
    paymentTerms: "Boleto 14 dias",
  },
  {
    key: "clean",
    name: "Higiprime Limpeza Profissional",
    legalName: "Higiprime Produtos de Limpeza Ltda",
    cnpj: "78.901.234/0001-05",
    contactName: "Sandra",
    phone: "(54) 3311-9090",
    email: "vendas@higiprime.exemplo.com.br",
    deliveryDays: [3],
    leadTimeDays: 3,
    minOrderValue: "150.00",
    paymentTerms: "Boleto 30 dias",
  },
];

export type DemoItem = {
  key: string;
  description: string;
  type: ItemType;
  /** Grupo e subgrupo da árvore padrão (ex.: "01", "02" = Hortifrúti > Legumes). */
  group: string;
  sub: string;
  unit: UnitCode;
  /** Embalagem do fornecedor: nome e quanto vem, na medida do item. */
  pkg: [label: string, quantity: string] | null;
  /** Preço de compra por medida do item. */
  cost: string;
  supplier: string;
  /** "Avisar quando chegar em" e "comprar até", na medida do item. */
  point: string;
  par: string;
};

const item = (
  key: string,
  description: string,
  type: ItemType,
  [group, sub]: [string, string],
  unit: UnitCode,
  pkg: [string, string] | null,
  cost: string,
  supplier: string,
  [point, par]: [string, string],
): DemoItem => ({ key, description, type, group, sub, unit, pkg, cost, supplier, point, par });

const I = "INGREDIENT" as const;
const R = "RESALE" as const;
const C = "CONSUMABLE" as const;

export const DEMO_ITEMS: DemoItem[] = [
  // Hortifrúti
  item("alface", "Alface crespa", I, ["01", "01"], "un", ["Caixa", "12"], "2.50", "flv", ["12", "48"]),
  item("tomate", "Tomate italiano", I, ["01", "02"], "kg", ["Caixa", "18"], "6.90", "flv", ["8", "30"]),
  item("cebola", "Cebola", I, ["01", "02"], "kg", ["Saco", "20"], "4.30", "flv", ["6", "25"]),
  item("alho", "Alho descascado", I, ["01", "02"], "kg", ["Pacote", "1"], "29.90", "flv", ["1", "3"]),
  item("limao", "Limão taiti", I, ["01", "03"], "kg", ["Caixa", "10"], "5.80", "flv", ["5", "20"]),
  item("laranja", "Laranja pera", I, ["01", "03"], "kg", ["Saco", "20"], "3.90", "flv", ["10", "40"]),
  item("cheiro", "Cheiro-verde", I, ["01", "04"], "un", ["Maço", "1"], "2.20", "flv", ["6", "20"]),
  // Carnes e aves
  item("picanha", "Picanha bovina", I, ["02", "01"], "kg", null, "79.90", "meat", ["6", "18"]),
  item("contrafile", "Contrafilé", I, ["02", "01"], "kg", null, "49.90", "meat", ["8", "25"]),
  item("moida", "Carne moída de patinho", I, ["02", "01"], "kg", null, "39.90", "meat", ["6", "20"]),
  item("costela", "Costelinha suína", I, ["02", "02"], "kg", null, "27.90", "meat", ["5", "15"]),
  item("frango", "Filé de peito de frango", I, ["02", "03"], "kg", ["Caixa", "5"], "19.90", "meat", ["8", "30"]),
  item("bacon", "Bacon em cubos", I, ["02", "04"], "kg", ["Pacote", "1"], "34.90", "meat", ["3", "10"]),
  item("linguica", "Linguiça toscana", I, ["02", "04"], "kg", ["Pacote", "5"], "22.90", "meat", ["4", "15"]),
  // Pescados
  item("tilapia", "Filé de tilápia", I, ["03", "01"], "kg", ["Caixa", "5"], "42.90", "fish", ["5", "20"]),
  // Laticínios, frios e ovos
  item("mussarela", "Queijo mussarela", I, ["04", "01"], "kg", ["Peça", "4"], "38.90", "dairy", ["4", "16"]),
  item("parmesao", "Queijo parmesão ralado", I, ["04", "01"], "kg", ["Pacote", "1"], "89.90", "dairy", ["1", "4"]),
  item("manteiga", "Manteiga sem sal", I, ["04", "02"], "kg", ["Pote", "0.5"], "52.00", "dairy", ["1", "4"]),
  item("leite", "Leite integral", I, ["04", "02"], "l", ["Caixa", "12"], "5.20", "dairy", ["6", "24"]),
  item("ovos", "Ovos brancos", I, ["04", "04"], "un", ["Bandeja", "30"], "0.75", "dairy", ["60", "240"]),
  // Congelados
  item("fritas", "Batata pré-frita congelada", I, ["05", "02"], "kg", ["Pacote", "2.5"], "19.90", "dry", ["15", "50"]),
  item("polpaMaracuja", "Polpa de maracujá", I, ["05", "03"], "kg", ["Pacote", "1"], "21.90", "dry", ["2", "8"]),
  item("polpaMorango", "Polpa de morango", I, ["05", "03"], "kg", ["Pacote", "1"], "23.90", "dry", ["1", "5"]),
  item("sorvete", "Sorvete de creme", I, ["05", "04"], "l", ["Pote", "5"], "13.90", "dairy", ["5", "20"]),
  // Secos e mercearia
  item("arroz", "Arroz agulhinha tipo 1", I, ["06", "01"], "kg", ["Fardo", "30"], "6.20", "dry", ["15", "60"]),
  item("feijao", "Feijão carioca", I, ["06", "01"], "kg", ["Fardo", "10"], "8.90", "dry", ["8", "30"]),
  item("trigo", "Farinha de trigo", I, ["06", "02"], "kg", ["Pacote", "5"], "5.40", "dry", ["4", "15"]),
  item("mandioca", "Farinha de mandioca", I, ["06", "02"], "kg", ["Pacote", "1"], "9.90", "dry", ["2", "8"]),
  item("rosca", "Farinha de rosca", I, ["06", "02"], "kg", ["Pacote", "1"], "11.90", "dry", ["2", "6"]),
  item("espaguete", "Espaguete nº 8", I, ["06", "03"], "kg", ["Pacote", "0.5"], "12.00", "dry", ["4", "15"]),
  item("acucar", "Açúcar refinado", I, ["06", "04"], "kg", ["Fardo", "10"], "4.90", "dry", ["5", "20"]),
  item("condensado", "Leite condensado", I, ["06", "05"], "un", ["Caixa", "27"], "7.40", "dry", ["10", "40"]),
  item("pelado", "Tomate pelado", I, ["06", "05"], "kg", ["Lata", "2.5"], "13.80", "dry", ["5", "20"]),
  item("oleo", "Óleo de soja", I, ["06", "06"], "l", ["Caixa", "20"], "8.40", "dry", ["10", "40"]),
  item("azeite", "Azeite extravirgem", I, ["06", "06"], "l", ["Lata", "3"], "54.90", "dry", ["1", "6"]),
  item("sal", "Sal refinado", I, ["06", "07"], "kg", ["Fardo", "10"], "2.40", "dry", ["2", "10"]),
  // Padaria
  item("pao", "Pão de hambúrguer brioche", I, ["07", "01"], "un", ["Pacote", "12"], "1.60", "dry", ["24", "96"]),
  // Bebidas
  item("coca", "Refrigerante cola lata 350 ml", R, ["08", "01"], "un", ["Fardo", "12"], "3.20", "drinks", ["36", "144"]),
  item("guarana", "Guaraná lata 350 ml", R, ["08", "01"], "un", ["Fardo", "12"], "2.90", "drinks", ["24", "96"]),
  item("agua", "Água mineral 500 ml", R, ["08", "01"], "un", ["Fardo", "12"], "1.20", "drinks", ["24", "96"]),
  item("aguaGas", "Água com gás 500 ml", R, ["08", "01"], "un", ["Fardo", "12"], "1.50", "drinks", ["12", "48"]),
  item("longneck", "Cerveja pilsen long neck 355 ml", R, ["08", "02"], "un", ["Caixa", "24"], "5.20", "drinks", ["48", "192"]),
  item("chope", "Chope pilsen", I, ["08", "03"], "l", ["Barril", "30"], "13.50", "drinks", ["30", "90"]),
  item("vinho", "Vinho tinto seco 750 ml", R, ["08", "04"], "un", ["Caixa", "6"], "38.00", "drinks", ["6", "24"]),
  item("cachaca", "Cachaça artesanal", I, ["08", "05"], "l", ["Garrafa", "1"], "45.00", "drinks", ["2", "6"]),
  item("gelo", "Gelo em cubos", I, ["08", "06"], "kg", ["Saco", "10"], "1.50", "drinks", ["20", "80"]),
  // Descartáveis e limpeza (não entram no CMV)
  item("luva", "Luva descartável", C, ["11", "02"], "un", ["Caixa", "100"], "0.18", "clean", ["100", "500"]),
  item("aluminio", "Papel-alumínio 45 cm", C, ["11", "01"], "un", ["Rolo", "1"], "24.90", "clean", ["2", "6"]),
  item("detergente", "Detergente neutro", C, ["12", "02"], "l", ["Galão", "5"], "4.50", "clean", ["5", "20"]),
  item("sanitizante", "Sanitizante clorado", C, ["12", "01"], "l", ["Galão", "5"], "9.20", "clean", ["5", "15"]),
];

/** Linha de ficha técnica: item (`chave`) ou preparo (`@chave`), quantidade e medida. */
export type DemoLine = [component: string, quantity: string, unit: UnitCode];

export type DemoSubRecipe = { key: string; name: string; yield: [string, UnitCode]; lines: DemoLine[] };

export const DEMO_SUB_RECIPES: DemoSubRecipe[] = [
  {
    key: "arroz",
    name: "Arroz branco",
    yield: ["3", "kg"],
    lines: [
      ["arroz", "1.2", "kg"],
      ["oleo", "40", "ml"],
      ["alho", "20", "g"],
      ["cebola", "80", "g"],
      ["sal", "20", "g"],
    ],
  },
  {
    key: "feijao",
    name: "Feijão temperado",
    yield: ["3", "kg"],
    lines: [
      ["feijao", "1", "kg"],
      ["bacon", "150", "g"],
      ["alho", "30", "g"],
      ["cebola", "150", "g"],
      ["oleo", "30", "ml"],
      ["sal", "20", "g"],
    ],
  },
  {
    key: "molho",
    name: "Molho de tomate da casa",
    yield: ["2", "kg"],
    lines: [
      ["pelado", "1.5", "kg"],
      ["tomate", "500", "g"],
      ["cebola", "200", "g"],
      ["alho", "30", "g"],
      ["azeite", "50", "ml"],
      ["acucar", "20", "g"],
      ["sal", "15", "g"],
    ],
  },
  {
    key: "vinagrete",
    name: "Vinagrete",
    yield: ["1", "kg"],
    lines: [
      ["tomate", "600", "g"],
      ["cebola", "300", "g"],
      ["cheiro", "1", "un"],
      ["azeite", "60", "ml"],
      ["limao", "100", "g"],
      ["sal", "10", "g"],
    ],
  },
  {
    key: "farofa",
    name: "Farofa da casa",
    yield: ["1", "kg"],
    lines: [
      ["mandioca", "800", "g"],
      ["bacon", "150", "g"],
      ["manteiga", "60", "g"],
      ["cebola", "100", "g"],
      ["sal", "8", "g"],
    ],
  },
];

export type DemoSectionKey = "starters" | "lunch" | "mains" | "burgers" | "salads" | "desserts" | "drinks";

export const DEMO_SECTIONS: { key: DemoSectionKey; name: string }[] = [
  { key: "lunch", name: "Pratos executivos" },
  { key: "mains", name: "Pratos da casa" },
  { key: "burgers", name: "Lanches" },
  { key: "starters", name: "Porções" },
  { key: "salads", name: "Saladas" },
  { key: "desserts", name: "Sobremesas" },
  { key: "drinks", name: "Bebidas" },
];

/** Cores da ilustração do prato (fundo da mesa e o que vai no prato ou no copo). */
export type DemoArt =
  | { kind: "plate"; foods: string[] }
  | { kind: "bowl"; foods: string[] }
  | { kind: "burger" }
  | { kind: "glass"; liquid: string; garnish?: string }
  | { kind: "can"; color: string }
  | { kind: "bottle"; color: string };

export type DemoDish = {
  key: string;
  name: string;
  section: DemoSectionKey;
  price: string;
  description: string;
  lines: DemoLine[];
  art: DemoArt;
  /** Quantas vezes sai, em média, a cada 10 clientes no almoço e no jantar. */
  lunch: number;
  dinner: number;
  /** Bebida, sobremesa ou porção dividida: entra no pedido de outro jeito. */
  role: "main" | "drink" | "dessert" | "starter";
};

const RICE = "#f4efe2";
const BEANS = "#6b3e26";
const BEEF = "#7a3b2a";
const FRIES = "#e8b64c";
const GREEN = "#5c9a3a";
const TOMATO = "#c8372d";
const CHICKEN = "#d9a066";
const FISH = "#e9cf9e";
const PASTA = "#f1d27a";
const CHEESE = "#f6d36b";

export const DEMO_DISHES: DemoDish[] = [
  {
    key: "execContra",
    name: "Executivo de contrafilé",
    section: "lunch",
    price: "39.90",
    description: "Contrafilé grelhado, arroz, feijão, fritas e salada de alface e tomate.",
    lines: [
      ["contrafile", "200", "g"],
      ["@arroz", "200", "g"],
      ["@feijao", "180", "g"],
      ["fritas", "120", "g"],
      ["alface", "0.25", "un"],
      ["tomate", "50", "g"],
      ["oleo", "30", "ml"],
    ],
    art: { kind: "plate", foods: [BEEF, RICE, BEANS, FRIES, GREEN] },
    lunch: 2.6,
    dinner: 0.4,
    role: "main",
  },
  {
    key: "execFrango",
    name: "Executivo de frango grelhado",
    section: "lunch",
    price: "32.90",
    description: "Filé de peito de frango grelhado, arroz, feijão, fritas e salada.",
    lines: [
      ["frango", "200", "g"],
      ["@arroz", "200", "g"],
      ["@feijao", "180", "g"],
      ["fritas", "120", "g"],
      ["alface", "0.25", "un"],
      ["tomate", "50", "g"],
      ["limao", "20", "g"],
      ["oleo", "30", "ml"],
    ],
    art: { kind: "plate", foods: [CHICKEN, RICE, BEANS, FRIES, GREEN] },
    lunch: 2.2,
    dinner: 0.3,
    role: "main",
  },
  {
    key: "execTilapia",
    name: "Executivo de tilápia",
    section: "lunch",
    price: "38.90",
    description: "Filé de tilápia empanado, arroz, feijão, salada e limão.",
    lines: [
      ["tilapia", "200", "g"],
      ["rosca", "40", "g"],
      ["ovos", "1", "un"],
      ["@arroz", "200", "g"],
      ["@feijao", "180", "g"],
      ["alface", "0.25", "un"],
      ["limao", "30", "g"],
      ["oleo", "60", "ml"],
    ],
    art: { kind: "plate", foods: [FISH, RICE, BEANS, GREEN, "#f2e24a"] },
    lunch: 1.1,
    dinner: 0.2,
    role: "main",
  },
  {
    key: "picanha",
    name: "Picanha na chapa (2 pessoas)",
    section: "mains",
    price: "139.90",
    description: "600 g de picanha fatiada na chapa, arroz, farofa da casa, vinagrete e fritas.",
    lines: [
      ["picanha", "600", "g"],
      ["@arroz", "400", "g"],
      ["@farofa", "200", "g"],
      ["@vinagrete", "200", "g"],
      ["fritas", "300", "g"],
      ["oleo", "60", "ml"],
    ],
    art: { kind: "plate", foods: [BEEF, BEEF, RICE, "#d8b27a", TOMATO, FRIES] },
    lunch: 0.35,
    dinner: 0.8,
    role: "main",
  },
  {
    key: "parmegiana",
    name: "Filé de frango à parmegiana",
    section: "mains",
    price: "54.90",
    description: "Filé de frango empanado com molho de tomate da casa e mussarela gratinada, arroz e fritas.",
    lines: [
      ["frango", "250", "g"],
      ["rosca", "50", "g"],
      ["ovos", "1", "un"],
      ["@molho", "150", "g"],
      ["mussarela", "100", "g"],
      ["@arroz", "200", "g"],
      ["fritas", "150", "g"],
      ["oleo", "80", "ml"],
    ],
    art: { kind: "plate", foods: [TOMATO, CHEESE, RICE, FRIES] },
    lunch: 0.9,
    dinner: 1.0,
    role: "main",
  },
  {
    key: "costelinha",
    name: "Costelinha suína assada",
    section: "mains",
    price: "64.90",
    description: "Costelinha assada lentamente, arroz, farofa da casa e vinagrete.",
    lines: [
      ["costela", "450", "g"],
      ["@arroz", "200", "g"],
      ["@farofa", "100", "g"],
      ["@vinagrete", "100", "g"],
      ["alho", "10", "g"],
      ["sal", "8", "g"],
    ],
    art: { kind: "plate", foods: ["#9c4a2a", RICE, "#d8b27a", TOMATO] },
    lunch: 0.4,
    dinner: 0.6,
    role: "main",
  },
  {
    key: "bolonhesa",
    name: "Espaguete à bolonhesa",
    section: "mains",
    price: "46.90",
    description: "Espaguete com molho de tomate da casa e carne moída de patinho, com parmesão.",
    lines: [
      ["espaguete", "150", "g"],
      ["moida", "150", "g"],
      ["@molho", "200", "g"],
      ["parmesao", "20", "g"],
      ["azeite", "10", "ml"],
    ],
    art: { kind: "bowl", foods: [PASTA, "#a0442c", TOMATO] },
    lunch: 0.7,
    dinner: 0.7,
    role: "main",
  },
  {
    key: "sugo",
    name: "Espaguete ao sugo",
    section: "mains",
    price: "36.90",
    description: "Espaguete com molho de tomate da casa, manjericão e parmesão.",
    lines: [
      ["espaguete", "150", "g"],
      ["@molho", "220", "g"],
      ["parmesao", "20", "g"],
      ["azeite", "10", "ml"],
    ],
    art: { kind: "bowl", foods: [PASTA, TOMATO, GREEN] },
    lunch: 0.4,
    dinner: 0.4,
    role: "main",
  },
  {
    key: "xburger",
    name: "X-Burger da casa",
    section: "burgers",
    price: "34.90",
    description: "Pão brioche, hambúrguer de 180 g, mussarela, alface e tomate.",
    lines: [
      ["pao", "1", "un"],
      ["moida", "180", "g"],
      ["mussarela", "40", "g"],
      ["alface", "0.1", "un"],
      ["tomate", "40", "g"],
      ["manteiga", "10", "g"],
    ],
    art: { kind: "burger" },
    lunch: 0.5,
    dinner: 2.4,
    role: "main",
  },
  {
    key: "xbacon",
    name: "X-Bacon",
    section: "burgers",
    price: "39.90",
    description: "Pão brioche, hambúrguer de 180 g, bacon crocante, mussarela, alface e tomate.",
    lines: [
      ["pao", "1", "un"],
      ["moida", "180", "g"],
      ["bacon", "50", "g"],
      ["mussarela", "40", "g"],
      ["alface", "0.1", "un"],
      ["tomate", "40", "g"],
      ["manteiga", "10", "g"],
    ],
    art: { kind: "burger" },
    lunch: 0.4,
    dinner: 2.0,
    role: "main",
  },
  {
    key: "salada",
    name: "Salada da casa",
    section: "salads",
    price: "29.90",
    description: "Alface, tomate, cebola roxa, parmesão e molho de limão com azeite.",
    lines: [
      ["alface", "0.5", "un"],
      ["tomate", "100", "g"],
      ["cebola", "30", "g"],
      ["parmesao", "20", "g"],
      ["azeite", "20", "ml"],
      ["limao", "30", "g"],
    ],
    art: { kind: "bowl", foods: [GREEN, TOMATO, GREEN, "#f3e3b0"] },
    lunch: 0.5,
    dinner: 0.3,
    role: "main",
  },
  {
    key: "fritas",
    name: "Batata frita",
    section: "starters",
    price: "32.00",
    description: "Porção de 400 g de batata frita sequinha.",
    lines: [
      ["fritas", "400", "g"],
      ["oleo", "60", "ml"],
      ["sal", "5", "g"],
    ],
    art: { kind: "bowl", foods: [FRIES, FRIES, FRIES] },
    lunch: 0.2,
    dinner: 1.2,
    role: "starter",
  },
  {
    key: "fritasBacon",
    name: "Fritas com bacon e queijo",
    section: "starters",
    price: "42.00",
    description: "Batata frita coberta com mussarela derretida e bacon crocante.",
    lines: [
      ["fritas", "400", "g"],
      ["bacon", "100", "g"],
      ["mussarela", "100", "g"],
      ["oleo", "60", "ml"],
    ],
    art: { kind: "bowl", foods: [FRIES, CHEESE, "#a64b2a"] },
    lunch: 0.1,
    dinner: 1.0,
    role: "starter",
  },
  {
    key: "linguica",
    name: "Linguiça acebolada",
    section: "starters",
    price: "38.00",
    description: "Linguiça toscana na chapa com cebola, acompanha pão.",
    lines: [
      ["linguica", "400", "g"],
      ["cebola", "150", "g"],
      ["oleo", "20", "ml"],
    ],
    art: { kind: "plate", foods: ["#a5462c", "#a5462c", "#e9d6a0"] },
    lunch: 0.1,
    dinner: 0.8,
    role: "starter",
  },
  {
    key: "isca",
    name: "Isca de tilápia",
    section: "starters",
    price: "54.00",
    description: "Iscas de tilápia empanadas com limão e molho tártaro.",
    lines: [
      ["tilapia", "350", "g"],
      ["trigo", "80", "g"],
      ["ovos", "1", "un"],
      ["limao", "50", "g"],
      ["oleo", "100", "ml"],
    ],
    art: { kind: "plate", foods: [FISH, FISH, "#f2e24a"] },
    lunch: 0.05,
    dinner: 0.5,
    role: "starter",
  },
  {
    key: "pudim",
    name: "Pudim de leite",
    section: "desserts",
    price: "16.90",
    description: "Pudim de leite condensado com calda de caramelo.",
    lines: [
      ["condensado", "0.25", "un"],
      ["leite", "100", "ml"],
      ["ovos", "1", "un"],
      ["acucar", "30", "g"],
    ],
    art: { kind: "plate", foods: ["#e8b04f", "#8a4a1c"] },
    lunch: 0.8,
    dinner: 0.6,
    role: "dessert",
  },
  {
    key: "sorvete",
    name: "Sorvete com calda de morango",
    section: "desserts",
    price: "18.90",
    description: "Duas bolas de sorvete de creme com calda de morango da casa.",
    lines: [
      ["sorvete", "150", "ml"],
      ["polpaMorango", "50", "g"],
      ["acucar", "20", "g"],
    ],
    art: { kind: "bowl", foods: ["#f7eccd", "#f7eccd", "#c0283a"] },
    lunch: 0.5,
    dinner: 0.5,
    role: "dessert",
  },
  {
    key: "coca",
    name: "Refrigerante cola lata",
    section: "drinks",
    price: "7.00",
    description: "Lata de 350 ml.",
    lines: [["coca", "1", "un"]],
    art: { kind: "can", color: "#c4161c" },
    lunch: 2.4,
    dinner: 1.6,
    role: "drink",
  },
  {
    key: "guarana",
    name: "Guaraná lata",
    section: "drinks",
    price: "6.50",
    description: "Lata de 350 ml.",
    lines: [["guarana", "1", "un"]],
    art: { kind: "can", color: "#1f8a3b" },
    lunch: 1.4,
    dinner: 0.8,
    role: "drink",
  },
  {
    key: "agua",
    name: "Água mineral",
    section: "drinks",
    price: "4.50",
    description: "Garrafa de 500 ml, sem gás.",
    lines: [["agua", "1", "un"]],
    art: { kind: "bottle", color: "#8fc6e8" },
    lunch: 1.6,
    dinner: 0.8,
    role: "drink",
  },
  {
    key: "aguaGas",
    name: "Água com gás",
    section: "drinks",
    price: "5.00",
    description: "Garrafa de 500 ml, com gás.",
    lines: [["aguaGas", "1", "un"]],
    art: { kind: "bottle", color: "#5fa8d3" },
    lunch: 0.6,
    dinner: 0.4,
    role: "drink",
  },
  {
    key: "sucoLaranja",
    name: "Suco de laranja natural",
    section: "drinks",
    price: "12.00",
    description: "Copo de 500 ml, espremido na hora.",
    lines: [
      ["laranja", "800", "g"],
      ["gelo", "100", "g"],
    ],
    art: { kind: "glass", liquid: "#f39c1f", garnish: "#f7b733" },
    lunch: 1.4,
    dinner: 0.5,
    role: "drink",
  },
  {
    key: "sucoMaracuja",
    name: "Suco de maracujá",
    section: "drinks",
    price: "12.00",
    description: "Copo de 500 ml, feito com polpa.",
    lines: [
      ["polpaMaracuja", "100", "g"],
      ["acucar", "40", "g"],
      ["gelo", "100", "g"],
    ],
    art: { kind: "glass", liquid: "#f2c230" },
    lunch: 0.9,
    dinner: 0.4,
    role: "drink",
  },
  {
    key: "longneck",
    name: "Cerveja long neck",
    section: "drinks",
    price: "12.00",
    description: "Cerveja pilsen, 355 ml, bem gelada.",
    lines: [["longneck", "1", "un"]],
    art: { kind: "bottle", color: "#6b4a1c" },
    lunch: 0.4,
    dinner: 2.2,
    role: "drink",
  },
  {
    key: "chope",
    name: "Chope 300 ml",
    section: "drinks",
    price: "11.90",
    description: "Chope pilsen tirado na hora.",
    lines: [["chope", "300", "ml"]],
    art: { kind: "glass", liquid: "#f0b429", garnish: "#fffaf0" },
    lunch: 0.3,
    dinner: 2.6,
    role: "drink",
  },
  {
    key: "caipirinha",
    name: "Caipirinha de limão",
    section: "drinks",
    price: "22.00",
    description: "Cachaça artesanal, limão taiti e açúcar.",
    lines: [
      ["cachaca", "60", "ml"],
      ["limao", "120", "g"],
      ["acucar", "30", "g"],
      ["gelo", "150", "g"],
    ],
    art: { kind: "glass", liquid: "#d9eab0", garnish: "#6fa83a" },
    lunch: 0.1,
    dinner: 0.9,
    role: "drink",
  },
  {
    key: "vinho",
    name: "Vinho tinto seco (garrafa)",
    section: "drinks",
    price: "89.00",
    description: "Garrafa de 750 ml, tinto seco nacional.",
    lines: [["vinho", "1", "un"]],
    art: { kind: "bottle", color: "#5a1428" },
    lunch: 0.05,
    dinner: 0.25,
    role: "drink",
  },
];

/** Adicionais e retiradas dos lanches (spec 010). */
export const DEMO_ADDONS: { key: string; name: string; component: string; quantity: string; unit: UnitCode; price: string }[] =
  [
    { key: "bacon", name: "Bacon extra", component: "bacon", quantity: "40", unit: "g", price: "6.00" },
    { key: "queijo", name: "Queijo extra", component: "mussarela", quantity: "40", unit: "g", price: "5.00" },
    { key: "ovo", name: "Ovo", component: "ovos", quantity: "1", unit: "un", price: "3.00" },
  ];

export const DEMO_CUSTOMIZATION: { dish: string; addons: string[]; removables: string[] }[] = [
  { dish: "xburger", addons: ["bacon", "queijo", "ovo"], removables: ["alface", "tomate"] },
  { dish: "xbacon", addons: ["queijo", "ovo"], removables: ["alface", "tomate"] },
  { dish: "execContra", addons: ["ovo"], removables: [] },
];

export const DEMO_TABLES = 12;

/** Observações que o garçom manda para a cozinha. */
export const DEMO_KITCHEN_NOTES: Record<string, string[]> = {
  execContra: ["Carne bem passada", "Carne ao ponto", "Sem salada"],
  picanha: ["Ao ponto para mal", "Bem passada"],
  xburger: ["Ponto da carne: ao ponto", "Pão sem manteiga"],
  xbacon: ["Bacon bem crocante"],
  parmegiana: ["Trocar fritas por arroz"],
};
