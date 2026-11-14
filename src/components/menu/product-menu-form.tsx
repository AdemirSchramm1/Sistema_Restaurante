"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionError } from "@/actions/_session";
import type { MenuProductView } from "@/application/menu/details";
import { useFormAction } from "@/components/forms/use-form-action";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OTHER_SECTION } from "@/domain/menu/section";
import { DescriptionField } from "./description-field";
import { Problem, Saved, WRAPPING_BUTTON } from "./feedback";
import type { FormAction } from "./move-buttons";
import { PhotoField } from "./photo-field";

/** Nesta tela, a trava de edição ao mesmo tempo fala do produto e diz o que fazer. */
const messageOf = (error: ActionError) =>
  error.code === "STALE_RECORD" ? "Outra pessoa mudou este produto. Recarregue a tela." : error.message;

/** "28.00" do servidor vira "28,00" no campo. */
const brPrice = (price: string) => price.replace(".", ",");

/** Preço de venda (regras da 008): salva sozinho. Em branco tira o preço. */
function PriceForm({ product, action }: { product: MenuProductView; action: FormAction }) {
  const id = useId();
  const { pending, saved, error, formProps } = useFormAction(action);
  return (
    <form {...formProps} aria-label="Preço" className="grid max-w-prose gap-1.5">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="version" value={product.version} />
      <Label htmlFor={id}>Preço (R$)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          name="salePrice"
          size="lg"
          inputMode="decimal"
          className="min-w-0 flex-1 basis-32"
          defaultValue={product.price ? brPrice(product.price) : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-dica ${id}-erro` : `${id}-dica`}
        />
        <Button type="submit" variant="outline" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
          Salvar preço
        </Button>
        {saved && <Saved />}
      </div>
      <p id={`${id}-dica`} className="text-sm text-muted-foreground">
        Em branco, o produto fica sem preço e não aparece para o cliente.
      </p>
      {error && <Problem id={`${id}-erro`}>{messageOf(error)}</Problem>}
    </form>
  );
}

/** "Esgotado hoje" (regra da 009): tira o produto do cardápio só até o fim do dia. */
function SoldOutForm({ product, action }: { product: MenuProductView; action: FormAction }) {
  const { pending, saved, error, formProps } = useFormAction(action);
  return (
    <form {...formProps} aria-label="Disponibilidade de hoje" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="recipeId" value={product.id} />
      <input type="hidden" name="soldOut" value={String(!product.soldOutToday)} />
      {product.soldOutToday && <Badge tone="danger">Esgotado hoje</Badge>}
      <Button type="submit" variant="outline" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
        {product.soldOutToday ? "Disponível de novo" : "Marcar como esgotado hoje"}
      </Button>
      {saved && <Saved />}
      {error && <Problem>{messageOf(error)}</Problem>}
    </form>
  );
}

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
      <DescriptionField defaultValue={product.description} error={onDescription ? messageOf(error) : null} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" className={WRAPPING_BUTTON} disabled={pending}>
          Salvar descrição e seção
        </Button>
        {saved && <Saved />}
        {error && !onDescription && <Problem>{messageOf(error)}</Problem>}
      </div>
    </form>
  );
}

/**
 * Tela do produto no Cardápio (spec 013, US1 e US4): foto, preço, "Esgotado hoje", descrição e
 * seção num lugar só. Cada parte salva sozinha, com o seu "Salvo". Quando a foto muda, a tela busca
 * o produto de novo para o próximo envio levar a versão atual.
 */
export function ProductMenuForm({
  product,
  canEditRecipe,
  canSellOut,
  actions,
}: {
  product: MenuProductView;
  /** `recipe.write`: muda o preço e abre o cadastro do produto (nome e ingredientes). */
  canEditRecipe: boolean;
  /** `product.sold_out`: marca e desmarca "Esgotado hoje". */
  canSellOut: boolean;
  actions: { setDetails: FormAction; removePhoto: FormAction; setPrice: FormAction; setSoldOut: FormAction };
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
      {canEditRecipe ? (
        <PriceForm product={product} action={actions.setPrice} />
      ) : (
        <p className="text-sm">{product.price ? `Preço: R$ ${brPrice(product.price)}` : "Sem preço"}</p>
      )}
      {canSellOut ? (
        <SoldOutForm product={product} action={actions.setSoldOut} />
      ) : (
        product.soldOutToday && <Badge tone="danger">Esgotado hoje</Badge>
      )}
      <DetailsForm product={product} action={actions.setDetails} />
      {canEditRecipe && (
        <Link
          href={`/estoque/produtos/${product.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), WRAPPING_BUTTON, "w-fit")}
        >
          Editar nome e ingredientes
        </Link>
      )}
    </div>
  );
}
