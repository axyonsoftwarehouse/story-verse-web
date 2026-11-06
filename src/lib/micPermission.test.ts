import { describe, expect, it } from "vitest";
import { detectPlatform, micProblem, micSteps } from "./micPermission";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

describe("microfone", () => {
  it("reconhece o aparelho para mostrar o caminho certo", () => {
    expect(detectPlatform(UA.iphone, false)).toBe("ios");
    expect(detectPlatform(UA.android, false)).toBe("android");
    expect(detectPlatform(UA.android, true)).toBe("android-app");
    expect(detectPlatform(UA.chrome, false)).toBe("desktop-chrome");
    expect(detectPlatform(UA.edge, false)).toBe("desktop-chrome");
    expect(detectPlatform(UA.firefox, false)).toBe("desktop-firefox");
    expect(detectPlatform(UA.safari, false)).toBe("desktop-safari");
  });

  it("separa bloqueio de permissão de microfone ausente ou ocupado", () => {
    expect(micProblem(new DOMException("x", "NotAllowedError"))).toBe("blocked");
    expect(micProblem(new DOMException("x", "NotFoundError"))).toBe("missing");
    expect(micProblem(new DOMException("x", "NotReadableError"))).toBe("busy");
    expect(micProblem(new DOMException("x", "SecurityError"))).toBe("insecure");
    expect(micProblem(new Error("qualquer"))).toBe("blocked");
  });

  it("todo aparelho tem passos", () => {
    for (const p of ["ios", "android-app", "android", "desktop-chrome", "desktop-firefox", "desktop-safari"] as const) {
      expect(micSteps(p).length).toBeGreaterThanOrEqual(2);
    }
    expect(micSteps("ios").join(" ")).toContain("Ajustes do Site");
  });
});
