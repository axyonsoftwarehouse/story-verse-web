import { describe, expect, it } from "vitest";
import { initialCrop, MIN_CROP, moveCrop, resizeCrop } from "./cropMath";

describe("moldura de corte", () => {
  it("arrasta sem sair da imagem", () => {
    expect(moveCrop({ x: 10, y: 10, w: 100, h: 100 }, 500, -50, 300, 200)).toEqual({ x: 200, y: 0, w: 100, h: 100 });
  });

  it("puxar um canto deixa o oposto parado e respeita o mínimo e as bordas", () => {
    const r = { x: 50, y: 50, w: 100, h: 100 };
    expect(resizeCrop(r, "se", 30, 20, 300, 300, null)).toEqual({ x: 50, y: 50, w: 130, h: 120 });
    expect(resizeCrop(r, "nw", 40, 40, 300, 300, null)).toEqual({ x: 90, y: 90, w: 60, h: 60 });
    expect(resizeCrop(r, "nw", 200, 200, 300, 300, null)).toEqual({ x: 150 - MIN_CROP, y: 150 - MIN_CROP, w: MIN_CROP, h: MIN_CROP });
    expect(resizeCrop(r, "se", 1000, 1000, 300, 300, null)).toEqual({ x: 50, y: 50, w: 250, h: 250 });
  });

  it("com proporção travada, continua quadrado e dentro da imagem", () => {
    const sq = resizeCrop({ x: 0, y: 0, w: 100, h: 100 }, "se", 80, 10, 400, 150, 1);
    expect(sq.w).toBe(sq.h);
    expect(sq.h).toBeLessThanOrEqual(150);
  });

  it("começa com a maior moldura centralizada", () => {
    expect(initialCrop(400, 200, 1)).toEqual({ x: 100, y: 0, w: 200, h: 200 });
    expect(initialCrop(400, 200, null)).toEqual({ x: 0, y: 0, w: 400, h: 200 });
  });
});
