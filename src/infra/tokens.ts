import { createHash, randomBytes } from "node:crypto";
import type { TokenService } from "@/application/ports";

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/** 32 bytes aleatórios em base64url; o banco guarda só o SHA-256. */
export const cryptoTokens: TokenService = {
  create() {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: sha256(token) };
  },
  hash: sha256,
};
