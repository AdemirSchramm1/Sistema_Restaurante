import type { FormAction } from "./move-buttons";

export function NewSectionForm(_props: { action: FormAction }) {
  return null;
}
export function RenameSectionForm(_props: {
  section: { id: string; name: string; version: number };
  action: FormAction;
}) {
  return null;
}
export function DeleteSection(_props: {
  section: { id: string; name: string; productCount: number };
  action: FormAction;
}) {
  return null;
}
