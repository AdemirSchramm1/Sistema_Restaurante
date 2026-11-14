import type { NextRequest } from "next/server";
import { serverDeps } from "@/infra/server";
import { MENU_ACCESS_COOKIE, qrScanResponse } from "@/actions/_qr-scan";

export const dynamic = "force-dynamic";

/** Leitura do QR code: abre o acesso de 20 minutos e manda para o cardápio (contracts/public-routes.md). */
export async function GET(req: NextRequest, ctx: RouteContext<"/cardapio/qr/[token]">) {
  const { token } = await ctx.params;
  return qrScanResponse(serverDeps(), {
    token,
    cookie: req.cookies.get(MENU_ACCESS_COOKIE)?.value ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
    secure: req.nextUrl.protocol === "https:",
  });
}
