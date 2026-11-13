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
    <li>
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
        />
      )}
      <Link href={`/pedidos/cardapio/${product.id}`}>{product.name}</Link>
      {product.price ? <span>{brl(product.price)}</span> : <Badge tone="warning">Sem preço</Badge>}
      {!product.active && <Badge tone="neutral">Inativo</Badge>}
      {product.soldOutToday && <Badge tone="danger">Esgotado hoje</Badge>}
      {!product.photo && <Badge tone="info">Sem foto</Badge>}
    </li>
  );
}

function Section({ section, actions }: { section: BoardSection; actions: MenuBoardActions }) {
  const titleId = `secao-${section.id ?? "outros"}`;
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>{section.name}</h2>
      {section.id === null || section.version === null ? (
        <p>Produtos sem seção. Abra o produto para escolher a seção dele.</p>
      ) : (
        <>
          <MoveButtons
            id={section.id}
            name={section.name}
            canMoveUp={section.canMoveUp}
            canMoveDown={section.canMoveDown}
            action={actions.moveSection}
          />
          <RenameSectionForm
            key={`${section.id}-${section.version}`}
            section={{ id: section.id, name: section.name, version: section.version }}
            action={actions.renameSection}
          />
          <DeleteSection
            section={{ id: section.id, name: section.name, productCount: section.products.length }}
            action={actions.deleteSection}
          />
        </>
      )}
      {section.products.length === 0 ? (
        <p>Nenhum produto nesta seção.</p>
      ) : (
        <ul>
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
    <div>
      <div>
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
