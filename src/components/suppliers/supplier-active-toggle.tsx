"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { setSupplierActiveAction } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-error";

/** Bloquear ou desbloquear o fornecedor (spec 007, US5). */
export function SupplierActiveToggle({
  id,
  version,
  active,
}: {
  id: string;
  version: number;
  active: boolean;
}) {
  const { state, pending, formProps } = useFormAction(setSupplierActiveAction);
  return (
    <form {...formProps} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="active" value={String(!active)} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {active ? "Bloquear" : "Desbloquear"}
      </Button>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
