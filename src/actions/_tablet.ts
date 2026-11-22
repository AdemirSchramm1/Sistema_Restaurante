import type { Deps } from "@/application/ports";
import { bindTablet, tabletStatus } from "@/application/ordering/menu-access";
import { messageFor } from "@/components/forms/error-messages";
import { messagePage, NO_STORE } from "./_qr-scan";

/** Cookie do tablet da mesa (spec 016, R2). Vale em todo o site para a rota `/t/` reconhecer o aparelho. */
export const MENU_TABLET_COOKIE = "menu_tablet";
/** 400 dias, o máximo que os navegadores guardam um cookie. */
export const MENU_TABLET_MAX_AGE = 400 * 24 * 60 * 60;

/** `GET /t/{token}`: liga o tablet à mesa e manda para o cardápio. */
export async function tabletBindResponse(
  deps: Deps,
  req: { token: string; cookie: string | null; ip: string | null; userAgent: string | null; secure: boolean },
): Promise<Response> {
  const r = await bindTablet(deps, {
    tabletToken: req.token,
    cookie: req.cookie,
    origin: { ip: req.ip, userAgent: req.userAgent },
  });
  if (r.kind === "INVALID") return messagePage(messageFor({ code: "TABLET_LINK_INVALID" }), 404);
  if (r.kind === "IN_USE") return messagePage(messageFor({ code: "TABLET_LINK_IN_USE" }), 200);
  const cookie = [
    `${MENU_TABLET_COOKIE}=${r.cookie}`,
    "Path=/",
    `Max-Age=${MENU_TABLET_MAX_AGE}`,
    "HttpOnly",
    ...(req.secure ? ["Secure"] : []),
    "SameSite=Lax",
  ].join("; ");
  return new Response(null, {
    status: 303,
    headers: { ...NO_STORE, Location: "/cardapio", "Set-Cookie": cookie },
  });
}

/** `GET /api/cardapio/tablet`: sinal do tablet (spec 016, R5). Sem tablet: 401 `UNKNOWN`. */
export async function tabletStatusResponse(deps: Deps, cookie: string | null): Promise<Response> {
  const status = await tabletStatus(deps, cookie);
  return Response.json(status ?? { state: "UNKNOWN" }, {
    status: status ? 200 : 401,
    headers: { "Cache-Control": "no-store" },
  });
}
