import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

/*
 * Fontes do padrão (spec 012): Inter no texto e Fraunces, serifa de cardápio, nos títulos. O
 * next/font baixa os arquivos no build e serve do próprio sistema, sem pedido ao Google no
 * navegador e sem a página pular quando a fonte chega.
 */
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "Sistema Restaurante", template: "%s · Sistema Restaurante" },
  description: "Estoque, cardápio, pedidos e caixa do restaurante",
};

/** Cor da barra do navegador no celular: o creme do fundo (claro) e o café (escuro). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf4" },
    { media: "(prefers-color-scheme: dark)", color: "#18120f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
