import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 012, FR-005: a cor vem do tema (`bg-primary`, `text-warning-soft-foreground`…), nunca da
 * paleta crua do Tailwind (`bg-amber-100`, `text-red-800`, `text-white`). Assim o modo escuro e o
 * contraste valem para todas as telas.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const UTILITY =
  "bg|text|border|ring|outline|fill|stroke|from|via|to|accent|caret|decoration|divide|shadow|placeholder";
const RAW = new RegExp(
  `(?<![\\w-])(?:${UTILITY})-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?:/\\d{1,3})?(?![\\w-])`,
  "g",
);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("sem cor solta fora do tema (spec 012, FR-005)", () => {
  it("reconhece as classes cruas e deixa passar as do tema", () => {
    const found = (s: string) => s.match(RAW) ?? [];
    expect(found("bg-amber-100 text-red-800 hover:bg-emerald-600/90 text-white bg-black/40")).toEqual([
      "bg-amber-100",
      "text-red-800",
      "bg-emerald-600/90",
      "text-white",
      "bg-black/40",
    ]);
    expect(found("bg-primary text-warning-soft-foreground border-border text-success")).toEqual([]);
  });

  it("app/ e src/components/ usam só as cores do tema", () => {
    const offenders = [
      ...sources(path.join(ROOT, "app")),
      ...sources(path.join(ROOT, "src/components")),
    ].flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          (line.match(RAW) ?? []).map((c) => `${path.relative(ROOT, file)}:${i + 1} ${c}`),
        ),
    );
    expect(offenders).toEqual([]);
  });
});
