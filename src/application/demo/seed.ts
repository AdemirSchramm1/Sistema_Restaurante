import type { Clock, Deps } from "../ports";
import type { DemoArt } from "./catalog";

/** Relógio que o povoamento move para lançar cada dia do histórico na hora certa. */
export type SeedClock = Clock & { set(at: Date): void };

/** Quem desenha as fotos do cardápio, o logo e a capa (fica na infra: usa sharp). */
export type DemoArtist = {
  product(art: DemoArt, name: string): Promise<Uint8Array>;
  logo(name: string): Promise<Uint8Array>;
  cover(name: string): Promise<Uint8Array>;
};

export type SeedOptions = {
  account: { kind: "new" } | { kind: "existing"; email: string };
  days: number;
  now: Date;
  log?: (message: string) => void;
};

export type SeedPerson = { name: string; email: string; roles: string[] };
export type SeedResult =
  | {
      status: "CREATED";
      restaurantId: string;
      restaurantName: string;
      owner: { name: string; email: string; password: string | null };
      staff: SeedPerson[];
      password: string;
    }
  | { status: "ALREADY_SEEDED"; restaurantId: string; restaurantName: string }
  | { status: "ACCOUNT_NOT_FOUND"; email: string }
  | { status: "RESTAURANT_IN_USE"; restaurantName: string }
  | { status: "CASH_SESSION_OPEN"; restaurantName: string };

export async function seedDemoRestaurant(
  _env: { deps: Deps; clock: SeedClock; artist: DemoArtist },
  opts: SeedOptions,
): Promise<SeedResult> {
  return { status: "ACCOUNT_NOT_FOUND", email: opts.account.kind === "existing" ? opts.account.email : "" };
}
