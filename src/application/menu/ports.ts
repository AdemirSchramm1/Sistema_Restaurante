import type { Result } from "@/domain/shared/result";
import type { Audit } from "../access/ports";
import type { CustomerMenuRow } from "@/domain/menu/customer-menu";
import type { Photo } from "@/domain/menu/photo";

/** Portas da edição do cardápio (spec 013, contracts/use-cases.md). */

export type SectionRecord = {
  id: string;
  name: string;
  normalized: string;
  position: number;
  version: number;
};

/** Produto como a tela Cardápio e o cardápio do cliente leem. */
export type MenuProductRecord = CustomerMenuRow & { version: number };

export type PhotoVariant = { width: number; bytes: Uint8Array };

export interface MenuBoardRepo {
  /**
   * Trava as mudanças de ordem do cardápio deste restaurante até o fim da transação, para dois
   * movimentos ao mesmo tempo não repetirem posição.
   */
  lock(): Promise<void>;
  /** Seções na ordem de `position`. */
  sections(): Promise<SectionRecord[]>;
  insertSection(
    s: { id: string; name: string; normalized: string; position: number },
    audit: Audit,
  ): Promise<Result<void>>;
  renameSection(
    id: string,
    s: { name: string; normalized: string },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  /** Regrava as posições das seções: a primeira da lista fica em 1. */
  orderSections(ids: readonly string[]): Promise<void>;
  deleteSection(id: string): Promise<void>;
  /** Produtos vendidos (ativos ou não) na ordem de seção e posição, "Outros" no fim. */
  products(): Promise<MenuProductRecord[]>;
  /** Produto ou preparo pelo id (o caso de uso recusa preparo com `NOT_A_DISH`). */
  product(id: string): Promise<MenuProductRecord | null>;
  /** Põe os produtos na seção (ou em "Outros", com `null`) nesta ordem, a partir da posição 1. */
  placeProducts(sectionId: string | null, ids: readonly string[]): Promise<void>;
  /** Grava a descrição com trava otimista (sobe a `version`). */
  setDescription(
    id: string,
    description: string | null,
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  /** Grava ou limpa a foto, sem subir a `version`. */
  setPhoto(id: string, photo: Photo | null, audit: Audit): Promise<void>;
}

export interface PhotoProcessor {
  /** Lê pelo conteúdo, gira, recorta 4:3 no centro e gera WebP nas larguras pedidas pelo domínio. */
  process(bytes: Uint8Array): Promise<Result<{ variants: PhotoVariant[] }>>;
}

export interface PhotoStorage {
  /** Grava as variantes em menu/{photoId}/{largura}.webp e devolve a base do endereço. */
  put(photoId: string, variants: readonly PhotoVariant[]): Promise<{ base: string }>;
  remove(base: string, widths: readonly number[]): Promise<void>;
}

export type MenuRepos = { menuBoard: MenuBoardRepo };
