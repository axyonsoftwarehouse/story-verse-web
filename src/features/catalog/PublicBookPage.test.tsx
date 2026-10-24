import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountCapabilities } from "../../lib/accountFeatures";
import type { SupabaseSession } from "../../lib/auth";
import { ApiHttpError } from "../../lib/backend";
import { getCatalogBook, type CatalogBook } from "../../lib/catalog";
import { fetchShelfEntry, putShelfEntry, type ShelfEntry } from "../../lib/library";
import { PublicBookPage } from "./PublicBookPage";

vi.mock("../../lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/catalog")>();
  return { ...actual, getCatalogBook: vi.fn() };
});

vi.mock("../../lib/library", () => ({
  fetchShelfEntry: vi.fn(),
  putShelfEntry: vi.fn(),
}));

const authState = vi.hoisted(() => ({ session: null as SupabaseSession | null }));
const accountState = vi.hoisted(() => ({
  capabilities: null as AccountCapabilities | null,
}));

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: authState.session, loading: false }),
}));

vi.mock("../auth/useAccountFeatures", () => ({
  useAccountFeatures: () => ({ capabilities: accountState.capabilities, loading: false }),
}));

const session = {
  access_token: "token",
  user: { id: "user-1", email: "leitor@example.test" },
} as unknown as SupabaseSession;

const book: CatalogBook = {
  book_key: "cat:11111111-1111-1111-1111-111111111111",
  title: "Dom Casmurro",
  author: "Machado de Assis",
  genre: "Clássico",
  language: "pt",
  series: null,
  series_index: null,
  description: "Um clássico da literatura brasileira.",
  page_count: 256,
  cover_url: null,
  featured: true,
  published_at: "2026-10-20T00:00:00Z",
  rights: "public_domain",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/biblioteca/${encodeURIComponent(book.book_key)}`]}>
      <Routes>
        <Route path="/biblioteca/:bookKey" element={<PublicBookPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicBookPage", () => {
  beforeEach(() => {
    authState.session = null;
    accountState.capabilities = null;
    vi.mocked(getCatalogBook).mockResolvedValue(book);
    vi.mocked(fetchShelfEntry).mockRejectedValue(new ApiHttpError("Não está na estante.", 404, undefined, {}));
    vi.mocked(putShelfEntry).mockResolvedValue({ bookKey: book.book_key } as ShelfEntry);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mostra a ficha, os direitos e manda entrar antes de ler", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Dom Casmurro" })).toBeInTheDocument();
    expect(screen.getByText(/Um clássico da literatura/)).toBeInTheDocument();
    expect(screen.getByText(/Domínio público/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Ler agora" })).toHaveAttribute(
      "href",
      "/?abrir=cat%3A11111111-1111-1111-1111-111111111111&login=1",
    );
    expect(screen.getByRole("link", { name: "Entrar para guardar na estante" })).toHaveAttribute(
      "href",
      "/?abrir=cat%3A11111111-1111-1111-1111-111111111111&login=1",
    );
  });

  it("adiciona à estante quando a conta tem a feature", async () => {
    authState.session = session;
    accountState.capabilities = { roles: [], features: ["library"] };
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Adicionar à estante" }));
    await waitFor(() =>
      expect(putShelfEntry).toHaveBeenCalledWith(
        session,
        book.book_key,
        expect.objectContaining({
          source: "catalog",
          status: "want_to_read",
          title: "Dom Casmurro",
        }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Na sua estante" })).toBeDisabled();
  });

  it("mostra o livro como já estando na estante", async () => {
    authState.session = session;
    accountState.capabilities = { roles: [], features: ["library"] };
    vi.mocked(fetchShelfEntry).mockResolvedValue({ bookKey: book.book_key } as ShelfEntry);
    renderPage();
    expect(await screen.findByRole("button", { name: "Na sua estante" })).toBeInTheDocument();
  });
});
