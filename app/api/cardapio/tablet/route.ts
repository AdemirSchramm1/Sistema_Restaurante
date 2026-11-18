import type { NextRequest } from "next/server";
import { serverDeps } from "@/infra/server";
import { MENU_TABLET_COOKIE, tabletStatusResponse } from "@/actions/_tablet";

export const dynamic = "force-dynamic";

/** Sinal do tablet da mesa (spec 016, R5): situação, conta aberta e `stamp`; grava o "visto há". */
export async function GET(req: NextRequest) {
  return tabletStatusResponse(serverDeps(), req.cookies.get(MENU_TABLET_COOKIE)?.value ?? null);
}
