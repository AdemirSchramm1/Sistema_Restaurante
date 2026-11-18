import { cookies } from "next/headers";
import { MENU_ACCESS_COOKIE } from "./_qr-scan";
import { MENU_TABLET_COOKIE } from "./_tablet";

/**
 * Os dois cookies do cardápio: o do celular (QR code) e o do tablet da mesa (spec 016). Fica fora do
 * arquivo das ações para não virar uma ação que devolve cookies `HttpOnly` ao navegador.
 */
export async function menuCookies() {
  const jar = await cookies();
  return {
    qr: jar.get(MENU_ACCESS_COOKIE)?.value ?? null,
    tablet: jar.get(MENU_TABLET_COOKIE)?.value ?? null,
  };
}
