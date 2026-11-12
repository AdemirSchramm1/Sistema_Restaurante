"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/components/ordering/format";
import { d, formatBrDecimal } from "@/domain/shared/decimal";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * "Tirar taxa de serviço" pede confirmação com o valor; "Pôr taxa de volta" desfaz (spec 011, US1-8).
 * A confirmação some quando a conta muda (outra versão).
 */
export function ServiceChargeToggle({
  tab,
  action,
}: {
  tab: {
    id: string;
    version: number;
    serviceRate: string | null;
    serviceWaived: boolean;
    serviceCharge: string;
  };
  action: Action;
}) {
  const [confirmingVersion, setConfirmingVersion] = useState<number | null>(null);
  if (tab.serviceRate === null) return null;
  const hidden = { tabId: tab.id, version: tab.version };
  if (tab.serviceWaived)
    return (
      <ActionForm action={action} hidden={{ ...hidden, waived: "false" }} submitLabel="Pôr taxa de volta" />
    );
  if (confirmingVersion !== tab.version)
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingVersion(tab.version)}>
        Tirar taxa de serviço
      </Button>
    );
  return (
    <ActionForm
      action={action}
      hidden={{ ...hidden, waived: "true" }}
      submitLabel="Sim, tirar a taxa"
      variant="destructive"
      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
      aria-label="Tirar taxa de serviço"
    >
      <p className="basis-full text-sm">{`Tirar a taxa de serviço de ${brl(d(tab.serviceCharge))} desta conta?`}</p>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingVersion(null)}>
        Voltar
      </Button>
    </ActionForm>
  );
}

/** Porcentagem da taxa do restaurante (só gerente). Vazia desliga a taxa (FR-004). */
export function ServiceRateForm({
  rate,
  version,
  action,
}: {
  rate: string | null;
  version: number;
  action: Action;
}) {
  return (
    <ActionForm
      action={action}
      hidden={{ version }}
      submitLabel="Salvar taxa"
      successMessage="Taxa salva."
      aria-label="Taxa de serviço do restaurante"
    >
      <Field
        label="Taxa de serviço (%)"
        htmlFor="service-rate"
        hint="Vale para as contas que abrirem depois. Deixe vazio para não cobrar taxa."
      >
        <Input
          id="service-rate"
          name="rate"
          inputMode="decimal"
          className="w-28"
          defaultValue={rate === null ? "" : formatBrDecimal(d(rate), { minPlaces: 0, maxPlaces: 2 })}
        />
      </Field>
    </ActionForm>
  );
}
