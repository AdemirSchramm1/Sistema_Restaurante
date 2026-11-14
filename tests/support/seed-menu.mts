/**
 * Cria um restaurante de teste direto pelos casos de uso e imprime, em JSON, o que os testes de
 * ponta a ponta e de tela precisam (logins, mesa, ids). Roda pelo `seedMenu` de
 * `tests/support/seed.ts`:
 *
 *   tsx tests/support/seed-menu.mts <cenário>
 *
 * Cenários (specs/013-editar-cardapio/contracts/screens.md, "Dados fixos"):
 *   plain      produtos sem seção, sem foto (ponto de partida dos testes de ponta a ponta)
 *   board      Entradas, Lanches, Bebidas e Outros, com e sem foto, nome de 70 e descrição de 300
 *   sections8  8 seções, para a barra de seções que rola
 *   weight40   40 produtos com foto, para o teste de peso
 */
import "../../scripts/load-env";
import { readFile } from "node:fs/promises";
import { createDb } from "../../src/infra/db/db";
import { makeDeps } from "../../src/infra/deps";
import { MemoryMailer } from "../../src/infra/mailer/memory";
import { photoStorageFromEnv } from "../../src/infra/photos/from-env";
import { sharpProcessor } from "../../src/infra/photos/sharp-processor";
import { signUpRestaurant } from "../../src/application/access/sign-up-restaurant";
import { createItem } from "../../src/application/inventory/create-item";
import { createRecipe, setRecipeActive } from "../../src/application/inventory/recipes";
import { setRecipeSalePrice } from "../../src/application/inventory/product-costs";
import { createAddon } from "../../src/application/ordering/addons";
import { setProductCustomization } from "../../src/application/ordering/customization";
import { setProductSoldOut } from "../../src/application/ordering/kitchen";
import { createTable, tableQrCodes } from "../../src/application/ordering/tables";
import { createSection } from "../../src/application/menu/sections";
import type { RequestContext } from "../../src/application/context";
import type { Role } from "../../src/domain/access/permissions";
import { d } from "../../src/domain/shared/decimal";
import { ok, type Result } from "../../src/domain/shared/result";
import { LONG_DESCRIPTION, LONG_NAME, RESTAURANT_NAME } from "../builders/menu-data";

const scenario = process.argv[2] ?? "plain";
const PASSWORD = "senha-forte-123";
const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Defina ${name}`);
  return v;
};

const db = createDb(env("DATABASE_URL"), 2);
const deps = makeDeps({
  db,
  mailer: new MemoryMailer(),
  appUrl: env("BETTER_AUTH_URL"),
  authSecret: env("BETTER_AUTH_SECRET"),
  photos: {
    processor: sharpProcessor,
    storage: photoStorageFromEnv(process.env, {
      put: () => Promise.reject(new Error("sem Blob nos testes")),
      del: () => Promise.reject(new Error("sem Blob nos testes")),
    }).storage,
  },
});

const unwrap = <T,>(r: Result<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const email = (who: string) => `${who}-${stamp}@teste.com.br`;

// Antes o nome levava o carimbo aleatório: o tamanho variava a cada preparo e, em 320 px, o nome
// ora cabia numa linha, ora em duas, ora passava da tela com a letra em 200% (teste intermitente).
const restaurant = RESTAURANT_NAME;
const signed = unwrap(
  await signUpRestaurant(
    deps,
    { restaurantName: restaurant, userName: "Gerente Teste", email: email("gerente"), password: PASSWORD },
    { channel: "test" },
  ),
);
const m: RequestContext = { ...signed, roles: ["MANAGER"], origin: { channel: "test" } };
const audit = () => ({ at: deps.clock.now(), by: m.userId });

async function member(who: string, name: string, roles: Role[]) {
  const user = unwrap(await deps.auth.createUser({ email: email(who), password: PASSWORD, name }));
  unwrap(
    await deps.tenant(m.restaurantId, async (repos) => {
      await repos.members.create({ id: deps.ids.next(), userId: user.userId, roles }, audit());
      return ok(undefined);
    }),
  );
  return email(who);
}
const chef = await member("chef", "Chef Teste", ["CHEF"]);
const stockkeeper = await member("estoquista", "Estoquista Teste", ["STOCKKEEPER"]);

const subgroupId = unwrap(
  await deps.tenant(m.restaurantId, async (repos) =>
    ok((await repos.groups.tree(true))[0]!.subgroups[0]!.id),
  ),
);
const item = async (description: string, stockUnit: "un" | "kg") =>
  unwrap(
    await createItem(deps, m, {
      description,
      type: "INGREDIENT",
      subgroupId,
      stockUnit,
      purchaseUnitLabel: null,
      purchaseFactor: null,
    }),
  ).id;
const pao = await item("Pão de hambúrguer", "un");
const queijo = await item("Queijo prato", "kg");
const cebola = await item("Cebola", "kg");

const PHOTOS = ["lanche.webp", "prato.png", "deitada.jpg", "em-pe.jpg"];
let photoTurn = 0;

type Dish = {
  price?: string | null;
  description?: string;
  photo?: boolean;
  /** Foto no peso de uma foto de celular de verdade (teste de peso), em vez das pequenas. */
  realPhoto?: boolean;
  cebola?: boolean;
};
const products: Record<string, string> = {};
async function dish(name: string, o: Dish = {}) {
  const id = unwrap(
    await createRecipe(deps, m, {
      name,
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [
        { component: { kind: "ITEM", id: pao }, quantity: d("1"), unit: "un" },
        ...(o.cebola
          ? [{ component: { kind: "ITEM" as const, id: cebola }, quantity: d("20"), unit: "g" as const }]
          : []),
      ],
    }),
  ).id;
  if (o.price !== null) unwrap(await setRecipeSalePrice(deps, m, id, 1, d(o.price ?? "19.90")));
  const version = o.price === null ? 1 : 2;
  if (o.description || o.photo) {
    const file = o.realPhoto ? "realista.jpg" : PHOTOS[photoTurn++ % PHOTOS.length]!;
    const variants = o.photo
      ? unwrap(await sharpProcessor.process(new Uint8Array(await readFile(`tests/screens/photos/${file}`))))
          .variants
      : null;
    const saved = variants ? await deps.photos.storage.put(crypto.randomUUID(), variants) : null;
    unwrap(
      await deps.tenant(m.restaurantId, async (repos) => {
        if (o.description) await repos.menuBoard.setDescription(id, o.description, version, audit());
        if (saved && variants)
          await repos.menuBoard.setPhoto(
            id,
            { base: saved.base, widths: variants.map((v) => v.width) },
            audit(),
          );
        return ok(undefined);
      }),
    );
  }
  products[name] = id;
  return id;
}
const section = async (name: string, ids: string[]) => {
  const { id } = unwrap(await createSection(deps, m, { name }));
  if (ids.length)
    unwrap(
      await deps.tenant(m.restaurantId, async (repos) => {
        await repos.menuBoard.placeProducts(id, ids);
        return ok(undefined);
      }),
    );
  return id;
};
const sections: Record<string, string> = {};

if (scenario === "plain") {
  await dish("X-Burger", { price: "28.00", cebola: true });
  await dish("X-Salada", { price: "26.00" });
  await dish("Suco de laranja", { price: "9.00" });
  await dish("Água", { price: "5.00" });
} else if (scenario === "board") {
  const batata = await dish("Batata frita com cheddar", {
    price: "24.00",
    photo: true,
    description: "Porção para duas pessoas.",
  });
  const bolinho = await dish("Bolinho de bacalhau", { price: "32.00" });
  const burger = await dish("X-Burger", {
    price: "28.00",
    photo: true,
    cebola: true,
    description: "Pão brioche, hambúrguer de 150 g, queijo prato e cebola.\nAcompanha molho da casa.",
  });
  const longo = await dish(LONG_NAME, { price: "42.00", photo: true, description: "O maior da casa." });
  const salada = await dish("X-Salada", { price: "26.00", description: LONG_DESCRIPTION });
  const bacon = await dish("X-Bacon", { price: "31.00", photo: true });
  const suco = await dish("Suco de laranja", {
    price: "9.00",
    photo: true,
    description: "Feito na hora, 400 ml.",
  });
  const agua = await dish("Água", { price: "5.00" });
  await dish("Pudim", { price: "12.00", photo: true, description: "Pudim de leite com calda de caramelo." });
  await dish("Café", { price: null });
  const sorvete = await dish("Sorvete", { price: "10.00" });
  const brownie = await dish("Brownie", { price: "14.00", photo: true });
  unwrap(await setRecipeActive(deps, m, sorvete, 2, false));
  unwrap(await setProductSoldOut(deps, m, { recipeId: brownie, soldOut: true }));
  const cheese = unwrap(
    await createAddon(deps, m, {
      name: "Fatia de queijo",
      component: { kind: "ITEM", id: queijo },
      quantity: d("20"),
      unit: "g",
      price: d("3.00"),
    }),
  ).id;
  const burgerVersion = unwrap(
    await deps.tenant(m.restaurantId, async (repos) => ok((await repos.menuBoard.product(burger))!.version)),
  );
  unwrap(
    await setProductCustomization(deps, m, {
      recipeId: burger,
      version: burgerVersion,
      addons: [{ addonId: cheese, maxTimes: 2 }],
      removables: [{ component: { kind: "ITEM", id: cebola } }],
    }),
  );
  sections.Entradas = await section("Entradas", [batata, bolinho]);
  sections.Lanches = await section("Lanches", [burger, longo, salada, bacon]);
  sections.Bebidas = await section("Bebidas", [suco, agua]);
} else if (scenario === "sections8") {
  const names = [
    "Entradas",
    "Lanches",
    "Porções",
    "Pratos do dia",
    "Massas",
    "Sobremesas",
    "Bebidas",
    "Cervejas e drinks",
  ];
  for (const [i, name] of names.entries()) {
    const ids = [];
    for (let n = 1; n <= 3; n++)
      ids.push(await dish(`${name} ${n}`, { price: `${10 + i + n}.00`, photo: n === 1 }));
    sections[name] = await section(name, ids);
  }
} else if (scenario === "weight40") {
  const ids = [];
  for (let n = 1; n <= 40; n++)
    ids.push(
      await dish(`Prato ${String(n).padStart(2, "0")}`, {
        price: "20.00",
        photo: true,
        realPhoto: true,
        description: "Com foto.",
      }),
    );
  sections.Pratos = await section("Pratos", ids);
} else throw new Error(`cenário desconhecido: ${scenario}`);

const table = unwrap(await createTable(deps, m, { name: "12" }));
const qr = unwrap(await tableQrCodes(deps, m, { ids: [table.id] }));
const qrPath = new URL(qr.tables[0]!.url).pathname;

console.log(
  JSON.stringify({
    restaurant,
    password: PASSWORD,
    manager: email("gerente"),
    chef,
    stockkeeper,
    qrPath,
    sections,
    products,
  }),
);
await db.$client.end();
