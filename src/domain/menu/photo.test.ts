import { describe, expect, it } from "vitest";
import {
  checkPhotoFile,
  croppedSize,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES,
  photoSrcSet,
  photoUrl,
  variantWidths,
  type PhotoFile,
} from "./photo";

const file = (over: Partial<PhotoFile> = {}): PhotoFile => ({
  type: "image/jpeg",
  bytes: 2_000_000,
  width: 1600,
  height: 1200,
  ...over,
});
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("foto do produto (docs/produto/pedidos/06-editar-o-cardapio.md#foto)", () => {
  it("aceita JPG, PNG e WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"])
      expect(checkPhotoFile(file({ type }))).toEqual({ ok: true, value: true });
  });

  it("recusa outro tipo de arquivo com PHOTO_TYPE", () => {
    for (const type of ["application/pdf", "image/gif", "image/heic", "", "IMAGE/JPEG"])
      expect(checkPhotoFile(file({ type }))).toEqual({ ok: false, error: { code: "PHOTO_TYPE" } });
  });

  it("aceita 10 MB exatos e recusa um byte a mais com PHOTO_TOO_BIG", () => {
    expect(MAX_PHOTO_BYTES).toBe(10_485_760);
    expect(code(checkPhotoFile(file({ bytes: MAX_PHOTO_BYTES })))).toBe("OK");
    expect(checkPhotoFile(file({ bytes: MAX_PHOTO_BYTES + 1 }))).toEqual({
      ok: false,
      error: { code: "PHOTO_TOO_BIG" },
    });
  });

  it("o limite do que chega ao servidor é 4 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(4_194_304);
    expect(code(checkPhotoFile(file({ bytes: MAX_UPLOAD_BYTES }), MAX_UPLOAD_BYTES))).toBe("OK");
    expect(code(checkPhotoFile(file({ bytes: MAX_UPLOAD_BYTES + 1 }), MAX_UPLOAD_BYTES))).toBe(
      "PHOTO_TOO_BIG",
    );
  });

  it("aceita lado menor de 600 px e recusa 599 com PHOTO_TOO_SMALL, em pé e deitada", () => {
    expect(code(checkPhotoFile(file({ width: 600, height: 4000 })))).toBe("OK");
    expect(code(checkPhotoFile(file({ width: 4000, height: 600 })))).toBe("OK");
    expect(checkPhotoFile(file({ width: 599, height: 4000 }))).toEqual({
      ok: false,
      error: { code: "PHOTO_TOO_SMALL" },
    });
    expect(code(checkPhotoFile(file({ width: 4000, height: 599 })))).toBe("PHOTO_TOO_SMALL");
  });

  it("confere o tipo antes do tamanho e o tamanho antes das medidas", () => {
    expect(
      code(checkPhotoFile(file({ type: "application/pdf", bytes: MAX_PHOTO_BYTES + 1, width: 10 }))),
    ).toBe("PHOTO_TYPE");
    expect(code(checkPhotoFile(file({ bytes: MAX_PHOTO_BYTES + 1, width: 10 })))).toBe("PHOTO_TOO_BIG");
  });
});

describe("recorte 4:3 no centro (spec 013, FR-003)", () => {
  it("foto deitada mais larga que 4:3 perde as laterais", () => {
    expect(croppedSize(1600, 900)).toEqual({ width: 1200, height: 900 });
  });

  it("foto em pé perde em cima e embaixo", () => {
    expect(croppedSize(600, 800)).toEqual({ width: 600, height: 450 });
  });

  it("foto já em 4:3 fica como está", () => {
    expect(croppedSize(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });

  it("medidas que não dividem certo arredondam para baixo", () => {
    expect(croppedSize(1000, 700)).toEqual({ width: 932, height: 699 });
    expect(croppedSize(601, 2000)).toEqual({ width: 600, height: 450 });
  });
});

describe("larguras gravadas (spec 013, FR-003)", () => {
  it("só as larguras que não passam da foto recortada", () => {
    expect(variantWidths(600)).toEqual([300, 600]);
    expect(variantWidths(899)).toEqual([300, 600]);
    expect(variantWidths(900)).toEqual([300, 600, 900]);
    expect(variantWidths(1199)).toEqual([300, 600, 900]);
    expect(variantWidths(1200)).toEqual([300, 600, 900, 1200]);
    expect(variantWidths(4000)).toEqual([300, 600, 900, 1200]);
  });

  it("foto recortada menor que 600 fica só com a miniatura", () => {
    expect(variantWidths(599)).toEqual([300]);
    expect(variantWidths(299)).toEqual([]);
  });
});

describe("endereços da foto (spec 013, US6.3 e US6.10)", () => {
  const photo = { base: "/fotos/menu/abc", widths: [300, 600, 900] };

  it("monta o endereço de uma largura", () => {
    expect(photoUrl(photo, 600)).toBe("/fotos/menu/abc/600.webp");
  });

  it("monta o srcset com todas as larguras gravadas", () => {
    expect(photoSrcSet(photo)).toBe(
      "/fotos/menu/abc/300.webp 300w, /fotos/menu/abc/600.webp 600w, /fotos/menu/abc/900.webp 900w",
    );
    expect(photoSrcSet({ base: "https://x.test/menu/z", widths: [300] })).toBe(
      "https://x.test/menu/z/300.webp 300w",
    );
  });

  it("produto sem foto não tem srcset", () => {
    expect(photoSrcSet(null)).toBeNull();
  });
});
