import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPerson = vi.fn();

vi.mock("../../lib/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/backend")>()),
  apiEnabled: true,
}));

vi.mock("../../lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/social")>()),
  getPerson: (id: string) => getPerson(id),
}));

import { ownProfileCover, useOwnProfileExtras } from "./useOwnProfileExtras";

const uploaded = "https://cdn.example.com/eu/cover.jpg";
const frame = { image: "/shop/f-ouro.png", animated: null, tier: "rare" as const };

describe("capa e enfeites do próprio perfil", () => {
  beforeEach(() => {
    getPerson.mockReset();
  });

  it("antes de chegar: nenhuma capa (só guarda o espaço da enviada); depois: a comprada", async () => {
    let resolve!: (v: unknown) => void;
    getPerson.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useOwnProfileExtras("u-loading"));
    expect(result.current.loaded).toBe(false);
    expect(ownProfileCover(result.current, uploaded)).toEqual({ url: null, reserve: true });
    expect(ownProfileCover(result.current, null)).toEqual({ url: null, reserve: false });

    await act(async () => resolve({ cosmetics: { frame, badge: null, name_color: null }, shop_cover: "/shop/c-mar.webp", badge_shelf: [] }));
    expect(result.current.loaded).toBe(true);
    expect(result.current.extras?.cosmetics?.frame?.image).toBe("/shop/f-ouro.png");
    expect(ownProfileCover(result.current, uploaded)).toEqual({ url: `${window.location.origin}/shop/c-mar.webp`, reserve: true });
  });

  it("se a busca falhar, volta para a capa enviada", async () => {
    getPerson.mockRejectedValue(new Error("sem a comunidade"));
    const { result } = renderHook(() => useOwnProfileExtras("u-fail"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.extras).toBeNull();
    expect(ownProfileCover(result.current, uploaded)).toEqual({ url: uploaded, reserve: true });
  });

  it("reabrir o perfil usa o último resultado na hora (sem piscar)", async () => {
    getPerson.mockResolvedValue({ cosmetics: null, shop_cover: "/shop/c-mar.webp", badge_shelf: [] });
    const first = renderHook(() => useOwnProfileExtras("u-cache"));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    first.unmount();
    getPerson.mockReturnValue(new Promise(() => {}));
    const again = renderHook(() => useOwnProfileExtras("u-cache"));
    expect(again.result.current.loaded).toBe(true);
    expect(ownProfileCover(again.result.current, null).url).toBe(`${window.location.origin}/shop/c-mar.webp`);
  });
});
