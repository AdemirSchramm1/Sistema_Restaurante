import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Campos do padrão (spec 012): 40 px, borda `input`, anel de foco páprica, erro em beterraba.
 * `size="lg"` (spec 013): 44 px e letra de 16 px, para telas que a pessoa usa com o dedo.
 */
type FieldSize = { size?: "lg" };

const field =
  "w-full rounded-lg border border-input bg-card px-3 text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/30";

const height = (size: "lg" | undefined) => (size === "lg" ? "h-11 text-base" : "h-10 text-sm");

export function Input({
  className,
  size,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & FieldSize) {
  return <input className={cn(field, "flex py-1", height(size), className)} {...props} />;
}

export function Select({
  className,
  size,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & FieldSize) {
  return <select className={cn(field, "flex px-2 py-1", height(size), className)} {...props} />;
}

export function Textarea({
  className,
  size,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldSize) {
  return (
    <textarea
      className={cn(field, "py-2", size === "lg" ? "min-h-28 text-base" : "min-h-20 text-sm", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-4 accent-primary", className)} {...props} />;
}
