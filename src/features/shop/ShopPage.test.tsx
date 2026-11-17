import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import type { OwnedItem, ShopItem } from "../../lib/shop";

vi.mock("../../lib/shop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/shop")>();
  return {
    ...actual,
    fetchShopCatalog: vi.fn(),
    fetchMyShopItems: vi.fn(),
    buyShopItem: vi.fn(),
    equipShopItem: vi.fn(),
  };
});
vi.mock("../../lib/diamonds", () => ({ fetchWallet: vi.fn() }));

import { fetchWallet } from "../../lib/diamonds";
import { buyShopItem, equipShopItem, fetchMyShopItems, fetchShopCatalog } from "../../lib/shop";
import { ShopPage } from "./ShopPage";

const session = {
  access_token: "t",
  refresh_token: "",
  expires_at: 0,
  user: { id: "u1", email: "ana@example.com", user_metadata: { name: "Ana" } },
} as SupabaseSession;

function item(over: Partial<ShopItem> = {}): ShopItem {
  return {
    id: "f1",
    category: "frame",
    tier: "common",
    name: "Anel dourado",
    description: "Um aro simples",
    price: 50,
    image_url: "/shop/moldura-anel-dourado.webp",
    animated_url: null,
    colors: null,
    owned: false,
    equipped: false,
    available_until: null,
    remaining: null,
    ...over,
  };
}

function wallet(balance: number) {
  return { balance, freezes_this_week: 0, freeze_price: 10, freezes_per_week: 2, goal_minutes: 10, goal_reward: 5 };
}

function setup(catalog: ShopItem[], balance: number, mine: OwnedItem[] = []) {
  vi.mocked(fetchShopCatalog).mockResolvedValue(catalog);
  vi.mocked(fetchMyShopItems).mockResolvedValue(mine);
  vi.mocked(fetchWallet).mockResolvedValue(wallet(balance));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

describe("ShopPage", () => {
  it("sem saldo suficiente o botão de compra fica desligado e diz quanto falta", async () => {
    setup([item({ price: 50 })], 40);
    render(<ShopPage session={session} />);
    const button = await screen.findByRole("button", { name: "Faltam 10 💎" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Comprar/ })).toBeNull();
    expect(screen.getByText("Comum")).toBeInTheDocument();
    expect(screen.getByText("Um aro simples")).toBeInTheDocument();
  });

  it("compra uma vez só mesmo com dois cliques, atualiza o saldo e oferece equipar", async () => {
    setup([item({ price: 50 })], 120);
    let resolve!: (v: { balance: number; item_id: string; duplicate: boolean }) => void;
    vi.mocked(buyShopItem).mockReturnValue(new Promise((r) => (resolve = r)));
    const onBalance = vi.fn();
    render(<ShopPage session={session} onBalance={onBalance} />);

    fireEvent.click(await screen.findByRole("button", { name: "Comprar · 50 💎" }));
    const confirm = screen.getByRole("button", { name: "Confirmar compra" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(buyShopItem).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ balance: 70, item_id: "f1", duplicate: false }));
    expect(await screen.findByText("Equipar agora?")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo: 70 diamantes")).toBeInTheDocument();
    expect(onBalance).toHaveBeenCalledWith(70);
    expect(buyShopItem).toHaveBeenCalledTimes(1);
  });

  it("depois de erro de rede, a nova tentativa usa o mesmo ref", async () => {
    setup([item({ price: 50 })], 120);
    vi.mocked(buyShopItem)
      .mockRejectedValueOnce(new Error("Sem conexão"))
      .mockResolvedValueOnce({ balance: 70, item_id: "f1", duplicate: false });
    render(<ShopPage session={session} />);

    fireEvent.click(await screen.findByRole("button", { name: "Comprar · 50 💎" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Equipar agora?")).toBeInTheDocument();

    expect(buyShopItem).toHaveBeenCalledTimes(2);
    const [first, second] = vi.mocked(buyShopItem).mock.calls;
    expect(first[1]).toBe("f1");
    expect(typeof first[2]).toBe("string");
    expect(first[2]).toBeTruthy();
    expect(second[2]).toBe(first[2]);
  });

  it("item possuído aparece como Seu, com Equipar e sem Comprar", async () => {
    setup([item({ owned: true })], 500);
    render(<ShopPage session={session} />);
    expect(await screen.findByText("Seu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equipar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Comprar/ })).toBeNull();
  });

  it("item esgotado não pode ser comprado", async () => {
    setup([item({ remaining: 0 })], 500);
    render(<ShopPage session={session} />);
    expect(await screen.findByRole("button", { name: "Esgotado" })).toBeDisabled();
  });

  it("em Capas, 'Usar minha foto de capa' tira a capa da loja", async () => {
    const cover = item({
      id: "c1",
      category: "cover",
      name: "Noite estrelada",
      image_url: "/shop/capa-noite-estrelada.webp",
      owned: true,
      equipped: true,
    });
    setup([cover], 500);
    vi.mocked(equipShopItem).mockResolvedValue({ frame: null, badge: null, name_color: null });
    render(<ShopPage session={session} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Capas" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar minha foto de capa" }));
    await waitFor(() => expect(equipShopItem).toHaveBeenCalledWith(session, "cover", null));
  });

  it("Meus itens lista o que a pessoa tem e permite tirar o equipado", async () => {
    const owned: OwnedItem = {
      item_id: "b1",
      category: "badge",
      tier: "rare",
      name: "Coruja",
      image_url: "/shop/insignia-coruja.webp",
      animated_url: null,
      colors: null,
      equipped: true,
      price_paid: 300,
      bought_at: "2026-11-10T00:00:00Z",
    };
    setup([], 0, [owned]);
    vi.mocked(equipShopItem).mockResolvedValue({ frame: null, badge: null, name_color: null });
    render(<ShopPage session={session} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Meus itens" }));
    expect(screen.getByText("Coruja")).toBeInTheDocument();
    expect(screen.getByText("Raro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tirar" }));
    await waitFor(() => expect(equipShopItem).toHaveBeenCalledWith(session, "badge", null));
  });
});
