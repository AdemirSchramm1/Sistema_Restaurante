import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import { qrSvg } from "./qr";

describe("QR code da mesa (spec 009, research R5)", () => {
  const url = "https://app.exemplo.com.br/m/3q2-Zf8Kx0aYw7mQ1vB5nL9tR4cE6uJ0hS2dG8pW1kA";

  it("gera SVG com nível de correção M e margem 2", async () => {
    const svg = await qrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    const size = QRCode.create(url, { errorCorrectionLevel: "M" }).modules.size;
    expect(svg).toContain(`viewBox="0 0 ${size + 4} ${size + 4}"`);
  });

  it("o mesmo link gera o mesmo desenho", async () => {
    expect(await qrSvg(url)).toBe(await qrSvg(url));
    expect(await qrSvg(url)).not.toBe(await qrSvg(`${url}x`));
  });
});
