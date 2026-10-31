import { afterAll, beforeEach } from "vitest";
import { closeTestDbs, resetDatabase } from "./harness";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestDbs();
});
