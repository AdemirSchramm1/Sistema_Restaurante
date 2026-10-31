import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-6 shadow-xs", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "muted" | "warn" }) {
  const tones = {
    default: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
    warn: "bg-amber-100 text-amber-900",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  className,
  tone = "error",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "error" | "info" | "success" }) {
  const tones = {
    error: "border-destructive/40 bg-destructive/5 text-destructive",
    info: "border-border bg-muted text-foreground",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}
      {...props}
    />
  );
}
