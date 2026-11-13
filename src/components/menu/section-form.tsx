"use client";

import { useId, useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MAX_SECTION_NAME } from "@/domain/menu/section";
import { Problem, Saved, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";

/** Campo do nome com o erro do servidor ligado a ele (spec 013, US2.1). */
function NameField({
  label,
  defaultValue,
  error,
}: {
  label: string;
  defaultValue?: string;
  error: string | null;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 flex-1 basis-48 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name="name"
        size="lg"
        defaultValue={defaultValue}
        maxLength={MAX_SECTION_NAME}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
      />
      {error && <Problem id={`${id}-erro`}>{error}</Problem>}
    </div>
  );
}

export function NewSectionForm({ action }: { action: FormAction }) {
  const { pending, saved, error, formProps } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form {...formProps} aria-label="Nova seção" className="flex flex-wrap items-end gap-2">
      <NameField label="Nome da seção nova" error={error?.message ?? null} />
      <Button type="submit" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        Criar seção
      </Button>
      {saved && <Saved>Seção criada</Saved>}
    </form>
  );
}

export function RenameSectionForm({
  section,
  action,
}: {
  section: { id: string; name: string; version: number };
  action: FormAction;
}) {
  const { pending, saved, error, formProps } = useFormAction(action);
  return (
    <form {...formProps} aria-label={`Renomear ${section.name}`} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={section.id} />
      <input type="hidden" name="version" value={section.version} />
      <NameField
        label={`Nome da seção ${section.name}`}
        defaultValue={section.name}
        error={error?.message ?? null}
      />
      <Button type="submit" variant="outline" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        Salvar nome
      </Button>
      {saved && <Saved />}
    </form>
  );
}

const destination = (name: string, count: number) =>
  count === 0
    ? `${name} não tem produtos`
    : count === 1
      ? `O produto de ${name} vai para Outros`
      : `Os ${count} produtos de ${name} vão para Outros`;

/** Apagar pede confirmação dizendo para onde vão os produtos (US2.6). */
export function DeleteSection({
  section,
  action,
}: {
  section: { id: string; name: string; productCount: number };
  action: FormAction;
}) {
  const [asking, setAsking] = useState(false);
  const { pending, error, formProps } = useFormAction(action);
  if (!asking)
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={WRAPPING_BUTTON}
        onClick={() => setAsking(true)}
      >
        Apagar {section.name}
      </Button>
    );
  return (
    <form
      {...formProps}
      role="group"
      aria-label={`Apagar a seção ${section.name}?`}
      className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft p-3 text-danger-soft-foreground"
    >
      <input type="hidden" name="id" value={section.id} />
      <p className="basis-full text-sm font-medium">{destination(section.name, section.productCount)}</p>
      <Button type="submit" variant="destructive" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        Apagar seção
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={WRAPPING_BUTTON}
        onClick={() => setAsking(false)}
      >
        Cancelar
      </Button>
      {error && <Problem>{error.message}</Problem>}
    </form>
  );
}
