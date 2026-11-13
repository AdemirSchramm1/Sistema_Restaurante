"use client";

import type { Photo } from "@/domain/menu/photo";
import { reducePhoto } from "./reduce-photo";
import { uploadPhoto } from "./upload-photo";
import type { FormAction } from "./move-buttons";

/** Foto do produto na tela do Cardápio (spec 013, US1.1 a US1.5). */
export function PhotoField(_props: {
  recipeId: string;
  name: string;
  photo: Photo | null;
  removeAction: FormAction;
  onSaved?: () => void;
  reduce?: typeof reducePhoto;
  upload?: typeof uploadPhoto;
}) {
  return null;
}
