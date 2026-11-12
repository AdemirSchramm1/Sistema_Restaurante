// Conta as consultas que cada tela faz no banco, lendo o log do PostgreSQL (log_statement = all).
// Uso: node scripts/perf/statements.mjs <arquivo-do-cookie> /estoque/itens /caixa ...
// DB_CONTAINER muda o contêiner do banco; BASE_URL, o endereço do app. Método em
// docs/sistema/04-desempenho.md.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [cookieFile, ...paths] = process.argv.slice(2);
if (!cookieFile || paths.length === 0) {
  console.error("Uso: node scripts/perf/statements.mjs /tmp/cookie.txt /estoque/itens /caixa");
  process.exit(1);
}
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const container = process.env.DB_CONTAINER ?? "sistema_restaurante-db-1";
const cookie = readFileSync(cookieFile, "utf8").trim();

// O PostgreSQL escreve o log na saída de erro do contêiner; lê só o trecho desde `since`.
const statementsSince = (since) => {
  const r = spawnSync("docker", ["logs", "--since", since, container], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || "docker logs falhou");
  return `${r.stdout}${r.stderr}`.split("\n").filter((line) => /LOG: {2}(statement|execute)/.test(line))
    .length;
};
const settle = () => new Promise((r) => setTimeout(r, 800));

for (const path of paths) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const since = new Date().toISOString();
    const res = await fetch(new URL(path, baseURL), { headers: { cookie }, redirect: "manual" });
    await res.arrayBuffer();
    if (res.status !== 200) throw new Error(`${path} respondeu ${res.status}`);
    await settle();
    runs.push(statementsSince(since));
  }
  console.log(`${path.padEnd(22)} ${runs.join(" / ")} consultas`);
}
