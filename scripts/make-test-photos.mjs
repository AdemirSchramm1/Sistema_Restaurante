// Gera as fotos de teste da spec 013 em tests/screens/photos/. Rodar só se precisar refazer:
//   node scripts/make-test-photos.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const dir = "tests/screens/photos";
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const svg = (w, h, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const jpeg = (w, h, body) => sharp(svg(w, h, body)).jpeg({ quality: 90 });

// Deitada 1600 × 1000: faixas vermelha e azul de 100 px nas laterais ficam fora do recorte 4:3.
await jpeg(
  1600,
  1000,
  rect(0, 0, 1600, 1000, "#00a000") + rect(0, 0, 100, 1000, "#ff0000") + rect(1500, 0, 100, 1000, "#0000ff"),
).toFile(`${dir}/deitada.jpg`);

// Em pé 900 × 1400: faixas de 300 px em cima e embaixo ficam fora do recorte.
await jpeg(
  900,
  1400,
  rect(0, 0, 900, 1400, "#00a000") + rect(0, 0, 900, 300, "#ff0000") + rect(0, 1100, 900, 300, "#0000ff"),
).toFile(`${dir}/em-pe.jpg`);

// Foto de câmera: gravada deitada (1200 × 800) com orientação 6 (o aparelho estava em pé) e com
// localização. Vista do jeito certo, a metade de cima é magenta e a de baixo é ciano.
await jpeg(1200, 800, rect(0, 0, 600, 800, "#ff00ff") + rect(600, 0, 600, 800, "#00ffff"))
  .withExif({
    IFD0: { Make: "Camera de teste" },
    IFD3: {
      GPSLatitudeRef: "S",
      GPSLatitude: "23/1 33/1 0/1",
      GPSLongitudeRef: "W",
      GPSLongitude: "46/1 38/1 0/1",
    },
  })
  .withMetadata({ orientation: 6 })
  .toFile(`${dir}/camera.jpg`);

await jpeg(400, 300, rect(0, 0, 400, 300, "#00a000")).toFile(`${dir}/pequena.jpg`);
await sharp(svg(800, 600, rect(0, 0, 800, 600, "#c06000")))
  .png()
  .toFile(`${dir}/prato.png`);
await sharp(
  svg(1200, 900, rect(0, 0, 1200, 900, "#806040") + `<circle cx="600" cy="450" r="300" fill="#f0c040"/>`),
)
  .webp({ quality: 80 })
  .toFile(`${dir}/lanche.webp`);

await writeFile(
  `${dir}/documento.pdf`,
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
