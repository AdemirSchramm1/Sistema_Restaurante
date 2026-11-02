import type { Result } from "@/domain/shared/result";
import type { DefaultGroup, StorageClass } from "@/domain/inventory/default-tree";
import type { Item, ItemData, ItemType } from "@/domain/inventory/item";
import type { Audit } from "../access/ports";

export type GroupRecord = {
  id: string;
  code: string;
  name: string;
  storageClass: StorageClass;
  inCogs: boolean;
  isSystem: boolean;
  active: boolean;
  version: number;
};
export type SubgroupRecord = {
  id: string;
  groupId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  activeItems: number;
};
export type GroupTree = (GroupRecord & { subgroups: SubgroupRecord[] })[];

export interface GroupRepo {
  seedDefaultTree(tree: readonly DefaultGroup[], ids: () => string, audit: Audit): Promise<void>;
  tree(includeInactive: boolean): Promise<GroupTree>;
  getGroup(id: string): Promise<GroupRecord | null>;
  getSubgroup(id: string): Promise<(SubgroupRecord & { group: GroupRecord }) | null>;
  /** Reserva o próximo número (com lock de linha) e devolve o valor reservado. */
  takeNextGroupCode(): Promise<number>;
  takeNextSubgroupCode(groupId: string): Promise<number>;
  insertGroup(g: Omit<GroupRecord, "version" | "isSystem" | "active">, audit: Audit): Promise<Result<void>>;
  insertSubgroup(
    s: { id: string; groupId: string; code: string; name: string },
    audit: Audit,
  ): Promise<Result<void>>;
  renameGroup(id: string, name: string, version: number, audit: Audit): Promise<Result<void>>;
  renameSubgroup(id: string, name: string, version: number, audit: Audit): Promise<Result<void>>;
  setGroupActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  setSubgroupActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
}

export type ItemFilter = {
  q?: string;
  groupId?: string;
  subgroupId?: string;
  type?: ItemType;
  status?: "active" | "inactive" | "all";
  page: number;
  pageSize: number;
};
export type ItemListRow = Pick<
  Item,
  "id" | "code" | "description" | "type" | "active" | "stockUnit" | "purchaseUnitLabel" | "purchaseFactor"
> & {
  groupName: string;
  subgroupName: string;
};

export interface ItemRepo {
  /** Reserva o próximo sequencial do subgrupo (com lock de linha). */
  takeNextItemSeq(subgroupId: string): Promise<number>;
  insert(
    item: ItemData & { id: string; code: string; descriptionNormalized: string },
    audit: Audit,
  ): Promise<Result<void>>;
  update(
    id: string,
    data: ItemData & { descriptionNormalized: string },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  get(id: string): Promise<Item | null>;
  list(filter: ItemFilter): Promise<{ rows: ItemListRow[]; total: number }>;
  findActiveByDescription(
    subgroupId: string,
    normalized: string,
    exceptId?: string,
  ): Promise<{ id: string; code: string } | null>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  setCogsOverride(id: string, value: boolean | null, version: number, audit: Audit): Promise<Result<void>>;
  activeCountInSubgroup(subgroupId: string): Promise<number>;
}

export type CatalogRepos = {
  groups: GroupRepo;
  items: ItemRepo;
};
