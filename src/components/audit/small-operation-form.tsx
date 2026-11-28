"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const EXPLAIN =
  "Com o modo ligado, o gerente pode aprovar o próprio acerto de estoque. Cada caso fica marcado como exceção e entra na revisão da semana.";

/** Liga e desliga o modo operação pequena (spec 019, US2), sempre com confirmação. */
export function SmallOperationForm({
  enabled,
  version,
  action,
}: {
  enabled: boolean;
  version: number;
  action: Action;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 text-sm">
        Situação: <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Ligado" : "Desligado"}</Badge>
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">{EXPLAIN}</p>
      {confirming ? (
        <ActionForm
          action={action}
          hidden={{ enabled: String(!enabled), version }}
          submitLabel="Confirmar"
          variant={enabled ? "outline" : "default"}
          size="lg"
          className="grid gap-3 rounded-lg border border-border p-3"
          aria-label={enabled ? "Desligar o modo operação pequena" : "Ligar o modo operação pequena"}
        >
          <p className="text-sm">
            {enabled
              ? "Desligar o modo operação pequena? As exceções já aprovadas continuam; os pedidos pendentes voltam a precisar de outro gerente."
              : "Ligar o modo operação pequena?"}
          </p>
          <Button type="button" variant="ghost" size="lg" onClick={() => setConfirming(false)}>
            Voltar
          </Button>
        </ActionForm>
      ) : (
        <div>
          <Button
            type="button"
            variant={enabled ? "outline" : "default"}
            size="lg"
            onClick={() => setConfirming(true)}
          >
            {enabled ? "Desligar o modo" : "Ligar o modo"}
          </Button>
        </div>
      )}
    </div>
  );
}
