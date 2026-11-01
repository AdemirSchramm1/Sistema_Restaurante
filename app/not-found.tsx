import type { Metadata } from "next";
import { NotFoundMessage } from "@/components/layout/not-found-message";

export const metadata: Metadata = { title: "Não encontrado" };

export default function NotFound() {
  return <NotFoundMessage />;
}
