import { describe, expect, it } from "vitest";
import { parseLocationForm } from "./location-input";

describe("parseLocationForm", () => {
  it("lê nome e tipo", () => {
    expect(parseLocationForm({ name: " Freezer ", kind: "FROZEN" })).toMatchObject({
      ok: true,
      value: { name: "Freezer", kind: "FROZEN" },
    });
  });

  it("recusa tipo desconhecido", () => {
    expect(parseLocationForm({ name: "Freezer", kind: "XYZ" })).toMatchObject({
      ok: false,
      error: { field: "kind" },
    });
  });
});
