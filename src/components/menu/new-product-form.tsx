"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ActionError } from "@/actions/_session";
import { messageFor } from "@/components/forms/error-messages";
import { fieldError } from "@/components/forms/form-error";
import { RecipeLines, type ComponentOption } from "@/components/recipes/recipe-lines";
import { emptyLine } from "@/components/recipes/recipe-form-values";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { OTHER_SECTION } from "@/domain/menu/section";
import { DescriptionField } from "./description-field";
import { Problem, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";
import { FileButton, PHOTO_BOX } from "./photo-field";
import { reducePhoto } from "./reduce-photo";
import { uploadPhoto } from "./upload-photo";

const BOARD = "/pedidos/cardapio";
/** Campos que mostram o próprio erro; o resto aparece junto do botão. */
const OWN_ERROR = /^(name|salePrice|description|lines(\..+)?)$/;
const NO_ANSWER = "Não foi possível criar o produto. Tente de novo.";

type Chosen = { file: Blob; preview: string };

/** Campo com rótulo e o erro do servidor ligado a ele. */
function TextField({
  label,
  name,
  error,
  ...input
}: { label: string; name: string; error: string | null } & Omit<
  React.ComponentProps<typeof Input>,
  "id" | "size" | "name"
>) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        size="lg"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
        {...input}
      />
      {error && <Problem id={`${id}-erro`}>{error}</Problem>}
    </div>
  );
}

/**
 * Produto novo pela tela Cardápio (spec 013, US4): o cadastro da 003 (nome e o que vai nele) com
 * preço, seção, descrição e foto. O produto é criado primeiro; a foto vai em seguida. Se a foto
 * não chegar, o produto já está salvo e a tela dele abre avisando.
 */
export function NewProductForm({
  options,
  sections,
  action,
  reduce = reducePhoto,
  upload = uploadPhoto,
}: {
  options: { items: ComponentOption[]; preps: ComponentOption[] };
  sections: { id: string; name: string }[];
  action: FormAction;
  reduce?: typeof reducePhoto;
  upload?: typeof uploadPhoto;
}) {
  const router = useRouter();
  const sectionId = useId();
  const [photo, setPhoto] = useState<Chosen | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [noAnswer, setNoAnswer] = useState(false);
  const fe = (field: string) => fieldError(error, field);

  const choose = (next: Chosen | null) => {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(next);
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhotoError(null);
    const ready = await reduce(file);
    input.value = "";
    if (!ready.ok) return setPhotoError(messageFor(ready.error));
    choose({ file: ready.value, preview: URL.createObjectURL(ready.value) });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNoAnswer(false);
    const state = await action(null, new FormData(e.currentTarget));
    if (!state?.ok) {
      setPending(false);
      return state ? setError(state.error) : setNoAnswer(true);
    }
    const { id } = state.data as { id: string };
    if (!photo) return router.push(BOARD);
    setPercent(0);
    const sent = await upload({ recipeId: id, file: photo.file, onProgress: setPercent });
    router.push(sent.ok ? BOARD : `${BOARD}/${id}?foto=falhou`);
  };

  return (
    <form onSubmit={onSubmit} aria-label="Produto novo" className="grid max-w-prose gap-6">
      <TextField
        label="Nome do produto"
        name="name"
        error={fe("name")}
        required
        minLength={3}
        maxLength={120}
      />

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">O que vai nele</legend>
        <RecipeLines options={options} initial={[emptyLine]} kind="DISH" fe={fe} touch />
      </fieldset>

      <TextField label="Preço (R$)" name="salePrice" error={fe("salePrice")} inputMode="decimal" />

      <div className="grid gap-1.5">
        <Label htmlFor={sectionId}>Seção</Label>
        <Select id={sectionId} name="sectionId" size="lg" defaultValue="">
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="">{OTHER_SECTION}</option>
        </Select>
      </div>

      <DescriptionField defaultValue={null} error={fe("description")} />

      <section aria-label="Foto" className="grid gap-3">
        <div className={PHOTO_BOX}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local, ainda não está no servidor
            <img data-photo src={photo.preview} alt="Prévia da foto" className="size-full object-cover" />
          ) : (
            <p className="grid size-full place-items-center text-sm text-muted-foreground">Sem foto</p>
          )}
        </div>
        {percent !== null && (
          <div
            role="progressbar"
            aria-label="Enviando a foto"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <FileButton label={photo ? "Trocar foto" : "Escolher foto"} onPick={onPick} />
          <FileButton label="Tirar foto com a câmera" camera onPick={onPick} />
          {photo && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={WRAPPING_BUTTON}
              onClick={() => choose(null)}
            >
              Tirar esta foto
            </Button>
          )}
        </div>
        {photoError && <Problem>{photoError}</Problem>}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
          Criar produto
        </Button>
        {error && !OWN_ERROR.test(error.field ?? "") && <Problem>{error.message}</Problem>}
        {noAnswer && <Problem>{NO_ANSWER}</Problem>}
      </div>
    </form>
  );
}
