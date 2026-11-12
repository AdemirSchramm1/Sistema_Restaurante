import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, luminanceOfOklch, parseOklch } from "@/lib/contrast";

/**
 * Tema da spec 012 (FR-001, FR-002): toda cor de texto do tema tem contraste de pelo menos 4,5:1
 * com o fundo onde aparece, no modo claro e no escuro (WCAG AA).
 */

const css = readFileSync(path.resolve(import.meta.dirname, "../../../app/globals.css"), "utf8");

/** Variáveis `--nome: oklch(...)` de um bloco `:root { ... }`. */
function tokens(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))\s*;/g)].map((m) => [m[1]!, m[2]!]));
}

function rootBlock(source: string): string {
  const m = /:root\s*\{([^}]*)\}/.exec(source);
  if (!m) throw new Error("bloco :root não encontrado");
  return m[1]!;
}

const light = tokens(rootBlock(css));
const darkMedia = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const dark = tokens(rootBlock(darkMedia));

/** [texto, fundo]: cada par que aparece junto na tela. */
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary-foreground", "primary"],
  ["primary-soft-foreground", "primary-soft"],
  ["secondary-foreground", "secondary"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["success-soft-foreground", "success-soft"],
  ["warning-foreground", "warning"],
  ["warning-soft-foreground", "warning-soft"],
  ["danger-soft-foreground", "danger-soft"],
  ["info-soft-foreground", "info-soft"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-muted", "sidebar"],
  ["sidebar-foreground", "sidebar-accent"],
  ["sidebar-primary", "sidebar"],
];

function ratio(theme: Map<string, string>, text: string, bg: string): number {
  const t = parseOklch(theme.get(text) ?? "");
  const b = parseOklch(theme.get(bg) ?? "");
  if (!t || !b) return 0;
  return contrastRatio(luminanceOfOklch(t), luminanceOfOklch(b));
}

describe("tema com a paleta de comida (spec 012, FR-001 e FR-002)", () => {
  it("o modo escuro redefine todas as cores do claro", () => {
    expect([...dark.keys()].sort()).toEqual([...light.keys()].sort());
  });

  for (const [name, theme] of [
    ["claro", light],
    ["escuro", dark],
  ] as const) {
    it(`modo ${name}: todo par de texto e fundo tem contraste de pelo menos 4,5:1`, () => {
      const low = PAIRS.map(([text, bg]) => ({ pair: `${text} sobre ${bg}`, ratio: ratio(theme, text, bg) }))
        .filter((p) => p.ratio < 4.5)
        .map((p) => `${p.pair}: ${p.ratio.toFixed(2)}`);
      expect(low).toEqual([]);
    });
  }
});
