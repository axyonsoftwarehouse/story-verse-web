/// <reference types="node" />
// O TS 6 não inclui mais os tipos do Node sozinho; este teste lê o README e as imagens do disco.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../lib/shop";

/** Primeiro lote da loja: a tabela do README é a fonte da V56 (Task 4) e aponta para os arquivos em public/shop. */

type Row = {
  id: string;
  slug: string;
  category: string;
  tier: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  animated_url: string | null;
  colors: string[] | null;
};

const root = process.cwd();
const COLUMNS = ["id", "slug", "category", "tier", "name", "description", "price", "image_url", "animated_url", "colors"];
const empty = (cell: string) => (cell === "-" ? null : cell);

function readRows(): Row[] {
  const md = readFileSync(resolve(root, "design/shop-items/README.md"), "utf8").replace(/\r\n/g, "\n");
  const lines = md.split("\n").filter((line) => line.startsWith("|"));
  const cells = (line: string) => line.slice(1, -1).split("|").map((c) => c.trim().replace(/^`|`$/g, ""));
  expect(cells(lines[0])).toEqual(COLUMNS);
  return lines.slice(2).map((line) => {
    const c = cells(line);
    expect(c).toHaveLength(COLUMNS.length);
    return {
      id: c[0],
      slug: c[1],
      category: c[2],
      tier: c[3],
      name: c[4],
      description: c[5],
      price: Number(c[6]),
      image_url: empty(c[7]),
      animated_url: empty(c[8]),
      colors: empty(c[9])?.split(",").map((s) => s.trim()) ?? null,
    };
  });
}

/** Largura e altura de um WebP (VP8, VP8L ou VP8X). */
function webpSize(buf: Buffer): { width: number; height: number } {
  expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buf.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  throw new Error(`WebP desconhecido: ${chunk}`);
}

const fileOf = (url: string) => resolve(root, "public", url.replace(/^\//, ""));
const PRICE: Record<string, [number, number]> = { common: [50, 150], rare: [300, 600], epic: [800, 100000] };
const SIZE: Record<string, [number, number]> = { frame: [512, 512], badge: [256, 256], cover: [1500, 500] };
const MB = 1024 * 1024;

describe("primeiro lote da loja", () => {
  const rows = readRows();
  const of = (category: string) => rows.filter((r) => r.category === category);

  it("tem as quantidades combinadas por categoria", () => {
    expect(of("frame").length).toBeGreaterThanOrEqual(6);
    expect(of("frame").filter((r) => r.tier === "epic")).toHaveLength(1);
    expect(of("badge").length).toBeGreaterThanOrEqual(6);
    expect(of("cover")).toHaveLength(3);
    expect(of("name_color")).toHaveLength(3);
    expect(rows.every((r) => ["frame", "badge", "cover", "name_color"].includes(r.category))).toBe(true);
  });

  it("usa uuids v4 únicos, slugs válidos e textos no tamanho do banco", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(r.slug).toMatch(/^[a-z0-9-]+$/);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.name.length).toBeLessThanOrEqual(60);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.description.length).toBeLessThanOrEqual(200);
    }
  });

  it("põe cada preço na faixa do nível", () => {
    for (const r of rows) {
      const [min, max] = PRICE[r.tier];
      expect(Number.isInteger(r.price), r.slug).toBe(true);
      expect(r.price, r.slug).toBeGreaterThanOrEqual(min);
      expect(r.price, r.slug).toBeLessThanOrEqual(max);
    }
  });

  it("aponta para arquivos que existem em public/shop, no tamanho e no peso certos", () => {
    for (const r of rows.filter((x) => x.category !== "name_color")) {
      expect(r.image_url, r.slug).toBe(`/shop/${r.slug}.webp`);
      expect(r.image_url).toMatch(/^\/shop\/[a-z0-9-]+\.(webp|png)$/);
      const path = fileOf(r.image_url!);
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size, path).toBeLessThanOrEqual(1 * MB);
      const [w, h] = SIZE[r.category];
      expect(webpSize(readFileSync(path)), path).toEqual({ width: w, height: h });
    }
  });

  it("dá à moldura épica, e só a ela, um WebP animado", () => {
    for (const r of rows) {
      if (r.category === "frame" && r.tier === "epic") {
        expect(r.animated_url).toBe(`/shop/${r.slug}-animada.webp`);
        const path = fileOf(r.animated_url!);
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size).toBeLessThanOrEqual(3 * MB);
        const buf = readFileSync(path);
        expect(webpSize(buf)).toEqual({ width: 512, height: 512 });
        expect(buf.includes(Buffer.from("ANMF"))).toBe(true);
      } else {
        expect(r.animated_url, r.slug).toBeNull();
      }
    }
  });

  it("dá cores de nome legíveis nos dois temas", () => {
    for (const r of rows) {
      if (r.category !== "name_color") {
        expect(r.colors, r.slug).toBeNull();
        continue;
      }
      expect(r.image_url).toBeNull();
      expect(r.colors!.length).toBeGreaterThanOrEqual(1);
      expect(r.colors!.length).toBeLessThanOrEqual(3);
      for (const color of r.colors!) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrastRatio(color, "#14110e"), `${r.slug} ${color}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(color, "#0e1612"), `${r.slug} ${color}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const lengths = of("name_color").map((r) => r.colors!.length).sort();
    expect(lengths[0]).toBe(1);
    expect(lengths.filter((n) => n > 1)).toHaveLength(2);
  });
});
