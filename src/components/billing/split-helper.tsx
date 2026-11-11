"use client";

import { useState } from "react";
import { MAX_PEOPLE, MIN_PEOPLE, splitEvenly } from "@/domain/billing/split";
import { d, type Decimal } from "@/domain/shared/decimal";
import { ERROR_MESSAGES } from "@/components/forms/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/components/ordering/format";

/**
 * Dividir a conta (spec 011, US3): partes iguais sobre o que falta, os centavos que sobram na
 * primeira. "Pagar parte 1 de 3" só preenche o valor do pagamento; nada é gravado. Quando a parte
 * escolhida é paga, as outras são refeitas sobre o novo falta; mudar o número de pessoas recomeça.
 */
export function SplitHelper({ remaining, onPick }: { remaining: string; onPick: (amount: string) => void }) {
  const [peopleText, setPeopleText] = useState("");
  const [paidParts, setPaidParts] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  // O falta mudou: se caiu exatamente a parte escolhida, essa parte foi paga.
  const [seen, setSeen] = useState(remaining);
  if (seen !== remaining) {
    setSeen(remaining);
    if (picked !== null && d(seen).minus(d(remaining)).equals(d(picked))) setPaidParts(paidParts + 1);
    setPicked(null);
  }

  const people = /^\d+$/.test(peopleText) ? Number.parseInt(peopleText, 10) : null;
  const invalid = people !== null && (people < MIN_PEOPLE || people > MAX_PEOPLE);
  const left = people !== null && !invalid ? Math.max(1, people - paidParts) : 0;
  const owed = d(remaining);
  let parts: Decimal[] = [];
  if (left === 1 && owed.gt(0)) parts = [owed];
  else if (left > 1 && owed.gt(0)) {
    const r = splitEvenly(owed, left);
    if (r.ok) parts = r.value;
  }
  const first = (people ?? 0) - parts.length + 1;

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium">
        Dividir por quantas pessoas?
        <Input
          type="number"
          inputMode="numeric"
          min={MIN_PEOPLE}
          max={MAX_PEOPLE}
          className="w-24"
          value={peopleText}
          onChange={(e) => {
            setPeopleText(e.target.value);
            setPaidParts(0);
            setPicked(null);
          }}
        />
      </label>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES.INVALID_PEOPLE}
        </p>
      )}
      {parts.length > 0 && (
        <ul className="grid gap-1">
          {parts.map((part, i) => {
            const n = first + i;
            return (
              <li key={n} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{`Parte ${n} de ${people}: ${brl(part)}`}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPicked(part.toFixed(2));
                    onPick(part.toFixed(2));
                  }}
                >
                  {`Pagar parte ${n} de ${people}`}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Ou digite qualquer valor no pagamento.</p>
    </div>
  );
}
