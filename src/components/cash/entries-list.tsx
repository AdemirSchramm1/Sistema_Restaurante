"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ENTRY_KIND_LABELS, WITHDRAWAL_REASON_LABELS } from "@/domain/cash/entries";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { brl } from "@/components/ordering/format";
import { timeIn } from "@/components/billing/format";
import { atBy } from "./format";
import type { EntryView } from "./view";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** "Sangria · Cofre" ou "Reforço". */
export const entryTitle = (e: Pick<EntryView, "kind" | "reason">) =>
  e.reason
    ? `${ENTRY_KIND_LABELS[e.kind]} · ${WITHDRAWAL_REASON_LABELS[e.reason]}`
    : ENTRY_KIND_LABELS[e.kind];

const ARTICLE = { WITHDRAWAL: "a sangria", SUPPLY: "o reforço" } as const;

/**
 * Sangrias e reforços do turno (spec 014, US3-4 e US3-5). O tirado continua na lista, riscado, com
 * quem tirou e quando. "Tirar" só aparece com `remove` (turno aberto e quem pode) e pede
 * confirmação; `receipts` liga o link do comprovante.
 */
export function EntriesList({
  entries,
  timezone,
  remove,
  receipts = true,
}: {
  entries: EntryView[];
  timezone: string;
  remove?: Action;
  receipts?: boolean;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">Nenhuma sangria ou reforço neste turno.</p>;
  return (
    <ul className="grid gap-2">
      {entries.map((e) => {
        const removed = e.removedAt !== null;
        const value = brl(e.amount);
        const name = ENTRY_KIND_LABELS[e.kind].toLowerCase();
        const label = `Tirar ${name} de ${value}`;
        const time = timeIn(e.at, timezone);
        return (
          <li
            key={e.id}
            className={`grid gap-1 rounded-md border border-border p-2 text-sm ${removed ? "text-muted-foreground" : ""}`}
          >
            <div className="flex justify-between gap-2">
              <span className="font-medium">{entryTitle(e)}</span>
              {removed ? <del>{value}</del> : <strong>{value}</strong>}
            </div>
            {e.note && <span>{e.note}</span>}
            <span className="text-muted-foreground">{e.byName ? `${time} · ${e.byName}` : time}</span>
            {e.removedAt && <span>{`Tirado ${atBy(e.removedAt, e.removedByName, timezone)}`}</span>}
            {!removed && (receipts || remove) && confirming !== e.id && (
              <div className="flex flex-wrap items-center gap-3">
                {receipts && <TextLink href={`/caixa/lancamentos/${e.id}/imprimir`}>Comprovante</TextLink>}
                {remove && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={label}
                    onClick={() => setConfirming(e.id)}
                  >
                    Tirar
                  </Button>
                )}
              </div>
            )}
            {remove && !removed && confirming === e.id && (
              <ActionForm
                action={remove}
                hidden={{ entryId: e.id }}
                submitLabel="Sim, tirar"
                variant="destructive"
                className="flex flex-wrap items-center gap-2"
                aria-label={label}
              >
                <p className="basis-full">{`Tirar ${ARTICLE[e.kind]} de ${value}?`}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Voltar
                </Button>
              </ActionForm>
            )}
          </li>
        );
      })}
    </ul>
  );
}
