"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import type { MenuProductView } from "@/application/menu/details";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { OTHER_SECTION } from "@/domain/menu/section";
import { DescriptionField } from "./description-field";
import { Problem, Saved, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";
import { PhotoField } from "./photo-field";

/** Descrição e seção salvam juntas; o "Salvo" só aparece com a resposta do servidor. */
function DetailsForm({ product, action }: { product: MenuProductView; action: FormAction }) {
  const sectionId = useId();
  const { pending, saved, error, formProps } = useFormAction(action);
  const onDescription = error?.field === "description";
  return (
    <form {...formProps} aria-label="Descrição e seção" className="grid max-w-prose gap-4">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="version" value={product.version} />
      <div className="grid gap-1.5">
        <Label htmlFor={sectionId}>Seção</Label>
        <Select id={sectionId} name="sectionId" size="lg" defaultValue={product.sectionId ?? ""}>
          {product.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="">{OTHER_SECTION}</option>
        </Select>
      </div>
      <DescriptionField defaultValue={product.description} error={onDescription ? error.message : null} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
          Salvar descrição e seção
        </Button>
        {saved && <Saved />}
        {error && !onDescription && <Problem>{error.message}</Problem>}
      </div>
    </form>
  );
}

/**
 * Tela do produto no Cardápio (spec 013, US1): foto, descrição e seção. Cada parte salva sozinha.
 * Quando a foto muda, a tela busca o produto de novo para o próximo envio levar a versão atual.
 */
export function ProductMenuForm({
  product,
  actions,
}: {
  product: MenuProductView;
  actions: { setDetails: FormAction; removePhoto: FormAction };
}) {
  const router = useRouter();
  return (
    <div className="grid gap-8">
      <PhotoField
        recipeId={product.id}
        name={product.name}
        photo={product.photo}
        removeAction={actions.removePhoto}
        onSaved={() => router.refresh()}
      />
      <DetailsForm product={product} action={actions.setDetails} />
    </div>
  );
}
