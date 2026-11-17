"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import {
  WITHDRAWAL_REASONS,
  WITHDRAWAL_REASON_LABELS,
  type EntryKind,
  type WithdrawalReason,
} from "@/domain/cash/entries";
import { CASH_NOTE_MAX } from "@/domain/cash/session";
import { FormError } from "@/components/forms/form-error";
import { useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const SUBMIT: Record<EntryKind, string> = { WITHDRAWAL: "Registrar sangria", SUPPLY: "Registrar reforço" };
const SAVED: Record<EntryKind, string> = { WITHDRAWAL: "Sangria registrada.", SUPPLY: "Reforço registrado." };

/**
 * Sangria (dinheiro que sai da gaveta) ou reforço (dinheiro que entra): spec 014, US3. O id do
 * lançamento só muda depois de gravar: o toque duplo e a repetição depois de um erro mandam o
 * mesmo. Depois de gravar, oferece o comprovante para assinar.
 */
export function EntryForm({
  kind,
  action,
  children,
}: {
  kind: EntryKind;
  action: Action;
  /** Botões ao lado de "Registrar" (Voltar). */
  children?: React.ReactNode;
}) {
  const { state, pending, saved, formProps } = useFormAction(action);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<WithdrawalReason | null>(null);
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const id = useId();

  // Gravou: campos limpos e id novo para o próximo lançamento.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state?.ok) {
      setAmount("");
      setReason(null);
      setNote("");
      setRequestId(crypto.randomUUID());
    }
  }
  const entryId = state?.ok ? (state.data as { entryId: string }).entryId : null;

  return (
    <form {...formProps} aria-label={SUBMIT[kind]} className="grid gap-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="clientRequestId" value={requestId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-amount`}>Valor (R$)</Label>
        <Input
          id={`${id}-amount`}
          name="amount"
          inputMode="decimal"
          size="lg"
          className="w-40"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      {kind === "WITHDRAWAL" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Motivo</legend>
          <div className="flex flex-wrap gap-2">
            {WITHDRAWAL_REASONS.map((r) => (
              <label
                key={r}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground"
              >
                <input
                  type="radio"
                  className="accent-primary"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  required
                />
                {WITHDRAWAL_REASON_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>
          {reason === "OTHER" ? "Observação (para que foi a sangria)" : "Observação (opcional)"}
        </Label>
        <Input
          id={`${id}-note`}
          name="note"
          size="lg"
          maxLength={CASH_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required={reason === "OTHER"}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="xl" disabled={pending}>
          {SUBMIT[kind]}
        </Button>
        {children}
      </div>
      {saved && (
        <Alert tone="success">
          {`${SAVED[kind]} `}
          <TextLink href={`/caixa/lancamentos/${entryId}/imprimir`}>Imprimir comprovante</TextLink>
        </Alert>
      )}
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
