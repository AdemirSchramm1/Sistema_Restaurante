import { describe, it, expect } from "vitest";
import { itemsText, placedByText, sinceText } from "./format";

describe("textos da tela do garçom (spec 015)", () => {
  it("há quanto tempo a conta está aberta", () => {
    const now = "2026-11-17T20:35:00Z";
    expect(sinceText("2026-11-17T20:00:00Z", now)).toBe("há 35 min");
    expect(sinceText("2026-11-17T19:30:00Z", now)).toBe("há 1 h 05 min");
    expect(sinceText("2026-11-17T20:40:00Z", now)).toBe("há 0 min");
  });

  it("itens e quem lançou", () => {
    expect(itemsText(1)).toBe("1 item");
    expect(itemsText(3)).toBe("3 itens");
    expect(placedByText({ source: "QR", placedByName: null })).toBe("QR code");
    expect(placedByText({ source: "STAFF", placedByName: "João" })).toBe("João");
    expect(placedByText({ source: "STAFF", placedByName: null })).toBe("Equipe");
    expect(placedByText({ source: "TABLET", placedByName: null })).toBe("Tablet da mesa");
  });
});
