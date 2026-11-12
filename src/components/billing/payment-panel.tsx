"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { PaymentForm } from "./payment-form";
import { SplitHelper } from "./split-helper";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Receber: a divisão (US3) só preenche o valor do pagamento (US2). */
export function PaymentPanel({
  tabId,
  remaining,
  action,
}: {
  tabId: string;
  remaining: string;
  action: Action;
}) {
  const [fill, setFill] = useState<{ amount: string; at: number } | null>(null);
  return (
    <div className="grid gap-4">
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Dividir a conta</summary>
        <div className="mt-3">
          <SplitHelper
            remaining={remaining}
            onPick={(amount) => setFill((f) => ({ amount, at: (f?.at ?? 0) + 1 }))}
          />
        </div>
      </details>
      <PaymentForm tabId={tabId} remaining={remaining} action={action} fill={fill} />
    </div>
  );
}
