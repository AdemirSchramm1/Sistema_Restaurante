import type { NextRequest } from "next/server";
import { serverDeps } from "@/infra/server";
import { MENU_TABLET_COOKIE, tabletBindResponse } from "@/actions/_tablet";

export const dynamic = "force-dynamic";

/** Link do tablet da mesa (spec 016, US4): liga o aparelho à mesa e manda para o cardápio. */
export async function GET(req: NextRequest, ctx: RouteContext<"/t/[token]">) {
  const { token } = await ctx.params;
  return tabletBindResponse(serverDeps(), {
    token,
    cookie: req.cookies.get(MENU_TABLET_COOKIE)?.value ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
    secure: req.nextUrl.protocol === "https:",
  });
}
