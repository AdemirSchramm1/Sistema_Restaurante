import type { Locator, Page } from "@playwright/test";

/** Asserções de layout dos testes de tela (spec 013, TDD-003). Esqueleto: ainda não conferem nada. */

export async function expectNoSideScroll(_page: Page): Promise<void> {}
export async function expectNoClippedText(_scope: Locator): Promise<void> {}
export async function expectTapTargets(_scope: Locator): Promise<void> {}
export async function expectNoOverlap(_scope: Locator): Promise<void> {}
export async function expectPhotoRatio(_scope: Locator): Promise<void> {}
export async function expectNoBrokenImage(_scope: Locator): Promise<void> {}
export async function expectColumns(_cards: Locator, _n: number): Promise<void> {}
export async function expectStickyAfterScroll(_page: Page, _bar: Locator): Promise<void> {}
export async function expectReadableAt200(_page: Page, _scope: Locator): Promise<void> {}
export async function expectSurvivesRotation(
  _page: Page,
  _state: () => Promise<string>,
  _anchor: Locator,
): Promise<void> {}
export async function expectLazyPhotos(_page: Page, _photos: Locator): Promise<void> {}
