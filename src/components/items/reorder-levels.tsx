"use client";

import { useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import type { ActionState } from "@/actions/_session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/forms/form-error";

export type ReorderLevelsProps = {
  id: string;
  version: number;
  unit: string;
  /** Valores já formatados com vírgula; `null` = em branco. */
  reorderPoint: string | null;
  parLevel: string | null;
  atReorderPoint: boolean;
  suggestion: {
    reorderPoint: string;
    parLevel: string;
    averageDailyUsage: string;
    leadTimeDays: number;
    cycleDays: string;
  } | null;
  canEdit: boolean;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
};

/** Quadro "Aviso de reposição" da página do item (spec 006, US1). */
export function ReorderLevels(p: ReorderLevelsProps) {
  const { state, pending, saved, formProps } = useFormAction(p.action);
  const [point, setPoint] = useState(p.reorderPoint ?? "");
  const [par, setPar] = useState(p.parLevel ?? "");
  const s = p.suggestion;
  const days = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

  return (
    <Card className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Aviso de reposição</CardTitle>
        {p.atReorderPoint && <Badge tone="warning">Chegou no ponto: comprar</Badge>}
      </div>
      <p className="text-muted-foreground">
        Quando o estoque chegar no número abaixo, o item aparece em &quot;Repor&quot;.
      </p>
      {!p.canEdit &&
        (p.reorderPoint === null ? (
          <p>Aviso desligado.</p>
        ) : (
          <>
            <p>
              Avisar quando chegar em: {p.reorderPoint} {p.unit}
            </p>
            {p.parLevel && (
              <p>
                Comprar até: {p.parLevel} {p.unit}
              </p>
            )}
          </>
        ))}
      {p.canEdit && (
        <form {...formProps} className="grid gap-2">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="version" value={p.version} />
          <label htmlFor="reorder-point" className="font-medium">
            Avisar quando chegar em ({p.unit})
          </label>
          <Input
            id="reorder-point"
            name="reorderPoint"
            inputMode="decimal"
            placeholder="Ex.: 10 (em branco = sem aviso)"
            value={point}
            onChange={(e) => setPoint(e.target.value)}
          />
          <label htmlFor="par-level" className="font-medium">
            Comprar até ({p.unit})
          </label>
          <Input
            id="par-level"
            name="parLevel"
            inputMode="decimal"
            placeholder="Ex.: 30 (quanto quer ter depois da compra)"
            value={par}
            onChange={(e) => setPar(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Salvar aviso
          </Button>
          <FormError error={state && !state.ok ? state.error : null} />
          {saved && <p role="status">Aviso salvo.</p>}
        </form>
      )}
      {s ? (
        <div className="grid gap-1 rounded-md bg-muted p-3">
          <p>
            <strong>Sugestão do sistema:</strong> avisar em {s.reorderPoint} {p.unit} e comprar até{" "}
            {s.parLevel} {p.unit}.
          </p>
          <p className="text-muted-foreground">
            Pelo consumo dos últimos 30 dias ({s.averageDailyUsage} {p.unit} por dia), entrega em{" "}
            {days(s.leadTimeDays)} e uma entrega a cada {s.cycleDays} dias, com 20% de folga.
          </p>
          {p.canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setPoint(s.reorderPoint);
                setPar(s.parLevel);
              }}
            >
              Usar sugestão
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">
          A sugestão aparece quando o item tiver saídas nos últimos 30 dias (perdas, acertos e, em breve,
          pedidos).
        </p>
      )}
    </Card>
  );
}
