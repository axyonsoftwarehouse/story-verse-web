// Exporta a arte da loja: design/shop-items/*.svg -> public/shop/*.webp.
// Uso: node scripts/export-shop-items.mjs   (precisa do ffmpeg no PATH, com libwebp e libwebp_anim)
//
// - SVG renderizado com @resvg/resvg-js (devDependency) e codificado em WebP pelo ffmpeg.
// - Molduras ("moldura-*") e insígnias saem sem perda; capas saem com perda (q 86).
// - Moldura com <g id="giro" data-giro-graus="N"> ganha também "<slug>-animada.webp": o grupo gira N graus
//   2,5° por quadro, 12 quadros por segundo (30°/s). N deve ser uma simetria do desenho para o laço fechar liso.
// - Confere que nenhuma moldura tem pixel visível dentro do furo da foto (raio 37% do lado).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const SRC = join(root, "design/shop-items");
const OUT = join(root, "public/shop");
const STEP = 2.5;
const FPS = 12;
const HOLE = 0.37;
const LIMIT = { static: 1024 * 1024, animated: 3 * 1024 * 1024 };

function render(svgText) {
  const img = new Resvg(svgText, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render();
  return { png: img.asPng(), pixels: img.pixels, width: img.width, height: img.height };
}

function checkHole(name, { pixels, width, height }) {
  const cx = width / 2;
  const cy = height / 2;
  const limit = (HOLE * width - 0.5) ** 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d < limit && pixels[(y * width + x) * 4 + 3] !== 0) {
        throw new Error(`${name}: pixel visível dentro do furo da foto em (${x}, ${y})`);
      }
    }
  }
}

function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`ffmpeg falhou: ${run.stderr}`);
}

const webpArgs = (lossless) =>
  lossless
    ? ["-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"]
    : ["-c:v", "libwebp", "-lossless", "0", "-q:v", "86", "-compression_level", "6", "-pix_fmt", "yuv420p"];

function sizeOk(path, limit) {
  const size = statSync(path).size;
  if (size > limit) throw new Error(`${path}: ${size} bytes passa do limite de ${limit}`);
  return size;
}

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "shop-items-"));
try {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".svg")).sort();
  for (const file of files) {
    const slug = file.replace(/\.svg$/, "");
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Nome inválido: ${file}`);
    const svgText = readFileSync(join(SRC, file), "utf8");
    const isFrame = slug.startsWith("moldura-");
    const lossless = !slug.startsWith("capa-");

    const still = render(svgText);
    if (isFrame) checkHole(file, still);
    const png = join(work, `${slug}.png`);
    writeFileSync(png, still.png);
    const out = join(OUT, `${slug}.webp`);
    ffmpeg(["-i", png, ...webpArgs(lossless), "-map_metadata", "-1", "-fflags", "+bitexact", out]);
    console.log(`${slug}.webp  ${still.width}x${still.height}  ${sizeOk(out, LIMIT.static)} B`);

    const spin = /<g id="giro" data-giro-graus="(\d+(?:\.\d+)?)">/.exec(svgText);
    if (!spin) continue;
    const degrees = Number(spin[1]);
    const frames = Math.round(degrees / STEP);
    const dir = join(work, slug);
    mkdirSync(dir);
    for (let i = 0; i < frames; i++) {
      const angle = ((i * degrees) / frames).toFixed(4);
      const frameSvg = svgText.replace(spin[0], `<g id="giro" transform="rotate(${angle} ${still.width / 2} ${still.height / 2})">`);
      const frame = render(frameSvg);
      if (isFrame) checkHole(`${file} quadro ${i}`, frame);
      writeFileSync(join(dir, `q${String(i).padStart(3, "0")}.png`), frame.png);
    }
    const animated = join(OUT, `${slug}-animada.webp`);
    ffmpeg([
      "-framerate", String(FPS), "-i", join(dir, "q%03d.png"),
      "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", "80", "-compression_level", "4", "-pix_fmt", "yuva420p",
      "-loop", "0", "-map_metadata", "-1", "-fflags", "+bitexact", animated,
    ]);
    console.log(`${slug}-animada.webp  ${frames} quadros  ${sizeOk(animated, LIMIT.animated)} B`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
