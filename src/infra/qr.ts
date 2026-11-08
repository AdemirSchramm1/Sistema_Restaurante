import QRCode from "qrcode";

/**
 * Desenho do QR code em SVG (spec 009, research R5): nível "M" aguenta mesa riscada ou suja e
 * a margem 2 deixa espaço para o celular achar o código.
 */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
}
