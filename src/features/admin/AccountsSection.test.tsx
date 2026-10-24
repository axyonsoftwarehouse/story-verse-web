import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { listUsers, recentUsers, type AdminUserSummary } from "../../lib/adminUsers";
import { AccountsSection } from "./AccountsSection";

vi.mock("../../lib/adminUsers", () => ({
  recentUsers: vi.fn(),
  listUsers: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

function user(overrides: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    id: "u1",
    name: "Leitor de QA",
    emailMasked: "qa***@example.com",
    emailConfirmed: true,
    createdAt: "2026-10-01T12:00:00Z",
    lastSignInAt: "2026-10-02T12:00:00Z",
    roles: [],
    ...overrides,
  };
}

function renderSection() {
  return render(
    <MemoryRouter>
      <AccountsSection session={session} />
    </MemoryRouter>,
  );
}

describe("AccountsSection", () => {
  beforeEach(() => {
    vi.mocked(recentUsers).mockResolvedValue([user()]);
    vi.mocked(listUsers).mockResolvedValue({ items: [], nextCursor: null });
  });

  it("mostra as contas recentes", async () => {
    renderSection();
    expect(await screen.findByText("Leitor de QA")).toBeInTheDocument();
    expect(screen.getByText("Contas recentes")).toBeInTheDocument();
    expect(screen.getByText("qa***@example.com")).toBeInTheDocument();
  });

  it("filtra por busca, papel e feature e carrega mais", async () => {
    vi.mocked(listUsers)
      .mockResolvedValueOnce({ items: [user({ id: "u2", name: "Suporte de QA", roles: ["support"] })], nextCursor: "abc" })
      .mockResolvedValueOnce({ items: [user({ id: "u3", name: "Outra conta" })], nextCursor: null });

    renderSection();
    await screen.findByText("Leitor de QA");

    fireEvent.change(screen.getByLabelText("Buscar conta"), { target: { value: "qa" } });
    fireEvent.change(screen.getByLabelText("Papel"), { target: { value: "support" } });
    fireEvent.change(screen.getByLabelText("Feature"), { target: { value: "library" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(await screen.findByText("Suporte de QA")).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ q: "qa", role: "support", feature: "library", limit: 20 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Outra conta")).toBeInTheDocument();
    expect(listUsers).toHaveBeenLastCalledWith(
      session,
      expect.objectContaining({ q: "qa", role: "support", feature: "library", cursor: "abc" }),
    );
  });

  it("mostra vazio e erro", async () => {
    renderSection();
    await screen.findByText("Leitor de QA");

    fireEvent.change(screen.getByLabelText("Buscar conta"), { target: { value: "nao-existe" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(await screen.findByText("Nenhuma conta encontrada.")).toBeInTheDocument();

    vi.mocked(listUsers).mockRejectedValueOnce(new Error("Falha na busca."));
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Falha na busca."));
  });
});
