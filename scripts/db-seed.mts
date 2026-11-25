import "./load-env";
import { createDb } from "../src/infra/db/db";
import { makeDeps, systemClock } from "../src/infra/deps";
import { MemoryMailer } from "../src/infra/mailer/memory";
import { photoStorageFromEnv } from "../src/infra/photos/from-env";
import { sharpProcessor } from "../src/infra/photos/sharp-processor";
import { demoArtist } from "../src/infra/demo/artist";
import { seedDemoRestaurant, type SeedClock } from "../src/application/demo/seed";
import { ROLE_LABELS } from "../src/domain/access/permissions";

/**
 * Só para desenvolvimento (spec 017): povoa o banco do `.env.local` com o restaurante de exemplo.
 *
 *   pnpm db:seed                      restaurante novo, login dono@sabordaserra.com.br
 *   pnpm db:seed teste@teste.com      povoa o restaurante dessa conta (já criada pela tela)
 *   pnpm db:seed --dias 14            histórico mais curto (padrão: 28 dias)
 */
const args = process.argv.slice(2);
const daysAt = args.indexOf("--dias");
const days = daysAt >= 0 ? Number.parseInt(args[daysAt + 1] ?? "", 10) : 28;
const email = args.find((a, i) => a.includes("@") && (daysAt < 0 || i !== daysAt + 1));
if (!Number.isInteger(days) || days < 1 || days > 120) throw new Error("--dias deve ser de 1 a 120");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL (veja .env.example)");
if (process.env.MENU_PHOTOS === "vercel-blob") throw new Error("O povoamento é só para desenvolvimento.");

let current = systemClock.now();
const clock: SeedClock = { now: () => new Date(current), set: (at) => void (current = new Date(at)) };
const db = createDb(url);
const deps = makeDeps({
  db,
  mailer: new MemoryMailer(),
  clock,
  appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  authSecret: process.env.BETTER_AUTH_SECRET ?? "segredo-de-desenvolvimento-com-32-caracteres",
  photos: {
    processor: sharpProcessor,
    storage: photoStorageFromEnv(
      { ...process.env, MENU_PHOTOS: "file" },
      {
        put: () => Promise.reject(new Error("sem Blob")),
        del: () => Promise.reject(new Error("sem Blob")),
      },
    ).storage,
  },
});

const started = Date.now();
try {
  const r = await seedDemoRestaurant(
    { deps, clock, artist: demoArtist },
    {
      account: email ? { kind: "existing", email } : { kind: "new" },
      days,
      now: systemClock.now(),
      log: (m) => console.log(m),
    },
  );
  switch (r.status) {
    case "CREATED": {
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`\nPronto em ${secs} s: ${r.restaurantName} com ${days} dias de movimento.\n`);
      console.log("Logins (http://localhost:3000/entrar):");
      console.log(
        `  ${r.owner.email.padEnd(32)} ${(r.owner.password ?? "(a sua senha)").padEnd(12)} Gerente (${r.owner.name})`,
      );
      for (const p of r.staff)
        console.log(
          `  ${p.email.padEnd(32)} ${r.password.padEnd(12)} ${p.roles.map((x) => ROLE_LABELS[x]).join(", ")} (${p.name})`,
        );
      break;
    }
    case "ALREADY_SEEDED":
      console.log(`${r.restaurantName} já foi povoado; nada mudou.`);
      break;
    case "ACCOUNT_NOT_FOUND":
      console.error(`Não achei a conta ${r.email}. Crie pela tela (Criar conta) ou rode sem e-mail.`);
      process.exitCode = 1;
      break;
    case "NOT_A_MANAGER":
      console.error(`${r.email} não é gerente do restaurante; use o e-mail de quem criou a conta.`);
      process.exitCode = 1;
      break;
    case "RESTAURANT_IN_USE":
      console.error(
        `${r.restaurantName} já tem pedidos, caixa ou estoque lançados; o povoamento é para restaurante vazio.`,
      );
      process.exitCode = 1;
      break;
    case "CASH_SESSION_OPEN":
      console.error(`${r.restaurantName} está com o caixa aberto. Feche o caixa e rode de novo.`);
      process.exitCode = 1;
      break;
  }
} finally {
  await db.$client.end();
}
