import Link from "next/link";
import { Eye, Plus, UtensilsCrossed } from "lucide-react";
import type { BoardProduct, BoardSection, MenuBoard as Board } from "@/application/menu/board";
import { photoUrl } from "@/domain/menu/photo";
import { brl } from "@/components/ordering/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MoveButtons, type FormAction } from "./move-buttons";
import { DeleteSection, NewSectionForm, RenameSectionForm } from "./section-form";

export type MenuBoardActions = {
  createSection: FormAction;
  renameSection: FormAction;
  moveSection: FormAction;
  deleteSection: FormAction;
  moveProduct: FormAction;
};

function ProductRow({ product }: { product: BoardProduct }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      {product.photo && (
        // Foto já tratada no envio, em WebP e nas larguras certas (research R5): <img> direto.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-photo
          src={photoUrl(product.photo, 300)}
          alt={`Foto de ${product.name}`}
          width={120}
          height={90}
          loading="lazy"
          className="aspect-[4/3] h-auto w-16 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="grid min-w-0 flex-1 basis-40 gap-1">
        <Link
          href={`/pedidos/cardapio/${product.id}`}
          className="flex min-h-11 items-center rounded-md font-medium underline-offset-4 [overflow-wrap:anywhere] hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {product.name}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {product.price ? (
            <span className="tabular-nums text-muted-foreground">{brl(product.price)}</span>
          ) : (
            <Badge tone="warning">Sem preço</Badge>
          )}
          {!product.active && <Badge tone="neutral">Inativo</Badge>}
          {product.soldOutToday && <Badge tone="danger">Esgotado hoje</Badge>}
          {!product.photo && <Badge tone="info">Sem foto</Badge>}
        </div>
      </div>
    </li>
  );
}

function Section({ section, actions }: { section: BoardSection; actions: MenuBoardActions }) {
  const titleId = `secao-${section.id ?? "outros"}`;
  return (
    <section aria-labelledby={titleId} className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="min-w-0 font-display text-xl font-semibold [overflow-wrap:anywhere]">
          {section.name}
        </h2>
        {section.id !== null && (
          <MoveButtons
            id={section.id}
            name={section.name}
            canMoveUp={section.canMoveUp}
            canMoveDown={section.canMoveDown}
            action={actions.moveSection}
          />
        )}
      </div>
      {section.id === null || section.version === null ? (
        <p className="text-sm text-muted-foreground">
          Produtos sem seção. Abra o produto para escolher a seção dele.
        </p>
      ) : (
        <>
          <details className="group">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              Renomear ou apagar
            </summary>
            <div className="grid gap-3 pt-2">
              <RenameSectionForm
                key={`${section.id}-${section.version}`}
                section={{ id: section.id, name: section.name, version: section.version }}
                action={actions.renameSection}
              />
              <DeleteSection
                section={{ id: section.id, name: section.name, productCount: section.products.length }}
                action={actions.deleteSection}
              />
            </div>
          </details>
        </>
      )}
      {section.products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto nesta seção.</p>
      ) : (
        <ul className="grid divide-y divide-border">
          {section.products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tela Cardápio da equipe (spec 013, US2): seções na ordem, produtos de cada uma e os atalhos. */
export function MenuBoard({
  board,
  actions,
  canCreateProduct,
}: {
  board: Board;
  actions: MenuBoardActions;
  canCreateProduct: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {canCreateProduct && (
          <Link href="/pedidos/cardapio/novo" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden="true" />
            Novo produto
          </Link>
        )}
        <Link href="/pedidos/cardapio/ver" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <Eye aria-hidden="true" />
          Ver como o cliente
        </Link>
      </div>
      <NewSectionForm action={actions.createSection} />
      {board.sections.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="O cardápio ainda está vazio">
          Crie a primeira seção, como Lanches ou Bebidas, e depois ponha os produtos nela.
        </EmptyState>
      ) : (
        board.sections.map((s) => <Section key={s.id ?? "outros"} section={s} actions={actions} />)
      )}
    </div>
  );
}
