import "server-only";
import { createDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL");

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof createDb> };
export const db = (globalForDb.__db ??= createDb(url));
