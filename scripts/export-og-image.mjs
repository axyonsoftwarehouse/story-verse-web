// Exporta a prévia de link (Open Graph): design/og-image.svg -> public/og-image.png (1200x630).
// Uso: node scripts/export-og-image.mjs
// Usa as fontes do sistema (Georgia e Segoe UI no Windows); confira o PNG depois de gerar.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const svg = readFileSync(join(root, "design/og-image.svg"), "utf8");
const img = new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: true } }).render();
if (img.width !== 1200 || img.height !== 630) throw new Error(`tamanho errado: ${img.width}x${img.height}`);
const png = img.asPng();
writeFileSync(join(root, "public/og-image.png"), png);
console.log(`public/og-image.png: ${img.width}x${img.height}, ${(png.length / 1024).toFixed(0)} KB`);
