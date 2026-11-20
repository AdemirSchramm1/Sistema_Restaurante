"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import { CASH_NOTE_MAX, type ClosingOutcome } from "@/domain/cash/session";
import { d } from "@/domain/shared/decimal";
import { FormError } from "@/components/forms/form-error";
import { useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";
import { brl } from "@/components/ordering/format";
import { OUTCOME_TONES, countsText, moneyField, openTabsText, outcomeText, parsedMoney } from "./format";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** A última contagem conferida com o esperado: só existe depois de uma contagem gravada. */
export type CloseResultView = {
  sessionId: string;
  counted: string;
  expected: string;
  difference: string;
  result: ClosingOutcome;
  /** Todas as contagens do turno, em ordem. */
  counts: string[];
  openTabs: number;
};

/**
 * Resultado da contagem e fechamento (spec 014, US4-3 a US4-6): bateu, sobra ou falta; com
 * diferença a observação é obrigatória; o que fica na gaveta vem com o contado e o resto é a
 * retirada do fechamento. **Contar de novo** grava outra contagem.
 */
export function CloseResult({ closing, action }: { closing: CloseResultView; action: Action }) {
  const { state, pending, formProps } = useFormAction(action);
  const [kept, setKept] = useState(() => moneyField(closing.counted));
  const id = useId();
  const counted = d(closing.counted);
  const stays = parsedMoney(kept);
  const above = stays !== null && stays.gt(counted);
  const differs = closing.result !== "BALANCED";
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Badge tone={OUTCOME_TONES[closing.result]} className="w-fit px-3 py-1 text-base">
          {outcomeText(closing.result, closing.difference)}
        </Badge>
        <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Esperado na gaveta</dt>
          <dd className="text-right tabular-nums">{brl(closing.expected)}</dd>
          <dt>Contado</dt>
          <dd className="text-right font-semibold tabular-nums">{brl(counted)}</dd>
        </dl>
        {closing.counts.length > 1 && (
          <p className="text-sm text-muted-foreground">{countsText(closing.counts)}</p>
        )}
        <TextLink href="/caixa/fechar?recontar=1" className="w-fit py-2">
          Contar de novo
        </TextLink>
      </div>
      {closing.openTabs > 0 && <Alert tone="warning">{openTabsText(closing.openTabs)}</Alert>}
      <form {...formProps} aria-label="Fechar o caixa" className="grid gap-3">
        <input type="hidden" name="sessionId" value={closing.sessionId} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-kept`}>Fica na gaveta (R$)</Label>
          <Input
            id={`${id}-kept`}
            name="kept"
            inputMode="decimal"
            size="lg"
            className="w-40"
            value={kept}
            onChange={(e) => setKept(e.target.value)}
            aria-invalid={above || undefined}
            required
          />
          {stays !== null && !above && (
            <p className="text-sm text-muted-foreground">{`Retirada do fechamento: ${brl(counted.minus(stays))}`}</p>
          )}
          {above && (
            <p className="text-sm text-destructive">
              O que fica na gaveta não pode passar do que foi contado.
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`}>
            {differs ? "Observação (o que explica a diferença)" : "Observação (opcional)"}
          </Label>
          <Input id={`${id}-note`} name="note" size="lg" maxLength={CASH_NOTE_MAX} required={differs} />
        </div>
        <div>
          <Button type="submit" size="xl" disabled={pending}>
            Fechar caixa
          </Button>
        </div>
        <FormError error={state && !state.ok ? state.error : null} />
      </form>
    </div>
  );
}
