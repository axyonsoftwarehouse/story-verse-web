import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  createShopItem,
  deleteShopItem,
  listShopItems,
  updateShopItem,
  type AdminShopItem,
} from "../../lib/adminShop";
import { ShopItemsSection } from "./ShopItemsSection";

vi.mock("../../lib/adminShop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminShop")>();
  return {
    ...actual,
    listShopItems: vi.fn(),
    createShopItem: vi.fn(),
    updateShopItem: vi.fn(),
    deleteShopItem: vi.fn(),
  };
});

const session = { access_token: "token", user: { id: "admin-1" } } as SupabaseSession;

function item(patch: Partial<AdminShopItem> = {}): AdminShopItem {
  return {
    id: "i1",
    category: "frame",
    tier: "rare",
    name: "Moldura de folhas",
    description: "Folhas de outono em volta do rosto.",
    price: 400,
    status: "on_sale",
    image_url: "/shop/moldura-folhas.webp",
    animated_url: null,
    colors: null,
    sort_order: 0,
    available_from: null,
    available_until: null,
    stock: null,
    sold: 3,
    owners: 3,
    created_at: "2026-11-12T00:00:00Z",
    updated_at: "2026-11-12T00:00:00Z",
    ...patch,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function openNewItem() {
  render(<ShopItemsSection session={session} />);
  await screen.findByText(/Nenhum item/);
  fireEvent.click(screen.getByRole("button", { name: "Novo item" }));
  return screen.getByRole("dialog");
}

describe("ShopItemsSection", () => {
  beforeEach(() => {
    vi.mocked(listShopItems).mockResolvedValue([]);
    vi.mocked(createShopItem).mockImplementation(async (_session, input) => item({ ...input, id: "novo", owners: 0, sold: 0 }));
    vi.mocked(updateShopItem).mockImplementation(async (_session, id, input) => item({ ...input, id }));
    vi.mocked(deleteShopItem).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("item já vendido não tem Apagar, só Tirar de venda; item sem dono pode ser apagado", async () => {
    vi.mocked(listShopItems).mockResolvedValue([
      item(),
      item({ id: "i2", name: "Insígnia de pena", category: "badge", owners: 0, sold: 0, status: "draft" }),
    ]);
    render(<ShopItemsSection session={session} />);

    const sold = (await screen.findByText("Moldura de folhas")).closest("li")!;
    expect(within(sold).getByText("3 donos")).toBeInTheDocument();
    expect(within(sold).queryByRole("button", { name: "Apagar" })).toBeNull();
    expect(within(sold).getByRole("button", { name: "Tirar de venda" })).toBeInTheDocument();

    const fresh = screen.getByText("Insígnia de pena").closest("li")!;
    expect(within(fresh).getByRole("button", { name: "Apagar" })).toBeInTheDocument();
    expect(within(fresh).getByRole("button", { name: "Pôr à venda" })).toBeInTheDocument();
  });

  it("Tirar de venda manda o item inteiro com o estado novo", async () => {
    vi.mocked(listShopItems).mockResolvedValue([item()]);
    render(<ShopItemsSection session={session} />);

    fireEvent.click(await screen.findByRole("button", { name: "Tirar de venda" }));

    await waitFor(() => expect(updateShopItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateShopItem).mock.calls[0][1]).toBe("i1");
    expect(vi.mocked(updateShopItem).mock.calls[0][2]).toMatchObject({
      category: "frame",
      tier: "rare",
      name: "Moldura de folhas",
      price: 400,
      status: "off_sale",
      image_url: "/shop/moldura-folhas.webp",
    });
  });

  it("filtra por tipo e estado na API", async () => {
    render(<ShopItemsSection session={session} />);
    await screen.findByText(/Nenhum item/);

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "badge" } });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "on_sale" } });

    await waitFor(() =>
      expect(listShopItems).toHaveBeenLastCalledWith(session, { category: "badge", status: "on_sale" }),
    );
  });

  it("cor sem contraste mostra aviso e bloqueia Salvar", async () => {
    const dialog = await openNewItem();
    fireEvent.change(within(dialog).getByLabelText("Tipo"), { target: { value: "name_color" } });
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Brasa" } });

    fireEvent.change(within(dialog).getByLabelText("Cor 1"), { target: { value: "#333333" } });

    expect(within(dialog).getByRole("alert")).toHaveTextContent(/#333333.*contraste/i);
    expect(within(dialog).getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Cor 1"), { target: { value: "#f4d58d" } });
    expect(within(dialog).queryByText(/contraste/i)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Salvar" })).toBeEnabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(createShopItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createShopItem).mock.calls[0][1]).toMatchObject({
      category: "name_color",
      name: "Brasa",
      colors: ["#f4d58d"],
      image_url: null,
      animated_url: null,
    });
  });

  it("erro 400 do upload mostra a mensagem do servidor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { error: "A moldura precisa ser quadrada." }));
    vi.stubGlobal("fetch", fetchMock);
    const dialog = await openNewItem();

    const file = new File(["png"], "moldura.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Imagem parada"), { target: { files: [file] } });

    expect(await within(dialog).findByText("A moldura precisa ser quadrada.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/admin/shop/images?kind=frame");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    expect(((init as RequestInit).body as FormData).get("file")).toBe(file);
  });

  it("prévia mostra a moldura depois do upload", async () => {
    const uploaded = "https://api.test/api/v1/storage/public/shop-items/items/frame-1.png";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { url: uploaded })));
    const dialog = await openNewItem();
    expect(dialog.querySelector("img.face-frame")).toBeNull();

    const file = new File(["png"], "moldura.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Imagem parada"), { target: { files: [file] } });

    await waitFor(() => expect(dialog.querySelectorAll("img.face-frame").length).toBe(2));
    expect(dialog.querySelector("img.face-frame")).toHaveAttribute("src", uploaded);
  });

  it("moldura épica pede a imagem animada e a dica de preço do nível", async () => {
    const dialog = await openNewItem();
    expect(within(dialog).queryByLabelText("Imagem animada")).toBeNull();
    expect(within(dialog).getByText(/Comum: de 50 a 150/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nível"), { target: { value: "epic" } });

    expect(within(dialog).getByLabelText("Imagem animada")).toBeInTheDocument();
    expect(within(dialog).getByText(/Épico: a partir de 800/)).toBeInTheDocument();
  });
});
