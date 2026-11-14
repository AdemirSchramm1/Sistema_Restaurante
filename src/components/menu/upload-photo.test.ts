import { describe, expect, it } from "vitest";
import { uploadPhoto, type UploadRequest } from "./upload-photo";

/** Envio da foto com progresso (spec 013, research R2). */
function fakeXhr() {
  const xhr = {
    opened: [] as string[],
    sent: null as FormData | null,
    status: 0,
    responseText: "",
    upload: { onprogress: null as UploadRequest["upload"]["onprogress"] },
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    open(method: string, url: string) {
      xhr.opened.push(method, url);
    },
    send(body: FormData) {
      xhr.sent = body;
    },
    answer(status: number, body: string) {
      xhr.status = status;
      xhr.responseText = body;
      xhr.onload!();
    },
  };
  return xhr;
}
const photo = { base: "/fotos/menu/abc", widths: [300, 600] };
const start = () => {
  const xhr = fakeXhr();
  const progress: number[] = [];
  const file = new Blob(["foto"]);
  const done = uploadPhoto({ recipeId: "r1", file, onProgress: (p) => progress.push(p) }, () => xhr);
  return { xhr, progress, file, done };
};

describe("uploadPhoto", () => {
  it("envia o produto e a foto para POST /api/cardapio/foto", async () => {
    const { xhr, done } = start();
    expect(xhr.opened).toEqual(["POST", "/api/cardapio/foto"]);
    expect(xhr.sent!.get("recipeId")).toBe("r1");
    expect(await (xhr.sent!.get("photo") as File).text()).toBe("foto");
    xhr.answer(200, JSON.stringify({ photo }));
    expect(await done).toEqual({ ok: true, value: photo });
  });

  it("informa o progresso em porcentagem inteira", () => {
    const { xhr, progress } = start();
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 3 });
    xhr.upload.onprogress!({ lengthComputable: false, loaded: 2, total: 0 });
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 3, total: 3 });
    expect(progress).toEqual([33, 100]);
  });

  it("no 400 devolve o código que o servidor mandou", async () => {
    const { xhr, done } = start();
    xhr.answer(400, JSON.stringify({ code: "PHOTO_TOO_SMALL" }));
    expect(await done).toEqual({ ok: false, error: { code: "PHOTO_TOO_SMALL" } });
  });

  it("resposta que não dá para ler vira falha de envio", async () => {
    for (const [status, body] of [
      [500, "<html>erro</html>"],
      [413, ""],
      [400, "{}"],
      [400, "null"],
      [200, "{}"],
    ] as const) {
      const { xhr, done } = start();
      xhr.answer(status, body);
      expect(await done, `${status} ${body}`).toEqual({ ok: false, error: { code: "PHOTO_STORAGE_FAILED" } });
    }
  });

  it("queda de rede vira falha de envio", async () => {
    const { xhr, done } = start();
    xhr.onerror!();
    expect(await done).toEqual({ ok: false, error: { code: "PHOTO_STORAGE_FAILED" } });
  });

  it("sem dublê, usa o XMLHttpRequest do navegador", () => {
    const opened: string[] = [];
    class Xhr {
      upload = {};
      open(method: string, url: string) {
        opened.push(method, url);
      }
      send() {}
    }
    const original = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = Xhr as unknown as typeof XMLHttpRequest;
    void uploadPhoto({ recipeId: "r1", file: new Blob(), onProgress: () => undefined });
    globalThis.XMLHttpRequest = original;
    expect(opened).toEqual(["POST", "/api/cardapio/foto"]);
  });
});
