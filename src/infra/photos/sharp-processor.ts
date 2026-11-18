import sharp from "sharp";
import type { PhotoProcessor } from "@/application/menu/ports";
import {
  checkPhotoFile,
  croppedSize,
  MAX_PHOTO_BYTES,
  PHOTO_SHAPES,
  variantWidths,
} from "@/domain/menu/photo";
import { err, ok } from "@/domain/shared/result";

const TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Trata a foto do produto com `sharp` (spec 013, research R1): lê o tipo pelo conteúdo, põe em pé
 * pela orientação da câmera, recorta no centro na proporção do formato (4:3 o prato, 1:1 o logo e
 * 3:1 a capa; spec 016, R8) e grava WebP sem metadados em cada largura.
 */
export const sharpProcessor: PhotoProcessor = {
  async process(bytes, shape = "PRODUCT") {
    const meta = await sharp(bytes)
      .metadata()
      .catch(() => null);
    if (!meta) return err("PHOTO_TYPE");
    const upright = meta.autoOrient;
    const checked = checkPhotoFile(
      {
        type: TYPES[meta.format] ?? "",
        bytes: bytes.byteLength,
        width: upright.width,
        height: upright.height,
      },
      MAX_PHOTO_BYTES,
      shape,
    );
    if (!checked.ok) return checked;
    const cropped = croppedSize(upright.width, upright.height, shape);
    const [rw, rh] = PHOTO_SHAPES[shape].ratio;
    const variants = await Promise.all(
      variantWidths(cropped.width, shape).map(async (width) => ({
        width,
        bytes: new Uint8Array(
          await sharp(bytes)
            .rotate()
            .resize(width, Math.round((width * rh) / rw), { fit: "cover", position: "centre" })
            .webp({ quality: 78 })
            .toBuffer(),
        ),
      })),
    );
    return ok({ variants });
  },
};
