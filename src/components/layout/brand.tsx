import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "Sistema Restaurante";

/** Marca do sistema (spec 012): o chapéu de chef num quadrado de páprica. É enfeite. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <ChefHat className="size-5" strokeWidth={2.25} />
    </span>
  );
}

/** Marca com um nome (o do restaurante, no menu) e uma linha de apoio opcional. */
export function Brand({ name, caption, className }: { name: string; caption?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandMark />
      <div className="min-w-0">
        <p className="truncate font-display text-base font-semibold leading-tight">{name}</p>
        {caption && <p className="truncate text-xs opacity-80">{caption}</p>}
      </div>
    </div>
  );
}
