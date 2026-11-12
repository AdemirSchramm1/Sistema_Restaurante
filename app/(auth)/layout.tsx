import { CircleDollarSign, CookingPot, Package, QrCode, UtensilsCrossed } from "lucide-react";
import { Brand, PRODUCT_NAME } from "@/components/layout/brand";

const HIGHLIGHTS = [
  { icon: Package, text: "Estoque que baixa sozinho a cada pedido" },
  { icon: QrCode, text: "Cardápio e pedido pelo QR code da mesa" },
  { icon: CookingPot, text: "Cozinha, garçom e caixa acompanhando cada pedido" },
  { icon: CircleDollarSign, text: "Custo de cada prato e quanto sobra do preço" },
];

/**
 * Telas de entrada (spec 012, US3): no computador, o painel da marca na lousa ao lado do formulário;
 * no celular, só a marca em cima do formulário.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Brand name={PRODUCT_NAME} />
        <div className="relative grid max-w-md gap-8">
          <p className="font-display text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
            Do estoque ao caixa, o restaurante inteiro numa tela só.
          </p>
          <ul className="grid gap-4 text-sm">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <UtensilsCrossed
          aria-hidden="true"
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-20 -right-20 size-96 text-sidebar-accent"
        />
      </aside>
      <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-sm gap-6">
          <Brand name={PRODUCT_NAME} className="lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
