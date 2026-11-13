// Proxy TCP que atrasa cada pacote em N ms em cada sentido: simula o banco gerenciado longe do app
// (Vercel → Neon). Uso: node scripts/perf/latency-proxy.mjs <porta-de-escuta> <porta-do-banco> <ms-por-sentido>
import net from "node:net";

const [listenPort, targetPort, delayMs] = process.argv.slice(2).map((v) => Number.parseFloat(v));
if (!listenPort || !targetPort || !(delayMs >= 0)) {
  console.error("Uso: node scripts/perf/latency-proxy.mjs 5440 5432 2.5");
  process.exit(1);
}

net
  .createServer((client) => {
    const server = net.connect(targetPort, "127.0.0.1");
    // Mesmo atraso para todo pacote: a ordem se mantém.
    const pipe = (from, to) => from.on("data", (chunk) => setTimeout(() => to.write(chunk), delayMs));
    pipe(client, server);
    pipe(server, client);
    const close = () => {
      client.destroy();
      server.destroy();
    };
    for (const socket of [client, server]) {
      socket.on("error", close);
      socket.on("close", close);
    }
  })
  .listen(listenPort, () =>
    console.log(
      `proxy ${listenPort} → ${targetPort}, ${delayMs} ms em cada sentido (${2 * delayMs} ms ida e volta)`,
    ),
  );
