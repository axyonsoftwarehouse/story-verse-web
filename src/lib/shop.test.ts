import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./rpc", () => ({ rpc: (...a: unknown[]) => rpc(...a) }));

import { buyShopItem, contrastRatio, equipShopItem, fetchShopCatalog, nameColorStyle, shopAssetUrl } from "./shop";

const session = {
  access_token: "t",
  refresh_token: "r",
  expires_at: 9999999999,
  user: { id: "u1", email: "u@example.test" },
};

beforeEach(() => rpc.mockReset());

describe("shopAssetUrl", () => {
  it("resolve caminho relativo na origem do app", () => {
    const url = shopAssetUrl("/shop/a.webp");
    expect(url.endsWith("/shop/a.webp")).toBe(true);
    expect(url.startsWith(window.location.origin)).toBe(true);
  });
  it("deixa https passar e descarta o resto", () => {
    expect(shopAssetUrl("https://x.test/a.png")).toBe("https://x.test/a.png");
    expect(shopAssetUrl("javascript:alert(1)")).toBe("");
    expect(shopAssetUrl("//evil.test/a.png")).toBe("");
    expect(shopAssetUrl("http://x.test/a.png")).toBe("");
  });
});

describe("nameColorStyle", () => {
  it("sem cores, nada", () => expect(nameColorStyle(null)).toBeUndefined());
  it("uma cor vira color", () => expect(nameColorStyle(["#f1cf88"])).toEqual({ color: "#f1cf88" }));
  it("três cores viram degradê no texto", () => {
    const s = nameColorStyle(["#111111", "#222222", "#333333"])!;
    expect(s.backgroundImage).toContain("#111111");
    expect(s.backgroundImage).toContain("#222222");
    expect(s.backgroundImage).toContain("#333333");
    expect(s.color).toBe("transparent");
    expect(s.backgroundClip).toBe("text");
  });
});

describe("contrastRatio", () => {
  it("preto no branco é 21", () => expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1));
  it("igual é 1", () => expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5));
});

describe("cliente da loja", () => {
  it("compra reusando o ref", async () => {
    rpc.mockResolvedValue([{ balance: 5, item_id: "i", duplicate: false }]);
    const r = await buyShopItem(session, "i", "ref-1");
    expect(r).toEqual({ balance: 5, item_id: "i", duplicate: false });
    expect(rpc).toHaveBeenCalledWith(session, "buy_shop_item", { item: "i", ref: "ref-1" }, { feature: "A loja" });
  });
  it("compra sem resposta falha", async () => {
    rpc.mockResolvedValue([]);
    await expect(buyShopItem(session, "i")).rejects.toThrow();
  });
  it("equipa e desequipa", async () => {
    rpc.mockResolvedValue({ frame: null, badge: null, name_color: null });
    await equipShopItem(session, "frame", null);
    expect(rpc).toHaveBeenCalledWith(session, "equip_shop_item", { category: "frame", item: null }, { feature: "A loja" });
  });
  it("catálogo nulo vira lista vazia", async () => {
    rpc.mockResolvedValue(null);
    expect(await fetchShopCatalog(session)).toEqual([]);
  });
});
