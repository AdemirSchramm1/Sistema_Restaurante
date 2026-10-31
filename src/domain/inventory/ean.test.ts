import { describe, expect, it } from "vitest";
import { isValidGtin } from "./ean";

describe("GTIN/EAN (dígito verificador)", () => {
  it.each(["7891000315507", "96385074", "036000291452", "17891000315504"])("aceita %s", (v) => {
    expect(isValidGtin(v)).toBe(true);
  });

  it.each(["7891000315508", "1234567", "789100031550A", "123456789012345", ""])("recusa %s", (v) => {
    expect(isValidGtin(v)).toBe(false);
  });
});
