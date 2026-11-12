import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Lista vazia do padrão (spec 012): o que falta, por quê e o que fazer. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
