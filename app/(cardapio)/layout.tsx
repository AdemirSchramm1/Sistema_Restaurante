import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cardápio", robots: { index: false, follow: false } };

/** Cardápio do cliente: sem menu da equipe e sem login (research R11). */
export default function CardapioLayout({ children }: LayoutProps<"/">) {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 text-base">{children}</main>;
}
