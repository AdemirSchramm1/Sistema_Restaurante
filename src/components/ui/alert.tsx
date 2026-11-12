import type * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aviso do padrão (spec 012): erro, atenção, informação e deu certo. A cor e o ícone ajudam, mas o
 * texto sempre diz o que houve. Erro é anunciado na hora (`alert`); os outros, sem interromper.
 */
const TONES: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  error: { className: "border-destructive/30 bg-danger-soft text-danger-soft-foreground", icon: CircleAlert },
  warning: {
    className: "border-warning/60 bg-warning-soft text-warning-soft-foreground",
    icon: TriangleAlert,
  },
  info: { className: "border-info/30 bg-info-soft text-info-soft-foreground", icon: Info },
  success: { className: "border-success/30 bg-success-soft text-success-soft-foreground", icon: CircleCheck },
};

export type AlertTone = "error" | "warning" | "info" | "success";

export function Alert({
  className,
  tone = "error",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: AlertTone }) {
  const { className: toneClass, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm", toneClass, className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
