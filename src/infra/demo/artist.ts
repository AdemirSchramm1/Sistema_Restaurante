import sharp from "sharp";
import type { DemoArtist } from "@/application/demo/seed";
import type { DemoArt } from "@/application/demo/catalog";
import { seededRandom, type Random } from "@/application/demo/random";

/**
 * Ilustrações do restaurante de exemplo (spec 017): prato visto de cima, lanche, copo, lata e
 * garrafa, mais logo e capa. Desenho em SVG, sem texto (não depende de fonte instalada), virado
 * JPEG pelo sharp. A mesma foto sai para o mesmo nome.
 */

const W = 1200;
const H = 900;

const hash = (text: string) =>
  [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const TABLES = [
  ["#7b5134", "#5e3b24"],
  ["#8d6748", "#6b4a31"],
  ["#3f4a3c", "#2c3529"],
  ["#c9b79c", "#a8957a"],
  ["#5b3a29", "#40281b"],
];

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

function table(rnd: Random): string {
  const [a, b] = rnd.pick(TABLES);
  const grain = Array.from({ length: 14 }, () => {
    const y = rnd.int(0, H);
    return `<path d="M0 ${y} C ${W / 3} ${y + rnd.int(-30, 30)}, ${(2 * W) / 3} ${y + rnd.int(-30, 30)}, ${W} ${y + rnd.int(-20, 20)}" stroke="${shade(b!, -12)}" stroke-width="${rnd.int(2, 6)}" fill="none" opacity="0.35"/>`;
  }).join("");
  return `<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="light" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#t)"/>${grain}`;
}

/** Monte irregular de comida: vários círculos da mesma cor, com brilho. */
function mound(rnd: Random, cx: number, cy: number, r: number, color: string): string {
  const blobs = Array.from({ length: 9 }, () => {
    const a = rnd.next() * Math.PI * 2;
    const dist = rnd.next() * r * 0.55;
    const br = r * (0.35 + rnd.next() * 0.3);
    const c = shade(color, rnd.int(-18, 14));
    return `<circle cx="${cx + Math.cos(a) * dist}" cy="${cy + Math.sin(a) * dist}" r="${br}" fill="${c}"/>`;
  }).join("");
  const highlights = Array.from({ length: 5 }, () => {
    const a = rnd.next() * Math.PI * 2;
    const dist = rnd.next() * r * 0.6;
    return `<ellipse cx="${cx + Math.cos(a) * dist}" cy="${cy + Math.sin(a) * dist}" rx="${r * 0.12}" ry="${r * 0.06}" fill="#fff" opacity="0.18"/>`;
  }).join("");
  return `<g>${blobs}${highlights}</g>`;
}

function plate(rnd: Random, foods: string[], bowl: boolean): string {
  const cx = W / 2;
  const cy = H / 2 + 10;
  const r = bowl ? 300 : 360;
  const rim = bowl ? "#efe7d6" : "#fbfbf8";
  const base =
    `<ellipse cx="${cx + 18}" cy="${cy + 26}" rx="${r + 10}" ry="${r + 4}" fill="#000" opacity="0.28"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${rim}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * (bowl ? 0.8 : 0.74)}" fill="${bowl ? "#e2d8c3" : "#f2f1ec"}"/>`;
  const n = foods.length;
  const placed = foods
    .map((color, i) => {
      if (bowl) {
        const a = (i / n) * Math.PI * 2 + rnd.next();
        const dist = i === 0 ? 0 : r * 0.3;
        return mound(
          rnd,
          cx + Math.cos(a) * dist,
          cy + Math.sin(a) * dist,
          r * (i === 0 ? 0.62 : 0.34),
          color,
        );
      }
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const dist = n === 1 ? 0 : r * 0.38;
      return mound(rnd, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r * (n <= 2 ? 0.46 : 0.36), color);
    })
    .join("");
  const herbs = Array.from({ length: 12 }, () => {
    const a = rnd.next() * Math.PI * 2;
    const dist = rnd.next() * r * 0.6;
    return `<circle cx="${cx + Math.cos(a) * dist}" cy="${cy + Math.sin(a) * dist}" r="${rnd.int(3, 6)}" fill="#3f7d2c" opacity="0.8"/>`;
  }).join("");
  const cutlery = `<rect x="${cx + r + 60}" y="${cy - 260}" width="16" height="520" rx="8" fill="#c9ccd1"/><rect x="${cx - r - 76}" y="${cy - 260}" width="16" height="520" rx="8" fill="#c9ccd1"/>`;
  return base + placed + herbs + cutlery;
}

function burger(): string {
  const cx = W / 2;
  return `<rect x="${cx - 420}" y="560" width="840" height="230" rx="26" fill="#a87447"/><rect x="${cx - 420}" y="560" width="840" height="230" rx="26" fill="none" stroke="#7d5232" stroke-width="6"/>
<ellipse cx="${cx}" cy="640" rx="330" ry="40" fill="#000" opacity="0.25"/>
<path d="M${cx - 300} 600 Q ${cx} 650 ${cx + 300} 600 L ${cx + 290} 560 L ${cx - 290} 560 Z" fill="#d79a4b"/>
<rect x="${cx - 310}" y="500" width="620" height="70" rx="30" fill="#5a2e1b"/>
<path d="M${cx - 300} 500 L ${cx - 250} 545 L ${cx - 200} 500 L ${cx - 120} 550 L ${cx - 40} 500 L ${cx + 60} 548 L ${cx + 160} 500 L ${cx + 240} 545 L ${cx + 300} 500 Z" fill="#f6c945"/>
<rect x="${cx - 300}" y="470" width="600" height="34" rx="14" fill="#d4342b"/>
<path d="M${cx - 330} 470 Q ${cx - 280} 430 ${cx - 230} 470 Q ${cx - 180} 430 ${cx - 130} 470 Q ${cx - 80} 430 ${cx - 30} 470 Q ${cx + 20} 430 ${cx + 70} 470 Q ${cx + 120} 430 ${cx + 170} 470 Q ${cx + 220} 430 ${cx + 270} 470 Q ${cx + 310} 440 ${cx + 330} 470 Z" fill="#6cae3a"/>
<path d="M${cx - 310} 445 Q ${cx - 300} 210 ${cx} 200 Q ${cx + 300} 210 ${cx + 310} 445 Z" fill="#d99145"/>
<path d="M${cx - 230} 300 Q ${cx} 220 ${cx + 200} 290" stroke="#f3c27b" stroke-width="22" fill="none" opacity="0.6" stroke-linecap="round"/>
${[...Array(14)].map((_, i) => `<ellipse cx="${cx - 200 + (i % 7) * 66}" cy="${260 + Math.floor(i / 7) * 60 + (i % 2) * 14}" rx="9" ry="5" fill="#fbe9c6"/>`).join("")}`;
}

function glass(liquid: string, garnish?: string, foam?: boolean): string {
  const cx = W / 2;
  const ice = [0, 1, 2]
    .map(
      (i) =>
        `<rect x="${cx - 90 + i * 55}" y="${300 + (i % 2) * 40}" width="70" height="70" rx="12" fill="#fff" opacity="0.35" transform="rotate(${i * 12 - 10} ${cx} 400)"/>`,
    )
    .join("");
  const deco = garnish
    ? `<circle cx="${cx + 150}" cy="210" r="70" fill="${garnish}"/><circle cx="${cx + 150}" cy="210" r="52" fill="${shade(garnish, 30)}"/>`
    : "";
  const head = foam
    ? `<path d="M${cx - 170} 250 Q ${cx - 120} 200 ${cx - 70} 240 Q ${cx - 20} 190 ${cx + 30} 238 Q ${cx + 80} 192 ${cx + 130} 240 Q ${cx + 160} 215 ${cx + 172} 250 L ${cx + 166} 330 L ${cx - 166} 330 Z" fill="#fffaf0"/>`
    : "";
  return `<ellipse cx="${cx}" cy="790" rx="210" ry="34" fill="#000" opacity="0.3"/>
<path d="M${cx - 180} 180 L ${cx - 150} 780 Q ${cx} 810 ${cx + 150} 780 L ${cx + 180} 180 Z" fill="#ffffff" opacity="0.22"/>
<path d="M${cx - 168} 260 L ${cx - 148} 770 Q ${cx} 798 ${cx + 148} 770 L ${cx + 168} 260 Z" fill="${liquid}"/>
<path d="M${cx - 168} 260 L ${cx + 168} 260" stroke="${shade(liquid, 40)}" stroke-width="14"/>
${foam ? "" : ice}${head}
<path d="M${cx - 120} 220 L ${cx - 100} 740" stroke="#fff" stroke-width="16" opacity="0.4" stroke-linecap="round"/>${deco}`;
}

function can(color: string): string {
  const cx = W / 2;
  return `<ellipse cx="${cx}" cy="800" rx="190" ry="34" fill="#000" opacity="0.3"/>
<rect x="${cx - 160}" y="180" width="320" height="610" rx="40" fill="${color}"/>
<rect x="${cx - 160}" y="180" width="320" height="60" rx="30" fill="#d9dce1"/>
<ellipse cx="${cx}" cy="186" rx="150" ry="22" fill="#b9bdc4"/>
<path d="M${cx - 160} 470 Q ${cx} 400 ${cx + 160} 470 L ${cx + 160} 520 Q ${cx} 450 ${cx - 160} 520 Z" fill="#fff" opacity="0.9"/>
<rect x="${cx - 120}" y="250" width="30" height="520" rx="15" fill="#fff" opacity="0.25"/>
<rect x="${cx - 160}" y="740" width="320" height="50" rx="25" fill="#c3c7cd"/>`;
}

function bottle(color: string): string {
  const cx = W / 2;
  return `<ellipse cx="${cx}" cy="820" rx="170" ry="30" fill="#000" opacity="0.3"/>
<path d="M${cx - 40} 90 L ${cx + 40} 90 L ${cx + 44} 260 Q ${cx + 150} 320 ${cx + 150} 420 L ${cx + 150} 790 Q ${cx} 830 ${cx - 150} 790 L ${cx - 150} 420 Q ${cx - 150} 320 ${cx - 44} 260 Z" fill="${color}"/>
<rect x="${cx - 46}" y="78" width="92" height="40" rx="10" fill="#d9c27a"/>
<rect x="${cx - 150}" y="480" width="300" height="200" fill="#f3ead6"/>
<rect x="${cx - 150}" y="500" width="300" height="12" fill="${shade(color, -10)}" opacity="0.6"/>
<rect x="${cx - 110}" y="300" width="26" height="460" rx="13" fill="#fff" opacity="0.25"/>`;
}

function productSvg(art: DemoArt, name: string): string {
  const rnd = seededRandom(hash(name));
  const body =
    art.kind === "plate" || art.kind === "bowl"
      ? plate(rnd, art.foods, art.kind === "bowl")
      : art.kind === "burger"
        ? burger()
        : art.kind === "glass"
          ? glass(art.liquid, art.garnish, art.foam)
          : art.kind === "can"
            ? can(art.color)
            : bottle(art.color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${table(rnd)}${body}<rect width="${W}" height="${H}" fill="url(#light)"/></svg>`;
}

const mountains = (w: number, h: number, base: number, color: string, rnd: Random) => {
  const peaks = Array.from(
    { length: 7 },
    (_, i) =>
      `L ${(i + 0.5) * (w / 7)} ${base - rnd.int(60, 200)} L ${(i + 1) * (w / 7)} ${base - rnd.int(0, 50)}`,
  ).join(" ");
  return `<path d="M0 ${base} ${peaks} L ${w} ${h} L 0 ${h} Z" fill="${color}"/>`;
};

function logoSvg(name: string): string {
  const rnd = seededRandom(hash(name));
  const s = 600;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
<rect width="${s}" height="${s}" fill="#f6efe2"/>
<circle cx="300" cy="300" r="270" fill="#2f5d3a"/>
<circle cx="300" cy="300" r="250" fill="none" stroke="#f6efe2" stroke-width="6"/>
<circle cx="380" cy="210" r="52" fill="#f2b33d"/>
<clipPath id="c"><circle cx="300" cy="300" r="244"/></clipPath>
<g clip-path="url(#c)">${mountains(s, s, 420, "#4f8a55", rnd)}${mountains(s, s, 470, "#1f3f27", rnd)}</g>
<path d="M220 360 L 220 470 M 200 360 L 200 410 Q 220 430 240 410 L 240 360" stroke="#f6efe2" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M380 360 Q 410 400 380 440 L 380 470" stroke="#f6efe2" stroke-width="12" fill="none" stroke-linecap="round"/>
</svg>`;
}

function coverSvg(name: string): string {
  const rnd = seededRandom(hash(name) ^ 0x9e3779b9);
  const w = 1920;
  const h = 640;
  const plates = [300, 760, 1220, 1680]
    .map(
      (x, i) =>
        `<ellipse cx="${x}" cy="610" rx="150" ry="40" fill="#fbfbf8"/><ellipse cx="${x}" cy="604" rx="96" ry="24" fill="${["#c8372d", "#e8b64c", "#5c9a3a", "#7a3b2a"][i]}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b267"/><stop offset="0.6" stop-color="#f7d9a8"/><stop offset="1" stop-color="#fbeedd"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<circle cx="1420" cy="240" r="90" fill="#fff3d6" opacity="0.9"/>
${mountains(w, h, 420, "#8fb08a", rnd)}${mountains(w, h, 480, "#4f7d55", rnd)}${mountains(w, h, 540, "#2f5d3a", rnd)}
<rect y="560" width="${w}" height="80" fill="#7b5134"/>${plates}
</svg>`;
}

const jpeg = (svg: string) =>
  sharp(Buffer.from(svg))
    .jpeg({ quality: 86 })
    .toBuffer()
    .then((b) => new Uint8Array(b));

export const demoArtist: DemoArtist = {
  product: (art, name) => jpeg(productSvg(art, name)),
  logo: (name) => jpeg(logoSvg(name)),
  cover: (name) => jpeg(coverSvg(name)),
};
