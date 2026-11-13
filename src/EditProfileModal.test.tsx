import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const equipShopItem = vi.fn();
const updateProfileData = vi.fn();
const uploadProfileImage = vi.fn();
const prepareImage = vi.fn();

vi.mock("./lib/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/backend")>()),
  apiEnabled: true,
}));
vi.mock("./lib/shop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/shop")>()),
  equipShopItem: (...args: unknown[]) => equipShopItem(...args),
}));
vi.mock("./lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/auth")>()),
  updateProfileData: (...args: unknown[]) => updateProfileData(...args),
}));
vi.mock("./lib/profileMedia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/profileMedia")>()),
  uploadProfileImage: (...args: unknown[]) => uploadProfileImage(...args),
  prepareImage: (...args: unknown[]) => prepareImage(...args),
}));

import { EditProfileModal } from "./App";
import type { SupabaseSession } from "./lib/auth";
import { clearOwnShopCover } from "./features/shop/useOwnProfileExtras";

const session = {
  access_token: "t",
  user: { id: "u1", email: "a@b.c", user_metadata: { name: "Ana", cover: "https://cdn.example.com/velha.jpg" } },
} as unknown as SupabaseSession;

function setup() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const view = render(<EditProfileModal session={session} onSaved={onSaved} onClose={onClose} />);
  return { onSaved, onClose, view };
}

async function pickNewCover(view: ReturnType<typeof render>) {
  const input = view.container.querySelectorAll<HTMLInputElement>('.edit-cover-actions input[type="file"]')[0];
  fireEvent.change(input, { target: { files: [new File(["x"], "capa.png", { type: "image/png" })] } });
  await waitFor(() => expect(view.container.querySelector(".edit-cover.has-cover")).not.toBeNull());
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
}

describe("Editar perfil e a capa comprada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:nova");
    globalThis.URL.revokeObjectURL = vi.fn();
    prepareImage.mockResolvedValue(new Blob(["x"]));
    uploadProfileImage.mockResolvedValue("https://cdn.example.com/nova.jpg");
    updateProfileData.mockResolvedValue(session);
    equipShopItem.mockResolvedValue({ frame: null, badge: null, name_color: null });
  });

  it("salvar uma capa nova desequipa a capa comprada", async () => {
    const { onClose, view } = setup();
    await pickNewCover(view);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(equipShopItem).toHaveBeenCalledWith(session, "cover", null);
  });

  it("salvar sem mexer na capa não mexe na capa comprada", async () => {
    const { onClose } = setup();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Maria" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(equipShopItem).not.toHaveBeenCalled();
  });

  it("se desequipar falhar, o perfil salva do mesmo jeito", async () => {
    equipShopItem.mockRejectedValue(new Error("fora do ar"));
    const { onSaved, onClose, view } = setup();
    await pickNewCover(view);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
    expect(screen.queryByText(/Não foi possível/)).toBeNull();
  });
});

describe("clearOwnShopCover", () => {
  it("sem nada guardado não faz nada", () => {
    expect(() => clearOwnShopCover("ninguem")).not.toThrow();
  });
});
