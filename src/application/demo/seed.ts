import type { Deps, MailMessage, Repos } from "../ports";
import type { RequestContext } from "../context";
import { signUpRestaurant, DEFAULT_TIMEZONE } from "../access/sign-up-restaurant";
import { inviteMember } from "../access/invite-member";
import { acceptInvitation } from "../access/accept-invitation";
import { createItem } from "../inventory/create-item";
import { setReorderLevels } from "../inventory/reorder";
import { createRecipe } from "../inventory/recipes";
import { createSupplier, addSupplierItem } from "../suppliers/suppliers";
import { createSection } from "../menu/sections";
import { createMenuProduct } from "../menu/create-product";
import { setProductPhoto } from "../menu/photo";
import { setAppearanceImage } from "../menu/appearance";
import { createAddon } from "../ordering/addons";
import { setProductCustomization } from "../ordering/customization";
import { createTablesInRange } from "../ordering/tables";
import {
  DEMO_ADDONS,
  DEMO_CUSTOMIZATION,
  DEMO_DISHES,
  DEMO_ITEMS,
  DEMO_OWNER,
  DEMO_PASSWORD,
  DEMO_RESTAURANT_NAME,
  DEMO_SECTIONS,
  DEMO_STAFF,
  DEMO_SUB_RECIPES,
  DEMO_SUPPLIERS,
  DEMO_TABLES,
  type DemoArt,
  type DemoLine,
} from "./catalog";
import { runHistory, type DemoRestaurant } from "./history";
import { normalizeDescription } from "@/domain/inventory/description";
import type { ComponentRef, RecipeLineData } from "@/domain/inventory/recipe";
import type { Role } from "@/domain/access/permissions";
import { businessDay } from "@/domain/ordering/business-day";
import { d } from "@/domain/shared/decimal";
import { ok, type Result } from "@/domain/shared/result";
import { localTime, must, type SeedClock } from "./shared";

export type { SeedClock };

/** Quem desenha as fotos do cardápio, o logo e a capa (fica na infra: usa sharp). */
export type DemoArtist = {
  product(art: DemoArt, name: string): Promise<Uint8Array>;
  logo(name: string): Promise<Uint8Array>;
  cover(name: string): Promise<Uint8Array>;
};

export type SeedOptions = {
  /** Restaurante novo de exemplo, ou o restaurante de quem já tem conta (pelo e-mail do gerente). */
  account: { kind: "new" } | { kind: "existing"; email: string };
  /** Dias de histórico antes de hoje. Hoje entra até `now`. */
  days: number;
  now: Date;
  log?: (message: string) => void;
};

export type SeedPerson = { name: string; email: string; roles: Role[] };
export type SeedResult =
  | {
      status: "CREATED";
      restaurantId: string;
      restaurantName: string;
      /** Senha só quando o povoamento criou o login do dono. */
      owner: { name: string; email: string; password: string | null };
      /** Equipe convidada; todos com a senha `password`. */
      staff: SeedPerson[];
      password: string;
    }
  | { status: "ALREADY_SEEDED"; restaurantId: string; restaurantName: string }
  | { status: "ACCOUNT_NOT_FOUND"; email: string }
  | { status: "NOT_A_MANAGER"; email: string }
  | { status: "RESTAURANT_IN_USE"; restaurantName: string }
  | { status: "CASH_SESSION_OPEN"; restaurantName: string };

type SeedEnv = { deps: Deps; clock: SeedClock; artist: DemoArtist };

const DAY_MS = 24 * 3600_000;
/** Fornecedor que marca o restaurante já povoado. */
const MARKER_SUPPLIER = DEMO_SUPPLIERS[0]!.name;

const contextOf = (
  v: { userId: string; restaurantId: string; membershipId: string },
  roles: readonly Role[],
): RequestContext => ({ ...v, roles, origin: { channel: "system" } });

/**
 * Povoa o banco com o restaurante de exemplo (spec 017): cadastros pelo gerente e pela equipe e
 * `days` dias de movimento até `now`, sempre pelos casos de uso do app.
 */
export async function seedDemoRestaurant(env: SeedEnv, opts: SeedOptions): Promise<SeedResult> {
  const log = opts.log ?? (() => undefined);
  const today = businessDay(opts.now, DEFAULT_TIMEZONE);
  const firstDay = businessDay(
    new Date(localTime(today, "12:00").getTime() - opts.days * DAY_MS),
    DEFAULT_TIMEZONE,
  );
  // Os cadastros ficam na véspera do primeiro dia de movimento.
  env.clock.set(new Date(localTime(firstDay, "09:00").getTime() - DAY_MS));

  // Inbox própria: o convite da equipe é aceito na hora, com o link que chegaria por e-mail.
  const inbox: MailMessage[] = [];
  const deps: Deps = { ...env.deps, mailer: { send: async (m) => void inbox.push(m) } };

  const ownerEmail =
    opts.account.kind === "existing" ? opts.account.email.trim().toLowerCase() : DEMO_OWNER.email;
  let owner: RequestContext;
  let ownerPassword: string | null = null;
  let ownerName = DEMO_OWNER.name;
  const existingUser = await deps.global.userIdByEmail(ownerEmail);
  if (existingUser) {
    const m = await deps.global.membershipForUser(existingUser);
    if (!m || !m.active) return { status: "ACCOUNT_NOT_FOUND", email: ownerEmail };
    if (!m.roles.includes("MANAGER")) return { status: "NOT_A_MANAGER", email: ownerEmail };
    owner = contextOf({ userId: existingUser, ...m }, m.roles);
    type State = {
      name: string;
      status: "ALREADY_SEEDED" | "CASH_SESSION_OPEN" | "RESTAURANT_IN_USE" | null;
    };
    const state = await deps.tenant(owner.restaurantId, async (repos): Promise<Result<State>> => {
      const name = (await repos.restaurants.get())?.name ?? "";
      if (await repos.suppliers.findActiveByName(normalizeDescription(MARKER_SUPPLIER)))
        return ok({ name, status: "ALREADY_SEEDED" });
      if (await repos.cashSessions.current()) return ok({ name, status: "CASH_SESSION_OPEN" });
      const used =
        (await repos.cashSessions.lastClosed()) !== null ||
        (await repos.movements.list({ limit: 1 })).length > 0 ||
        (await repos.orders.listByStatus(["RECEIVED", "PREPARING", "READY"])).length > 0;
      return ok({ name, status: used ? "RESTAURANT_IN_USE" : null });
    });
    const { name, status } = must(state, "leitura do restaurante");
    if (status === "ALREADY_SEEDED")
      return { status, restaurantId: owner.restaurantId, restaurantName: name };
    if (status) return { status, restaurantName: name };
    ownerName = (await userName(deps, owner)) ?? ownerName;
  } else if (opts.account.kind === "existing") {
    return { status: "ACCOUNT_NOT_FOUND", email: ownerEmail };
  } else {
    log("Criando o restaurante e o login do dono…");
    const created = must(
      await signUpRestaurant(
        deps,
        {
          restaurantName: DEMO_RESTAURANT_NAME,
          userName: DEMO_OWNER.name,
          email: ownerEmail,
          password: DEMO_PASSWORD,
        },
        { channel: "system" },
      ),
      "criar o restaurante",
    );
    owner = contextOf(created, ["MANAGER"]);
    ownerPassword = DEMO_PASSWORD;
  }
  const restaurantName = must(
    await deps.tenant(owner.restaurantId, async (repos) => ok((await repos.restaurants.get())?.name ?? "")),
    "nome do restaurante",
  );

  log("Convidando a equipe…");
  const domain = ownerEmail.split("@")[1]!;
  const team = new Map<string, RequestContext>();
  const staff: SeedPerson[] = [];
  for (const person of DEMO_STAFF) {
    const email = `${person.local}@${domain}`;
    const ctx = await addTeamMember(deps, owner, inbox, { ...person, email });
    if (!ctx) {
      log(`  ${email} já tem login em outro lugar; ficou de fora.`);
      continue;
    }
    team.set(person.key, ctx);
    staff.push({ name: person.name, email, roles: person.roles });
  }
  // Sem alguém da equipe, o dono faz a parte dele.
  const as = (key: string) => team.get(key) ?? owner;

  log("Cadastrando fornecedores, itens e fichas técnicas…");
  const restaurant = await buildCatalog(deps, env.artist, owner, as("chef"), log);

  await runHistory(
    { deps, clock: env.clock, log },
    {
      ...restaurant,
      owner,
      chef: as("chef"),
      cook: as("cook"),
      waiters: [as("waiter1"), as("waiter2")],
      cashier: as("cashier"),
      stock: as("stock"),
    },
    { firstDay, today, now: opts.now },
  );

  return {
    status: "CREATED",
    restaurantId: owner.restaurantId,
    restaurantName,
    owner: { name: ownerName, email: ownerEmail, password: ownerPassword },
    staff,
    password: DEMO_PASSWORD,
  };
}

async function userName(deps: Deps, ctx: RequestContext): Promise<string | null> {
  const r = await deps.tenant(ctx.restaurantId, async (repos) =>
    ok((await repos.members.list()).find((m) => m.userId === ctx.userId)?.name ?? null),
  );
  return r.ok ? r.value : null;
}

/** Convite pelo gerente e aceite com a senha de exemplo; `null` se o e-mail já é de outro restaurante. */
async function addTeamMember(
  deps: Deps,
  owner: RequestContext,
  inbox: MailMessage[],
  person: { name: string; email: string; roles: Role[] },
): Promise<RequestContext | null> {
  const invited = await inviteMember(deps, owner, { email: person.email, roles: person.roles });
  if (!invited.ok) {
    if (invited.error.code === "ALREADY_MEMBER") {
      const userId = (await deps.global.userIdByEmail(person.email))!;
      const m = (await deps.global.membershipForUser(userId))!;
      return contextOf({ userId, ...m }, m.roles);
    }
    return null;
  }
  const mail = inbox.findLast((m) => m.to === person.email)!;
  const token = /\/convite\/(\S+)/.exec(mail.text)![1]!;
  const accepted = must(
    await acceptInvitation(
      deps,
      { token, name: person.name, password: DEMO_PASSWORD },
      { channel: "system" },
    ),
    `aceitar o convite de ${person.email}`,
  );
  const m = (await deps.global.membershipForUser(accepted.userId))!;
  return contextOf({ userId: accepted.userId, ...m }, m.roles);
}

type Catalog = Omit<DemoRestaurant, "owner" | "chef" | "cook" | "waiters" | "cashier" | "stock">;

async function buildCatalog(
  deps: Deps,
  artist: DemoArtist,
  owner: RequestContext,
  chef: RequestContext,
  log: (m: string) => void,
): Promise<Catalog> {
  const rid = owner.restaurantId;
  const read = async <T>(fn: (repos: Repos) => Promise<T>): Promise<T> =>
    must(await deps.tenant(rid, async (repos) => ok(await fn(repos))), "leitura");

  // Fornecedores
  const suppliers = new Map<string, string>();
  for (const s of DEMO_SUPPLIERS) {
    const { key, minOrderValue, ...data } = s;
    const id = must(
      await createSupplier(deps, owner, { ...data, minOrderValue: d(minOrderValue), notes: null }),
      `fornecedor ${s.name}`,
    ).id;
    suppliers.set(key, id);
  }

  // Itens, preço de cada fornecedor e aviso de reposição
  const tree = await read((repos) => repos.groups.tree(false));
  const subgroup = (group: string, sub: string) => {
    const s = tree.find((g) => g.code === group)?.subgroups.find((x) => x.code === sub);
    if (!s) throw new Error(`Povoamento: subgrupo ${group}.${sub} não existe`);
    return s.id;
  };
  const items = new Map<string, string>();
  for (const it of DEMO_ITEMS) {
    const subgroupId = subgroup(it.group, it.sub);
    const created = await createItem(deps, owner, {
      description: it.description,
      type: it.type,
      subgroupId,
      stockUnit: it.unit,
      purchaseUnitLabel: it.pkg?.[0] ?? null,
      purchaseFactor: it.pkg ? d(it.pkg[1]) : null,
    });
    const duplicate = !created.ok && created.error.code === "ITEM_DUPLICATE_DESCRIPTION";
    const id: string = duplicate
      ? (await read((repos) =>
          repos.items.findActiveByDescription(subgroupId, normalizeDescription(it.description)),
        ))!.id
      : must(created, `item ${it.description}`).id;
    items.set(it.key, id);
    const version = (await read((repos) => repos.items.get(id)))!.version;
    must(
      await setReorderLevels(deps, owner, id, version, { reorderPoint: d(it.point), parLevel: d(it.par) }),
      `aviso de ${it.description}`,
    );
    const pkgQty = it.pkg ? d(it.pkg[1]) : null;
    must(
      await addSupplierItem(deps, owner, suppliers.get(it.supplier)!, {
        itemId: id,
        packageLabel: it.pkg?.[0] ?? null,
        packageQuantity: pkgQty,
        price: pkgQty ? d(it.cost).times(pkgQty).toDecimalPlaces(2) : d(it.cost),
        preferred: true,
      }),
      `preço de ${it.description}`,
    );
  }

  // Preparos e produtos
  const subRecipes = new Map<string, string>();
  const ref = ([component]: DemoLine): ComponentRef =>
    component.startsWith("@")
      ? { kind: "RECIPE", id: subRecipes.get(component.slice(1))! }
      : { kind: "ITEM", id: items.get(component)! };
  const lines = (ls: DemoLine[]): RecipeLineData[] =>
    ls.map((l) => ({ component: ref(l), quantity: d(l[1]), unit: l[2] }));
  const existingRecipe = (name: string) =>
    read((repos) => repos.recipes.findActiveByName(normalizeDescription(name)));

  for (const s of DEMO_SUB_RECIPES) {
    const created = await createRecipe(deps, chef, {
      name: s.name,
      kind: "SUB_RECIPE",
      yieldQuantity: d(s.yield[0]),
      yieldUnit: s.yield[1],
      lines: lines(s.lines),
    });
    const id =
      !created.ok && created.error.code === "RECIPE_DUPLICATE_NAME"
        ? (await existingRecipe(s.name))!.id
        : must(created, `preparo ${s.name}`).id;
    subRecipes.set(s.key, id);
  }

  log("Montando o cardápio com fotos…");
  const sectionsNow = await read((repos) => repos.menuBoard.sections());
  const sections = new Map<string, string>();
  for (const s of DEMO_SECTIONS) {
    const found = sectionsNow.find((x) => normalizeDescription(x.name) === normalizeDescription(s.name));
    sections.set(
      s.key,
      found?.id ?? must(await createSection(deps, owner, { name: s.name }), `seção ${s.name}`).id,
    );
  }
  const dishes = new Map<string, string>();
  for (const dish of DEMO_DISHES) {
    const created = await createMenuProduct(deps, owner, {
      name: dish.name,
      lines: lines(dish.lines),
      salePrice: d(dish.price),
      sectionId: sections.get(dish.section)!,
      description: dish.description,
    });
    const id =
      !created.ok && created.error.code === "RECIPE_DUPLICATE_NAME"
        ? (await existingRecipe(dish.name))!.id
        : must(created, `produto ${dish.name}`).id;
    dishes.set(dish.key, id);
    must(
      await setProductPhoto(deps, owner, { id, bytes: await artist.product(dish.art, dish.name) }),
      `foto de ${dish.name}`,
    );
  }
  const restaurantName = (await read((repos) => repos.restaurants.get()))?.name ?? DEMO_RESTAURANT_NAME;
  must(
    await setAppearanceImage(deps, owner, { kind: "LOGO", bytes: await artist.logo(restaurantName) }),
    "logo",
  );
  must(
    await setAppearanceImage(deps, owner, { kind: "COVER", bytes: await artist.cover(restaurantName) }),
    "capa",
  );

  // Adicionais e retiradas dos lanches
  const addons = new Map<string, { id: string; price: string }>();
  for (const a of DEMO_ADDONS) {
    const id = must(
      await createAddon(deps, owner, {
        name: a.name,
        component: { kind: "ITEM", id: items.get(a.component)! },
        quantity: d(a.quantity),
        unit: a.unit,
        price: d(a.price),
      }),
      `adicional ${a.name}`,
    ).id;
    addons.set(a.key, { id, price: a.price });
  }
  for (const c of DEMO_CUSTOMIZATION) {
    const recipeId = dishes.get(c.dish)!;
    const version = (await read((repos) => repos.recipes.get(recipeId)))!.version;
    must(
      await setProductCustomization(deps, owner, {
        recipeId,
        version,
        addons: c.addons.map((key) => ({ addonId: addons.get(key)!.id, maxTimes: 2 })),
        removables: c.removables.map((key) => ({
          component: { kind: "ITEM" as const, id: items.get(key)! },
        })),
      }),
      `adicionais de ${c.dish}`,
    );
  }

  must(await createTablesInRange(deps, owner, { from: 1, to: DEMO_TABLES }), "mesas");
  const names = new Set(Array.from({ length: DEMO_TABLES }, (_, i) => String(i + 1)));
  const tables = (await read((repos) => repos.tables.list(false)))
    .filter((t) => names.has(t.name))
    .map((t) => ({ id: t.id, name: t.name }));

  return { items, suppliers, dishes, addons, tables };
}
