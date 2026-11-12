import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link de texto do padrão (spec 012): páprica com sublinhado. */
export function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary",
        className,
      )}
      {...props}
    />
  );
}
