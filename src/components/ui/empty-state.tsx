import type * as React from "react";
export function EmptyState(_props: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
}) {
  return null;
}
