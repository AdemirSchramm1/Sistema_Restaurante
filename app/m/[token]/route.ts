/**
 * Link do QR code impresso na mesa (spec 009). Passa para `/cardapio/qr/{token}`, onde o navegador
 * manda o cookie do acesso anterior (que só vale em `/cardapio`) para ser encerrado.
 */
export async function GET(_req: Request, ctx: RouteContext<"/m/[token]">) {
  const { token } = await ctx.params;
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/cardapio/qr/${encodeURIComponent(token)}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
