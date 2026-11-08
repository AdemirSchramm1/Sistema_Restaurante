import type { Deps } from "@/application/ports";
import { openMenuAccess } from "@/application/ordering/menu-access";
import { MENU_ACCESS_MINUTES } from "@/domain/ordering/menu-access";
import { messageFor } from "@/components/forms/error-messages";

/** Cookie do acesso ao cardápio (research R2). Só vale nas páginas do cardápio. */
export const MENU_ACCESS_COOKIE = "menu_access";

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Página mínima com a mensagem para o cliente (sem menu, sem nada do restaurante). */
function messagePage(message: string, status: number): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cardápio</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center"><main><p style="font-size:1.25rem;max-width:28rem">${escape(message)}</p></main></body></html>`;
  return new Response(html, { status, headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" } });
}

/** `GET /m/{token}`: lê o QR code, abre o acesso de 20 minutos e manda para o cardápio. */
export async function qrScanResponse(
  deps: Deps,
  req: { token: string; cookie: string | null; ip: string | null; userAgent: string | null },
): Promise<Response> {
  const r = await openMenuAccess(deps, {
    qrToken: req.token,
    previousCookie: req.cookie,
    origin: { ip: req.ip, userAgent: req.userAgent },
  });
  if (!r.ok) {
    if (r.error.code === "NOT_FOUND") return messagePage("QR code inválido. Chame um garçom.", 404);
    return messagePage(messageFor(r.error), 200);
  }
  const cookie = [
    `${MENU_ACCESS_COOKIE}=${r.value.cookie}`,
    "Path=/cardapio",
    `Max-Age=${MENU_ACCESS_MINUTES * 60}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: "/cardapio", "Set-Cookie": cookie } });
}
