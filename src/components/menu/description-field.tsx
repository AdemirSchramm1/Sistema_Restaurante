"use client";

import { useId, useState } from "react";
import { Label, Textarea } from "@/components/ui/input";
import { descriptionLength, MAX_DESCRIPTION } from "@/domain/menu/description";
import { Problem } from "./feedback";

const characters = (n: number) => (n === 1 ? "1 caractere" : `${n} caracteres`);

/**
 * Descrição do produto (spec 013, US1.6): texto simples com quebras de linha. O contador usa a
 * mesma conta do servidor; passar de 300 avisa na hora, sem cortar o que a pessoa escreveu.
 */
export function DescriptionField({
  defaultValue,
  error = null,
}: {
  defaultValue: string | null;
  error?: string | null;
}) {
  const id = useId();
  const [length, setLength] = useState(() => descriptionLength(defaultValue ?? ""));
  const left = MAX_DESCRIPTION - length;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Descrição</Label>
      <Textarea
        id={id}
        name="description"
        size="lg"
        rows={4}
        defaultValue={defaultValue ?? ""}
        onChange={(e) => setLength(descriptionLength(e.target.value))}
        aria-invalid={left < 0 || error ? true : undefined}
        aria-describedby={error ? `${id}-conta ${id}-erro` : `${id}-conta`}
      />
      <p
        id={`${id}-conta`}
        className={left < 0 ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}
      >
        {left < 0
          ? `Passou ${characters(-left)} do limite de ${MAX_DESCRIPTION}`
          : `${left === 1 ? "Falta" : "Faltam"} ${characters(left)}`}
      </p>
      {error && <Problem id={`${id}-erro`}>{error}</Problem>}
    </div>
  );
}
