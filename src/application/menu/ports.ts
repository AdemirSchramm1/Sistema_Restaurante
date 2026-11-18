import type { Result } from "@/domain/shared/result";
import type { Audit } from "../access/ports";
import type { CustomerMenuRow } from "@/domain/menu/customer-menu";
import type { Photo, PhotoShape } from "@/domain/menu/photo";

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
  /** O nome único é conferido pelo caso de uso, com o cardápio travado. */
  insertSection(
    s: { id: string; name: string; normalized: string; position: number },
    audit: Audit,
  ): Promise<void>;
  /** Trava otimista: devolve `false` se a `version` já não é essa. */
  renameSection(
    id: string,
    s: { name: string; normalized: string },
    version: number,
    audit: Audit,
  ): Promise<boolean>;
  /** Regrava as posições das seções: a primeira da lista fica em 1. */
  orderSections(ids: readonly string[]): Promise<void>;
  deleteSection(id: string): Promise<void>;
  /** Produtos vendidos (ativos ou não) na ordem de seção e posição, "Outros" no fim. */
  products(): Promise<MenuProductRecord[]>;
  /** Produto ou preparo pelo id (o caso de uso recusa preparo com `NOT_A_DISH`). */
  product(id: string): Promise<MenuProductRecord | null>;
  /** Põe os produtos na seção (ou em "Outros", com `null`) nesta ordem, a partir da posição 1. */
  placeProducts(sectionId: string | null, ids: readonly string[]): Promise<void>;
  /** Grava a descrição e sobe a `version`. Trava otimista: `false` se a `version` já não é essa. */
  setDescription(id: string, description: string | null, version: number, audit: Audit): Promise<boolean>;
  /** Grava ou limpa a foto, sem subir a `version`. */
  setPhoto(id: string, photo: Photo | null, audit: Audit): Promise<void>;
  /** Logo e capa do restaurante (spec 016, R8). */
  appearance(): Promise<Appearance>;
  /** Grava ou tira o logo ou a capa; soma 1 na versão do restaurante (o tablet vê pelo carimbo). */
  setAppearance(kind: AppearanceKind, photo: Photo | null, audit: Audit): Promise<void>;
}

export interface PhotoProcessor {
  /**
   * Lê pelo conteúdo, gira, recorta no centro na proporção do formato (4:3 o prato; 1:1 o logo e
   * 3:1 a capa, spec 016) e gera WebP nas larguras pedidas pelo domínio.
   */
  process(bytes: Uint8Array, shape?: PhotoShape): Promise<Result<{ variants: PhotoVariant[] }>>;
}

export interface PhotoStorage {
  /** Grava as variantes em menu/{photoId}/{largura}.webp e devolve a base do endereço. */
  put(photoId: string, variants: readonly PhotoVariant[]): Promise<{ base: string }>;
  remove(base: string, widths: readonly number[]): Promise<void>;
}

export type MenuRepos = { menuBoard: MenuBoardRepo };

export type AppearanceKind = "LOGO" | "COVER";
export type Appearance = { logo: Photo | null; cover: Photo | null };
