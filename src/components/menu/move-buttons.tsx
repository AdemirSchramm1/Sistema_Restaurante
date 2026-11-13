import type { ActionState } from "@/actions/_session";

export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function MoveButtons(_props: {
  id: string;
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  action: FormAction;
}) {
  return null;
}
