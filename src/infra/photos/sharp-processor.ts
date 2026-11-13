import sharp from "sharp";
import type { PhotoProcessor } from "@/application/menu/ports";
import { checkPhotoFile, croppedSize, variantWidths } from "@/domain/menu/photo";
import { err, ok } from "@/domain/shared/result";

const TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Trata a foto do produto com `sharp` (spec 013, research R1): lê o tipo pelo conteúdo, põe em pé
 * pela orientação da câmera, recorta 4:3 no centro e grava WebP sem metadados em cada largura.
 */
export const sharpProcessor: PhotoProcessor = {
  async process(bytes) {
    const meta = await sharp(bytes)
      .metadata()
      .catch(() => null);
    if (!meta) return err("PHOTO_TYPE");
    const upright = meta.autoOrient;
    const checked = checkPhotoFile({
      type: TYPES[meta.format] ?? "",
      bytes: bytes.byteLength,
      width: upright.width,
      height: upright.height,
    });
    if (!checked.ok) return checked;
    const cropped = croppedSize(upright.width, upright.height);
    const variants = await Promise.all(
      variantWidths(cropped.width).map(async (width) => ({
        width,
        bytes: new Uint8Array(
          await sharp(bytes)
            .rotate()
            .resize(width, (width * 3) / 4, { fit: "cover", position: "centre" })
            .webp({ quality: 78 })
            .toBuffer(),
        ),
      })),
    );
    return ok({ variants });
  },
};
