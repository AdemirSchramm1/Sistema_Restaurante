"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverDeps } from "@/infra/server";
import {
  applySuggestedLocations,
  createLocation,
  setLocationActive,
  updateLocation,
} from "@/application/inventory/locations";
import { parseLocationForm } from "@/application/inventory/location-input";
import { formDataToObject } from "@/application/inventory/item-input";
import { withContext, type ActionState } from "./_session";

const PATH = "/estoque/locais";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);
const parseLocation = (f: FormData) => parseLocationForm(formDataToObject(f));

async function done<T>(state: ActionState<T>) {
  if (state?.ok) revalidatePath(PATH);
  return state;
}

export async function createLocationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext(async (ctx) => {
      const data = parseLocation(f);
      return data.ok ? createLocation(serverDeps(), ctx, data.value) : data;
    }),
  );
}

export async function updateLocationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext(async (ctx) => {
      const data = parseLocation(f);
      return data.ok ? updateLocation(serverDeps(), ctx, str(f, "id"), int(f, "version"), data.value) : data;
    }),
  );
}

export async function setLocationActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return done(
    await withContext((ctx) =>
      setLocationActive(serverDeps(), ctx, str(f, "id"), int(f, "version"), str(f, "active") === "true"),
    ),
  );
}

export async function applySuggestedLocationsAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const keys = f.getAll("key").map(String);
  const state = await withContext((ctx) => applySuggestedLocations(serverDeps(), ctx, keys));
  if (state?.ok) {
    revalidatePath(PATH);
    redirect(PATH);
  }
  return state;
}
