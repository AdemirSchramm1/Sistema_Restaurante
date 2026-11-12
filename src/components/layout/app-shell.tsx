"use client";

import type * as React from "react";
import type { Role } from "@/domain/access/permissions";

export function AppShell({
  children,
}: {
  restaurantName: string | null;
  userName: string | null;
  roles: readonly Role[];
  reorderCount: number;
  signOut: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
