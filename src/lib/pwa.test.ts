import { describe, expect, it } from "vitest";
import { installPlatform, storeLinks } from "./pwa";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

describe("installPlatform", () => {
  it("reconhece iPhone e iPad (que se apresenta como Mac, mas tem tela de toque)", () => {
    expect(installPlatform(UA.iphone, 5)).toBe("ios");
    expect(installPlatform(UA.ipad, 5)).toBe("ios");
  });

  it("reconhece Android", () => {
    expect(installPlatform(UA.android, 5)).toBe("android");
  });

  it("separa Safari no Mac de Chrome/Edge no computador e do Firefox", () => {
    expect(installPlatform(UA.ipad, 0)).toBe("mac-safari");
    expect(installPlatform(UA.macChrome, 0)).toBe("desktop");
    expect(installPlatform(UA.windowsEdge, 0)).toBe("desktop");
    expect(installPlatform(UA.windowsFirefox, 0)).toBe("firefox-desktop");
  });
});

describe("storeLinks", () => {
  it("usa só links https das lojas", () => {
    expect(
      storeLinks({ VITE_ANDROID_APP_URL: " https://play.google.com/store/apps/details?id=x ", VITE_IOS_APP_URL: "javascript:alert(1)" }),
    ).toEqual({ android: "https://play.google.com/store/apps/details?id=x", ios: null });
  });

  it("sem links configurados, não há loja", () => {
    expect(storeLinks({})).toEqual({ android: null, ios: null });
  });
});
