"use client";

import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { FormError } from "@/components/forms/form-error";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const yesNo = (v: boolean) => (v ? "sim" : "não");

export function CogsOverride({
  id,
  version,
  override,
  groupInCogs,
  effective,
  canEdit,
  action,
}: {
  id: string;
  version: number;
  override: boolean | null;
  groupInCogs: boolean;
  effective: boolean;
  canEdit: boolean;
  action: Action;
}) {
  const { state, pending, formProps } = useFormAction(action);
  return (
    <Card className="grid gap-2 text-sm">
      <CardTitle>Conta no custo dos pratos?</CardTitle>
      <p className="text-muted-foreground">
        Itens que vão nos pratos ou são revendidos entram no custo (CMV). Limpeza e descartáveis, em geral,
        não.
      </p>
      <p>
        Agora: <strong>{yesNo(effective)}</strong>
        {override === null ? ` (segue o grupo: ${yesNo(groupInCogs)})` : " (definido no item)"}
      </p>
      {canEdit && (
        <form {...formProps} className="grid gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <label htmlFor="cogs-override" className="font-medium">
            Exceção do item
          </label>
          <Select
            id="cogs-override"
            name="override"
            defaultValue={override === null ? "group" : String(override)}
          >
            <option value="group">Seguir o grupo</option>
            <option value="true">Sim, entra no CMV</option>
            <option value="false">Não entra no CMV</option>
          </Select>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Salvar exceção
          </Button>
          <FormError error={state && !state.ok ? state.error : null} />
        </form>
      )}
    </Card>
  );
}
