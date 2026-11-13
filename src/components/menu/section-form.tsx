"use client";

import { useId, useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MAX_SECTION_NAME } from "@/domain/menu/section";
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
    <>
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
      {error && (
        <p id={`${id}-erro`} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function NewSectionForm({ action }: { action: FormAction }) {
  const { pending, saved, error, formProps } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form {...formProps} aria-label="Nova seção">
      <NameField label="Nome da seção nova" error={error?.message ?? null} />
      <Button type="submit" size="lg" disabled={pending}>
        Criar seção
      </Button>
      {saved && <p role="status">Seção criada</p>}
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
    <form {...formProps} aria-label={`Renomear ${section.name}`}>
      <input type="hidden" name="id" value={section.id} />
      <input type="hidden" name="version" value={section.version} />
      <NameField
        label={`Nome da seção ${section.name}`}
        defaultValue={section.name}
        error={error?.message ?? null}
      />
      <Button type="submit" variant="outline" size="lg" disabled={pending}>
        Salvar nome
      </Button>
      {saved && <p role="status">Salvo</p>}
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
      <Button type="button" variant="outline" size="lg" onClick={() => setAsking(true)}>
        Apagar {section.name}
      </Button>
    );
  return (
    <form {...formProps} role="group" aria-label={`Apagar a seção ${section.name}?`}>
      <input type="hidden" name="id" value={section.id} />
      <p>{destination(section.name, section.productCount)}</p>
      <Button type="submit" variant="destructive" size="lg" disabled={pending}>
        Apagar seção
      </Button>
      <Button type="button" variant="outline" size="lg" onClick={() => setAsking(false)}>
        Cancelar
      </Button>
      {error && <p role="alert">{error.message}</p>}
    </form>
  );
}
