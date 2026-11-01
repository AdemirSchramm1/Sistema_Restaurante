import { existsSync } from "node:fs";

/**
 * Lê `.env.local` (se existir) para os scripts de banco, como o Next faz no `pnpm dev`.
 * Variáveis já definidas no ambiente (CI) têm prioridade.
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
