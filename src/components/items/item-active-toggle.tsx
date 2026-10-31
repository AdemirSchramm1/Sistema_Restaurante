"use client";

import { useActionState } from "react";
import { setItemActiveAction } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-error";

export function ItemActiveToggle({ id, version, active }: { id: string; version: number; active: boolean }) {
  const [state, action, pending] = useActionState(setItemActiveAction, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="active" value={String(!active)} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {active ? "Inativar" : "Reativar"}
      </Button>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
