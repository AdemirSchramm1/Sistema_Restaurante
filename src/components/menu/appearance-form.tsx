"use client";

import { useState, type ChangeEvent } from "react";
import type { Appearance, AppearanceKind } from "@/application/menu/ports";
import { messageFor } from "@/components/forms/error-messages";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { photoSrcSet, photoUrl, type Photo } from "@/domain/menu/photo";
import { cn } from "@/lib/utils";
import { Problem, Saved, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";
import { FileButton } from "./photo-field";
import { browserPhotoTools, reducePhoto } from "./reduce-photo";
import { uploadPhoto } from "./upload-photo";

/** Textos e recorte de cada imagem (spec 016, R8): o logo 1:1 e a capa 3:1, como no cardápio. */
const TEXTS: Record<
  AppearanceKind,
  {
    title: string;
    box: string;
    empty: string;
    pick: string;
    change: string;
    save: string;
    preview: string;
    current: string;
    saved: string;
    removed: string;
    remove: string;
    ask: string;
    confirm: string;
    sizes: string;
  }
> = {
  LOGO: {
    title: "Logo",
    box: "aspect-square w-40",
    empty: "Sem logo",
    pick: "Escolher logo",
    change: "Trocar logo",
    save: "Salvar logo",
    preview: "Prévia do logo",
    current: "Logo do restaurante",
    saved: "Logo salvo",
    removed: "Logo tirado do cardápio",
    remove: "Tirar logo",
    ask: "Tirar o logo do cardápio?",
    confirm: "Tirar o logo",
    sizes: "160px",
  },
  COVER: {
    title: "Foto de capa",
    box: "aspect-[3/1] w-full max-w-xl",
    empty: "Sem foto de capa",
    pick: "Escolher foto de capa",
    change: "Trocar foto de capa",
    save: "Salvar foto de capa",
    preview: "Prévia da foto de capa",
    current: "Foto de capa",
    saved: "Foto de capa salva",
    removed: "Foto de capa tirada do cardápio",
    remove: "Tirar foto de capa",
    ask: "Tirar a foto de capa do cardápio?",
    confirm: "Tirar a foto de capa",
    sizes: "(min-width: 640px) 576px, 100vw",
  },
};

function Remove({ kind, action }: { kind: AppearanceKind; action: FormAction }) {
  const t = TEXTS[kind];
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
        {t.remove}
      </Button>
    );
  return (
    <form
      {...formProps}
      role="group"
      aria-label={t.ask}
      className="flex basis-full flex-wrap items-center gap-2 rounded-lg bg-danger-soft p-3 text-danger-soft-foreground"
    >
      <input type="hidden" name="kind" value={kind} />
      <p className="basis-full text-sm font-medium">{t.ask}</p>
      <Button type="submit" variant="destructive" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        {t.confirm}
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

function AppearanceImage({
  kind,
  photo,
  removeAction,
  reduce,
  upload,
}: {
  kind: AppearanceKind;
  photo: Photo | null;
  removeAction: FormAction;
  reduce: typeof reducePhoto;
  upload: typeof uploadPhoto;
}) {
  const t = TEXTS[kind];
  const [changed, setChanged] = useState<{ photo: Photo | null } | null>(null);
  const [draft, setDraft] = useState<{ file: Blob; preview: string; percent: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = changed ? changed.photo : photo;
  const sending = draft !== null && draft.percent !== null;

  const discard = (chosen: { preview: string }) => {
    URL.revokeObjectURL(chosen.preview);
    setDraft(null);
  };
  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    const ready = await reduce(file, browserPhotoTools, kind);
    input.value = "";
    if (!ready.ok) return setError(messageFor(ready.error));
    setDraft({ file: ready.value, preview: URL.createObjectURL(ready.value), percent: null });
  };
  const save = async (chosen: { file: Blob; preview: string }) => {
    setError(null);
    setDraft({ ...chosen, percent: 0 });
    const sent = await upload({
      kind,
      file: chosen.file,
      onProgress: (percent) => setDraft({ ...chosen, percent }),
    });
    if (!sent.ok) {
      setDraft({ ...chosen, percent: null });
      return setError(messageFor(sent.error));
    }
    discard(chosen);
    setChanged({ photo: sent.value });
  };
  const remove: FormAction = async (prev, form) => {
    const state = await removeAction(prev, form);
    if (state?.ok) setChanged({ photo: null });
    return state;
  };

  return (
    <section aria-label={t.title} className="grid content-start gap-3">
      <h3 className="font-medium">{t.title}</h3>
      <div className={cn("overflow-hidden rounded-lg border border-border bg-muted", t.box)}>
        {draft ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local, ainda não está no servidor
          <img src={draft.preview} alt={t.preview} className="size-full object-cover" />
        ) : current ? (
          // eslint-disable-next-line @next/next/no-img-element -- variantes prontas da loja de fotos
          <img
            src={photoUrl(current, current.widths.at(-1)!)}
            srcSet={photoSrcSet(current)}
            sizes={t.sizes}
            alt={t.current}
            className="size-full object-cover"
          />
        ) : (
          <p className="grid size-full place-items-center p-2 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        )}
      </div>
      {draft && draft.percent !== null && (
        <div
          role="progressbar"
          aria-label={`Enviando: ${t.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={draft.percent}
          className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${draft.percent}%` }} />
        </div>
      )}
      {draft ? (
        <div role="group" aria-label={t.preview} className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className={WRAPPING_BUTTON}
            disabled={sending}
            onClick={() => save(draft)}
          >
            {t.save}
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
          <FileButton label={current ? t.change : t.pick} onPick={onPick} />
          {current && <Remove kind={kind} action={remove} />}
        </div>
      )}
      {changed && !draft && !error && <Saved>{changed.photo ? t.saved : t.removed}</Saved>}
      {error && <Problem>{error}</Problem>}
    </section>
  );
}

/**
 * Quadro **Aparência** da tela Cardápio (spec 016, US1): o logo e a foto de capa que aparecem no
 * topo do cardápio do cliente e nas boas-vindas do tablet. Só para quem tem `menu.appearance`.
 */
export function AppearanceForm({
  appearance,
  removeAction,
  reduce = reducePhoto,
  upload = uploadPhoto,
}: {
  appearance: Appearance;
  removeAction: FormAction;
  reduce?: typeof reducePhoto;
  upload?: typeof uploadPhoto;
}) {
  return (
    <section
      aria-label="Aparência"
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="grid gap-1">
        <h2 className="font-display text-xl font-semibold">Aparência</h2>
        <p className="text-sm text-muted-foreground">
          O logo e a foto de capa aparecem no topo do cardápio do cliente e no tablet da mesa.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <AppearanceImage
          kind="LOGO"
          photo={appearance.logo}
          removeAction={removeAction}
          reduce={reduce}
          upload={upload}
        />
        <AppearanceImage
          kind="COVER"
          photo={appearance.cover}
          removeAction={removeAction}
          reduce={reduce}
          upload={upload}
        />
      </div>
    </section>
  );
}
