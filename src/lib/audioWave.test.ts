import { describe, expect, it } from "vitest";
import { nextRate, peaksFromSamples, placeholderPeaks, rateLabel, seekFraction } from "./audioWave";

describe("peaksFromSamples", () => {
  it("devolve uma altura por barra, o trecho mais alto vale 1", () => {
    const samples = [0, 0, 0.5, -0.5, 1, -1, 0.25, -0.25];
    const peaks = peaksFromSamples(samples, 4);
    expect(peaks).toHaveLength(4);
    expect(peaks[2]).toBe(1);
    expect(peaks[1]).toBeCloseTo(0.5);
    expect(peaks[0]).toBe(0.12);
  });

  it("silêncio ou arquivo vazio vira o traço mínimo", () => {
    expect(peaksFromSamples(new Float32Array(100), 5)).toEqual([0.12, 0.12, 0.12, 0.12, 0.12]);
    expect(peaksFromSamples([], 3)).toEqual([0.12, 0.12, 0.12]);
  });

  it("áudio mais curto que o número de barras não quebra", () => {
    const peaks = peaksFromSamples([0.4, 0.8], 6);
    expect(peaks).toHaveLength(6);
    peaks.forEach((p) => expect(p).toBeGreaterThanOrEqual(0.12));
  });
});

describe("placeholderPeaks", () => {
  it("é sempre a mesma para a mesma mensagem e fica entre o mínimo e 1", () => {
    const a = placeholderPeaks(42, 30);
    expect(a).toEqual(placeholderPeaks(42, 30));
    expect(a).not.toEqual(placeholderPeaks(43, 30));
    a.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0.12);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it("aceita id negativo (mensagem ainda não enviada)", () => {
    expect(placeholderPeaks(-1700000000000, 10)).toHaveLength(10);
  });
});

describe("seekFraction", () => {
  it("limita a posição entre o começo e o fim", () => {
    expect(seekFraction(150, 100, 200)).toBe(0.25);
    expect(seekFraction(50, 100, 200)).toBe(0);
    expect(seekFraction(400, 100, 200)).toBe(1);
    expect(seekFraction(150, 100, 0)).toBe(0);
  });
});

describe("velocidade", () => {
  it("gira entre 1×, 1,5× e 2×", () => {
    expect(nextRate(1)).toBe(1.5);
    expect(nextRate(1.5)).toBe(2);
    expect(nextRate(2)).toBe(1);
    expect(rateLabel(1.5)).toBe("1,5×");
  });
});
