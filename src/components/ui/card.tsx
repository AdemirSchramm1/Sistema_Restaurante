import type * as React from "react";
import { cn } from "@/lib/utils";

/** Cartão do padrão (spec 012): borda, fundo `card` e sombra leve. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 text-foreground shadow-sm sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 grid gap-1", className)} {...props} />;
}

/** Título do cartão: `h2` por padrão; `as` muda o nível para manter a ordem dos títulos. */
export function CardTitle({
  className,
  as: Heading = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return <Heading className={cn("text-lg font-semibold leading-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
