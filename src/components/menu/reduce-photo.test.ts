// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserPhotoTools, reducePhoto, type PhotoTools } from "./reduce-photo";

/** O navegador reduz a foto antes de enviar (spec 013, research R2). */
const MB = 1024 * 1024;
const fileOf = (bytes: number, type = "image/jpeg") => new File([new Uint8Array(bytes)], "foto", { type });

type Drawn = { width: number; height: number; type: string; quality: number; drew: unknown[] };
function fakeTools(
  size: { width: number; height: number } | null,
  { output = new Blob(["reduzida"]) as Blob | null, context = true } = {},
) {
  const calls = { options: [] as unknown[], closed: 0, canvases: [] as Drawn[] };
  const tools: PhotoTools = {
    decode: (_file, options) => {
      calls.options.push(options);
      if (!size) return Promise.reject(new Error("não é imagem"));
      return Promise.resolve({ ...size, close: () => void (calls.closed += 1) });
    },
    canvas: () => {
      const drawn: Drawn = { width: 0, height: 0, type: "", quality: 0, drew: [] };
      calls.canvases.push(drawn);
      return {
        set width(v: number) {
          drawn.width = v;
        },
        set height(v: number) {
          drawn.height = v;
        },
        getContext: () =>
          context ? { drawImage: (...args: unknown[]) => void drawn.drew.push(args) } : null,
        toBlob: (done, type, quality) => {
          drawn.type = type;
          drawn.quality = quality;
          done(output);
        },
      };
    },
  };
  return { tools, calls };
}
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }): T => {
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => r.error?.code;

describe("reducePhoto", () => {
  it("foto de 4000 × 3000 vira 1600 × 1200 em JPEG 0,85", async () => {
    const { tools, calls } = fakeTools({ width: 4000, height: 3000 });
    const reduced = unwrap(await reducePhoto(fileOf(5 * MB), tools));
    expect(await reduced.text()).toBe("reduzida");
    const [canvas] = calls.canvases;
    expect(canvas).toMatchObject({ width: 1600, height: 1200, type: "image/jpeg", quality: 0.85 });
    expect(canvas!.drew).toHaveLength(1);
    expect(canvas!.drew[0]).toEqual([expect.objectContaining({ width: 4000 }), 0, 0, 1600, 1200]);
    expect(calls.closed).toBe(1);
  });

  it("foto em pé: o lado maior (a altura) é que fica em 1600", async () => {
    const { tools, calls } = fakeTools({ width: 3000, height: 4000 });
    unwrap(await reducePhoto(fileOf(MB), tools));
    expect(calls.canvases[0]).toMatchObject({ width: 1200, height: 1600 });
  });

  it("foto menor que 1600 não é ampliada", async () => {
    const { tools, calls } = fakeTools({ width: 1000, height: 750 });
    unwrap(await reducePhoto(fileOf(MB), tools));
    expect(calls.canvases[0]).toMatchObject({ width: 1000, height: 750 });
  });

  it("pede a orientação da câmera ao ler a foto", async () => {
    const { tools, calls } = fakeTools({ width: 1000, height: 750 });
    await reducePhoto(fileOf(MB), tools);
    expect(calls.options).toEqual([{ imageOrientation: "from-image" }]);
  });

  it("confere o arquivo original antes de reduzir: tipo, 10 MB e 600 px", async () => {
    const pdf = fakeTools(null);
    expect(code(await reducePhoto(fileOf(MB, "application/pdf"), pdf.tools))).toBe("PHOTO_TYPE");
    const big = fakeTools({ width: 4000, height: 3000 });
    expect(code(await reducePhoto(fileOf(10 * MB + 1), big.tools))).toBe("PHOTO_TOO_BIG");
    const small = fakeTools({ width: 800, height: 400 });
    expect(code(await reducePhoto(fileOf(MB), small.tools))).toBe("PHOTO_TOO_SMALL");
    for (const t of [pdf, big, small]) expect(t.calls.canvases).toHaveLength(0);
    expect(big.calls.closed + small.calls.closed).toBe(2);
    // Exatamente no limite passa.
    unwrap(await reducePhoto(fileOf(10 * MB), fakeTools({ width: 800, height: 600 }).tools));
  });

  it("falha ao reduzir: devolve o original se tiver até 4 MB", async () => {
    const original = fileOf(4 * MB);
    const failures = [
      fakeTools(null),
      fakeTools({ width: 2000, height: 1500 }, { output: null }),
      fakeTools({ width: 2000, height: 1500 }, { context: false }),
    ];
    for (const { tools } of failures) expect(unwrap(await reducePhoto(original, tools))).toBe(original);
  });

  it("falha ao reduzir foto acima de 4 MB: pede uma foto menor", async () => {
    const { tools } = fakeTools({ width: 2000, height: 1500 }, { output: null });
    expect(code(await reducePhoto(fileOf(4 * MB + 1), tools))).toBe("PHOTO_PREPARE_FAILED");
  });

  it("a foto reduzida que ainda passa de 4 MB também não é enviada", async () => {
    const { tools } = fakeTools(
      { width: 2000, height: 1500 },
      { output: new Blob([new Uint8Array(4 * MB + 1)]) },
    );
    expect(code(await reducePhoto(fileOf(MB), tools))).toBe("PHOTO_PREPARE_FAILED");
  });
});

describe("browserPhotoTools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa o createImageBitmap e o canvas do navegador", async () => {
    const bitmap = { width: 1, height: 1, close: () => undefined };
    const createImageBitmap = vi.fn(() => Promise.resolve(bitmap));
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const file = fileOf(1);
    expect(await browserPhotoTools.decode(file, { imageOrientation: "from-image" })).toBe(bitmap);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
    expect(browserPhotoTools.canvas()).toBeInstanceOf(HTMLCanvasElement);
  });
});
