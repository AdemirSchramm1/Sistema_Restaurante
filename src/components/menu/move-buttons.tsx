"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Problem } from "./feedback";

export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Subir e descer uma seção ou um produto (spec 013, US2.3 e US3.1). Dois botões de verdade num
 * formulário: funcionam com toque, mouse e teclado. Na ponta, o botão fica desligado.
 */
export function MoveButtons({
  id,
  name,
  canMoveUp,
  canMoveDown,
  action,
}: {
  id: string;
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  action: FormAction;
}) {
  const { pending, error, formProps } = useFormAction(action);
  return (
    <form
      {...formProps}
      role="group"
      aria-label={`Ordem de ${name}`}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        name="direction"
        value="up"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Subir ${name}`}
        disabled={!canMoveUp || pending}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="submit"
        name="direction"
        value="down"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Descer ${name}`}
        disabled={!canMoveDown || pending}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      {error && <Problem>{error.message}</Problem>}
    </form>
  );
}
