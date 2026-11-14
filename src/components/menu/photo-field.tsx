"use client";

import { useId, useState, type ChangeEvent } from "react";
import { messageFor } from "@/components/forms/error-messages";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { photoSrcSet, photoUrl, type Photo } from "@/domain/menu/photo";
import { Problem, Saved, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";
import { reducePhoto } from "./reduce-photo";
import { uploadPhoto } from "./upload-photo";

export const PHOTO_BOX =
  "aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Botão que abre a escolha de arquivo. O campo de verdade fica dentro do rótulo, invisível mas
 * alcançável pelo teclado; o anel de foco aparece no rótulo.
 */
export function FileButton({
  label,
  camera = false,
  onPick,
}: {
  label: string;
  camera?: boolean;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        WRAPPING_BUTTON,
        "cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
      )}
    >
      {label}
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={ACCEPT}
        capture={camera ? "environment" : undefined}
        onChange={onPick}
      />
    </label>
  );
}

/** Tirar a foto do cardápio pede confirmação (US1.5). */
function RemovePhoto({ recipeId, name, action }: { recipeId: string; name: string; action: FormAction }) {
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
        Tirar foto do cardápio
      </Button>
    );
  return (
    <form
      {...formProps}
      role="group"
      aria-label={`Tirar a foto de ${name} do cardápio?`}
      className="flex basis-full flex-wrap items-center gap-2 rounded-lg bg-danger-soft p-3 text-danger-soft-foreground"
    >
      <input type="hidden" name="id" value={recipeId} />
      <p className="basis-full text-sm font-medium">Tirar a foto de {name} do cardápio?</p>
      <Button type="submit" variant="destructive" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        Tirar a foto
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

/**
 * Foto do produto na tela do Cardápio (spec 013, US1.1 a US1.5). A foto aparece no recorte 4:3 do
 * cartão do cliente antes de salvar. "Foto salva" só aparece com a resposta do servidor; se o envio
 * falha, a foto antiga continua valendo.
 */
export function PhotoField({
  recipeId,
  name,
  photo,
  removeAction,
  onSaved,
  reduce = reducePhoto,
  upload = uploadPhoto,
}: {
  recipeId: string;
  name: string;
  photo: Photo | null;
  removeAction: FormAction;
  /** A foto mudou no servidor: a tela busca o produto de novo. */
  onSaved?: () => void;
  reduce?: typeof reducePhoto;
  upload?: typeof uploadPhoto;
}) {
  /** O que o servidor confirmou depois que a tela abriu; até lá vale a foto que veio com ela. */
  const [changed, setChanged] = useState<{ photo: Photo | null } | null>(null);
  /** A foto escolhida, em prévia. `percent` só existe enquanto ela está sendo enviada. */
  const [draft, setDraft] = useState<{ file: Blob; preview: string; percent: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = changed ? changed.photo : photo;
  const sending = draft !== null && draft.percent !== null;

  const confirm = (next: Photo | null) => {
    setChanged({ photo: next });
    onSaved?.();
  };

  const discard = (chosen: { preview: string }) => {
    URL.revokeObjectURL(chosen.preview);
    setDraft(null);
    setError(null);
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    const ready = await reduce(file);
    // Deixa escolher o mesmo arquivo de novo depois de um erro.
    input.value = "";
    if (!ready.ok) return setError(messageFor(ready.error));
    setDraft({ file: ready.value, preview: URL.createObjectURL(ready.value), percent: null });
  };

  const save = async (chosen: { file: Blob; preview: string }) => {
    setError(null);
    setDraft({ ...chosen, percent: 0 });
    const sent = await upload({
      recipeId,
      file: chosen.file,
      onProgress: (percent) => setDraft({ ...chosen, percent }),
    });
    if (!sent.ok) {
      // A prévia fica para a pessoa tentar de novo sem escolher outra vez.
      setDraft({ ...chosen, percent: null });
      return setError(messageFor(sent.error));
    }
    discard(chosen);
    confirm(sent.value);
  };

  const remove: FormAction = async (prev, form) => {
    const state = await removeAction(prev, form);
    if (state?.ok) confirm(null);
    return state;
  };

  return (
    <section aria-label="Foto" className="grid gap-3">
      <div className={PHOTO_BOX}>
        {draft ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local, ainda não está no servidor
          <img data-photo src={draft.preview} alt="Prévia da foto nova" className="size-full object-cover" />
        ) : current ? (
          // eslint-disable-next-line @next/next/no-img-element -- as variantes já vêm prontas da loja de fotos
          <img
            data-photo
            src={photoUrl(current, 600)}
            srcSet={photoSrcSet(current)}
            sizes="(min-width: 640px) 384px, 100vw"
            width={600}
            height={450}
            alt={`Foto de ${name}`}
            className="size-full object-cover"
          />
        ) : (
          <p className="grid size-full place-items-center text-sm text-muted-foreground">Sem foto</p>
        )}
      </div>
      {draft && draft.percent !== null && (
        <div
          role="progressbar"
          aria-label="Enviando a foto"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={draft.percent}
          className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${draft.percent}%` }} />
        </div>
      )}
      {draft ? (
        <div role="group" aria-label="Foto nova" className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className={WRAPPING_BUTTON}
            disabled={sending}
            onClick={() => save(draft)}
          >
            Salvar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={WRAPPING_BUTTON}
            disabled={sending}
            onClick={() => discard(draft)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <FileButton label={current ? "Trocar foto" : "Escolher foto"} onPick={onPick} />
          <FileButton label="Tirar foto com a câmera" camera onPick={onPick} />
          {current && <RemovePhoto recipeId={recipeId} name={name} action={remove} />}
        </div>
      )}
      {changed && !draft && !error && (
        <Saved>{changed.photo ? "Foto salva" : "Foto tirada do cardápio"}</Saved>
      )}
      {error && <Problem>{error}</Problem>}
    </section>
  );
}
