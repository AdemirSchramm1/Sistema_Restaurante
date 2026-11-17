"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import { Alert } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { PaymentForm } from "./payment-form";
import { SplitHelper } from "./split-helper";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Receber: a divisão (US3) só preenche o valor do pagamento (US2). Com o caixa fechado (spec 014,
 * US1-1) a conta continua na tela, mas lançar fica desligado com o motivo.
 */
export function PaymentPanel({
  tabId,
  remaining,
  action,
  cashSessionOpen,
}: {
  tabId: string;
  remaining: string;
  action: Action;
  cashSessionOpen: boolean;
}) {
  const [fill, setFill] = useState<{ amount: string; at: number } | null>(null);
  const reasonId = useId();
  return (
    <div className="grid gap-4">
      {!cashSessionOpen && (
        <Alert tone="warning" id={reasonId}>
          Abra o caixa antes de receber. <TextLink href="/caixa">Ir para o Caixa</TextLink>
        </Alert>
      )}
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Dividir a conta</summary>
        <div className="mt-3">
          <SplitHelper
            remaining={remaining}
            onPick={(amount) => setFill((f) => ({ amount, at: (f?.at ?? 0) + 1 }))}
          />
        </div>
      </details>
      <PaymentForm
        tabId={tabId}
        remaining={remaining}
        action={action}
        fill={fill}
        blockedBy={cashSessionOpen ? undefined : reasonId}
      />
    </div>
  );
}
