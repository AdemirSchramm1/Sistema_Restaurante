"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import {
  createGroup,
  createSubgroup,
  renameGroup,
  renameSubgroup,
  setGroupActive,
  setSubgroupActive,
} from "@/application/inventory/groups";
import type { StorageClass } from "@/domain/inventory/default-tree";
import { withContext, type ActionState } from "./_session";

const PATH = "/estoque/grupos";
const STORAGE: readonly StorageClass[] = ["FOOD", "CHEMICAL", "OTHER_NON_FOOD"];
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);

async function done<T>(state: ActionState<T>) {
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function createGroupAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const storageClass = str(f, "storageClass") as StorageClass;
  return done(
    await withContext(async (ctx) => {
      if (!STORAGE.includes(storageClass))
        return { ok: false, error: { code: "VALIDATION", field: "storageClass" } };
      return createGroup(serverDeps(), ctx, {
        name: str(f, "name"),
        storageClass,
        inCogs: f.get("inCogs") === "on",
      });
    }),
  );
}

export async function createSubgroupAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      createSubgroup(serverDeps(), ctx, { groupId: str(f, "groupId"), name: str(f, "name") }),
    ),
  );
}

export async function renameGroupAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      renameGroup(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "name")),
    ),
  );
}

export async function renameSubgroupAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      renameSubgroup(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "name")),
    ),
  );
}

export async function setGroupActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      setGroupActive(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "active") === "true"),
    ),
  );
}

export async function setSubgroupActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      setSubgroupActive(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "active") === "true"),
    ),
  );
}
