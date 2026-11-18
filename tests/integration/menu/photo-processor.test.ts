import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { sharpProcessor } from "../../../src/infra/photos/sharp-processor";

/** Spec 013, FR-003 e US1.3: a foto vira WebP 4:3, recortada no centro, em pé e sem metadados. */
const photo = async (name: string) => new Uint8Array(await readFile(`tests/screens/photos/${name}`));

async function variants(name: string) {
  const r = await sharpProcessor.process(await photo(name));
  if (!r.ok) throw new Error(r.error.code);
  return r.value.variants;
}

async function pixel(bytes: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const at =
    (Math.floor(y * (info.height - 1)) * info.width + Math.floor(x * (info.width - 1))) * info.channels;
  const near = (v: number) => (v > 200 ? 1 : v < 60 ? 0 : 0.5);
  return [near(data[at]!), near(data[at + 1]!), near(data[at + 2]!)].join(",");
}

const RED = "1,0,0";
const GREEN = "0,0.5,0";
const BLUE = "0,0,1";
const MAGENTA = "1,0,1";
const CYAN = "0,1,1";

describe("fotos do cardápio (spec 013, FR-003)", () => {
  it("foto deitada vira WebP 4:3 em 300, 600, 900 e 1200, sem ampliar", async () => {
    const out = await variants("deitada.jpg");
    expect(out.map((v) => v.width)).toEqual([300, 600, 900, 1200]);
    for (const v of out) {
      const meta = await sharp(v.bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", v.width, (v.width * 3) / 4]);
    }
  });

  it("foto em pé de 900 px de largura sai em 300, 600 e 900", async () => {
    const out = await variants("em-pe.jpg");
    expect(out.map((v) => v.width)).toEqual([300, 600, 900]);
  });

  it("o recorte é o do centro: as faixas das bordas ficam de fora", async () => {
    for (const name of ["deitada.jpg", "em-pe.jpg"]) {
      const [small] = await variants(name);
      const corners = await Promise.all(
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [0.5, 0.5],
        ].map(([x, y]) => pixel(small!.bytes, x!, y!)),
      );
      expect(corners, name).toEqual([GREEN, GREEN, GREEN, GREEN, GREEN]);
      expect(corners).not.toContain(RED);
      expect(corners).not.toContain(BLUE);
    }
  });

  it("foto tirada com o aparelho em pé sai em pé", async () => {
    const [small] = await variants("camera.jpg");
    expect(await pixel(small!.bytes, 0.5, 0.05)).toBe(MAGENTA);
    expect(await pixel(small!.bytes, 0.5, 0.95)).toBe(CYAN);
  });

  it("a saída não leva EXIF nem localização", async () => {
    const original = await sharp(await photo("camera.jpg")).metadata();
    expect(original.exif).toBeDefined();
    for (const v of await variants("camera.jpg")) {
      const meta = await sharp(v.bytes).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(Buffer.from(v.bytes).includes("Camera de teste")).toBe(false);
    }
  });

  it("PNG e WebP também entram", async () => {
    expect((await variants("prato.png")).map((v) => v.width)).toEqual([300, 600]);
    expect((await variants("lanche.webp")).map((v) => v.width)).toEqual([300, 600, 900, 1200]);
  });

  it("recusa o que não é JPG, PNG nem WebP, olhando o conteúdo e não o nome", async () => {
    const pdf = await sharpProcessor.process(await photo("documento.pdf"));
    expect(pdf).toMatchObject({ ok: false, error: { code: "PHOTO_TYPE" } });
    const gif = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } })
      .gif()
      .toBuffer();
    const r = await sharpProcessor.process(new Uint8Array(gif));
    expect(r).toMatchObject({ ok: false, error: { code: "PHOTO_TYPE" } });
  });

  it("recusa foto com o lado menor abaixo de 600 px", async () => {
    const r = await sharpProcessor.process(await photo("pequena.jpg"));
    expect(r).toMatchObject({ ok: false, error: { code: "PHOTO_TOO_SMALL" } });
  });

  it("a foto de câmera é medida já em pé (800 × 1200 passa, mesmo gravada 1200 × 800)", async () => {
    const out = await variants("camera.jpg");
    expect(out.map((v) => v.width)).toEqual([300, 600]);
  });
});

describe("logo e capa do restaurante (spec 016, R8)", () => {
  const shaped = async (name: string, shape: "LOGO" | "COVER" | "PRODUCT") => {
    const r = await sharpProcessor.process(await photo(name), shape);
    if (!r.ok) throw new Error(r.error.code);
    return r.value.variants;
  };

  it("logo de 400 px vira 1:1 em 96, 192 e 384", async () => {
    const out = await shaped("logo.png", "LOGO");
    expect(out.map((v) => v.width)).toEqual([96, 192, 384]);
    for (const v of out) {
      const meta = await sharp(v.bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", v.width, v.width]);
    }
  });

  it("capa de 1920 × 640 vira 3:1 em 600, 1200 e 1920", async () => {
    const out = await shaped("capa.jpg", "COVER");
    expect(out.map((v) => v.width)).toEqual([600, 1200, 1920]);
    for (const v of out) {
      const meta = await sharp(v.bytes).metadata();
      expect([meta.width, meta.height]).toEqual([v.width, v.width / 3]);
    }
  });

  it("logo pequeno e capa estreita: PHOTO_TOO_SMALL com o formato", async () => {
    expect(await sharpProcessor.process(await photo("logo-pequeno.png"), "LOGO")).toEqual({
      ok: false,
      error: { code: "PHOTO_TOO_SMALL", details: { kind: "LOGO" } },
    });
    expect(await sharpProcessor.process(await photo("capa-estreita.jpg"), "COVER")).toEqual({
      ok: false,
      error: { code: "PHOTO_TOO_SMALL", details: { kind: "COVER" } },
    });
  });

  it("o prato continua 4:3", async () => {
    const out = await shaped("deitada.jpg", "PRODUCT");
    const meta = await sharp(out[0]!.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([300, 225]);
  });
});
