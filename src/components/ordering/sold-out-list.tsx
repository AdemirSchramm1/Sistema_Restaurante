import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** "Esgotado hoje" na cozinha (spec 009, US5): tira do cardápio do cliente só hoje. */
export function SoldOutList({
  dishes,
  action,
}: {
  dishes: { id: string; name: string; soldOut: boolean }[];
  action: Action;
}) {
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer font-medium">
        Esgotado hoje ({dishes.filter((x) => x.soldOut).length})
      </summary>
      <ul className="mt-2 grid gap-2">
        {dishes.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {x.name} {x.soldOut && <strong className="text-destructive">· esgotado hoje</strong>}
            </span>
            <ActionForm
              action={action}
              hidden={{ recipeId: x.id, soldOut: String(!x.soldOut) }}
              submitLabel={x.soldOut ? "Disponível de novo" : "Esgotado hoje"}
              aria-label={`${x.soldOut ? "Disponível de novo" : "Esgotado hoje"}: ${x.name}`}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
