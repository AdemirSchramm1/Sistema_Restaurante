"use client";

import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, FormError, fieldError } from "@/components/forms/form-error";
import type { ActionState } from "@/actions/_session";
import { WEEKDAY_LABELS, WEEKDAY_NAMES } from "@/domain/suppliers/supplier";
import type { SupplierFormValues } from "./supplier-form-values";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  initial: SupplierFormValues;
  meta?: { id: string; version: number };
  readOnly?: boolean;
  submitLabel: string;
};

/** Cadastro do fornecedor: só o nome é obrigatório (spec 007, US1). */
export function SupplierForm({ action, initial, meta, readOnly, submitLabel }: Props) {
  const { state, pending, formProps } = useFormAction(action);
  const error = state && !state.ok ? state.error : null;
  const fe = (f: string) => fieldError(error, f);
  const v = (k: string) => String(initial[k] ?? "");
  const days = new Set((initial.deliveryDays as string[] | undefined) ?? []);

  const text = (name: string, label: string, hint?: string, props: React.ComponentProps<"input"> = {}) => (
    <Field label={label} htmlFor={name} hint={hint} error={fe(name)}>
      <Input
        id={name}
        name={name}
        defaultValue={v(name)}
        aria-invalid={fe(name) ? true : undefined}
        {...props}
      />
    </Field>
  );

  return (
    <form {...formProps} className="grid gap-6" aria-label="Cadastro do fornecedor">
      {meta && (
        <>
          <input type="hidden" name="id" value={meta.id} />
          <input type="hidden" name="version" value={meta.version} />
        </>
      )}
      <FormError error={error} />
      {state?.ok && <Alert tone="success">Alterações salvas.</Alert>}

      <fieldset disabled={readOnly} className="grid gap-6">
        <Card className="grid gap-4">
          <CardTitle>Quem é</CardTitle>
          {text(
            "name",
            "Nome do fornecedor",
            "Como a equipe chama. Ex.: Hortifruti do João, Açougue Boi Bom",
            {
              required: true,
              minLength: 3,
              maxLength: 120,
            },
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("legalName", "Razão social (opcional)", "Como está na nota fiscal.", { maxLength: 120 })}
            {text(
              "cnpj",
              "CNPJ (opcional)",
              "Ex.: 11.222.333/0001-81. Feirante sem CNPJ pode deixar em branco.",
              {
                maxLength: 18,
                autoComplete: "off",
              },
            )}
          </div>
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Contato</CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            {text("contactName", "Nome do vendedor", undefined, { maxLength: 120 })}
            {text("phone", "Telefone ou WhatsApp", "Ex.: (11) 99999-0000", {
              maxLength: 40,
              inputMode: "tel",
            })}
            {text("email", "E-mail", undefined, { maxLength: 120, type: "email" })}
          </div>
        </Card>

        <Card className="grid gap-4">
          <CardTitle>Entrega e pagamento</CardTitle>
          <fieldset className="grid gap-2" aria-describedby="deliveryDays-hint">
            <legend className="text-sm font-medium">Dias de entrega</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_LABELS.map((label, day) => (
                <label key={label} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    name="deliveryDays"
                    value={String(day)}
                    defaultChecked={days.has(String(day))}
                    aria-label={WEEKDAY_NAMES[day]}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p id="deliveryDays-hint" className="text-xs text-muted-foreground">
              Em que dias ele costuma entregar.
            </p>
            {fe("deliveryDays") && (
              <p className="text-xs text-destructive" role="alert">
                {fe("deliveryDays")}
              </p>
            )}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            {text(
              "leadTimeDays",
              "Entrega em quantos dias",
              "Depois do pedido. Ex.: 1 (entrega no dia seguinte)",
              {
                inputMode: "numeric",
                className: "sm:w-32",
              },
            )}
            {text("minOrderValue", "Pedido mínimo (R$)", "Ex.: 150,00", {
              inputMode: "decimal",
              className: "sm:w-40",
            })}
            {text("paymentTerms", "Como paga", "Ex.: Boleto 28 dias, PIX na entrega", { maxLength: 200 })}
          </div>
          {text("notes", "Observação", undefined, { maxLength: 1000 })}
        </Card>
      </fieldset>

      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
