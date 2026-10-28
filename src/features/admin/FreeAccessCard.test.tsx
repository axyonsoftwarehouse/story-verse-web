import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  createBillingGrant,
  grantExpiresAt,
  listBillingGrants,
  revokeBillingGrant,
  type BillingGrant,
} from "../../lib/adminBilling";
import { FreeAccessCard } from "./FreeAccessCard";

vi.mock("../../lib/adminBilling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminBilling")>()),
  listBillingGrants: vi.fn(),
  createBillingGrant: vi.fn(),
  revokeBillingGrant: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const ativo: BillingGrant = {
  id: "g1",
  reason: "Família",
  expires_at: null,
  created_at: "2026-10-28T12:00:00Z",
  revoked_at: null,
  created_by_name: "Werner",
  revoked_by_name: null,
  active: true,
};

function renderCard(staff = false) {
  return render(<FreeAccessCard session={session} userId="u1" userName="Tia Ana" staff={staff} />);
}

describe("FreeAccessCard", () => {
  beforeEach(() => {
    vi.mocked(listBillingGrants).mockReset();
    vi.mocked(createBillingGrant).mockReset();
    vi.mocked(revokeBillingGrant).mockReset();
  });

  it("concede com motivo e validade em dias", async () => {
    vi.mocked(listBillingGrants).mockResolvedValueOnce([]).mockResolvedValueOnce([ativo]);
    vi.mocked(createBillingGrant).mockResolvedValue(ativo);
    renderCard();

    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: " Família " } });
    fireEvent.change(screen.getByLabelText("Validade"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar acesso grátis" }));

    await screen.findByText("Acesso grátis concedido.");
    const input = vi.mocked(createBillingGrant).mock.calls[0][1];
    expect(input.userId).toBe("u1");
    expect(input.reason).toBe("Família");
    expect(input.expiresAt).not.toBeNull();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText(/Sem prazo · concedido em .* por Werner/)).toBeTruthy();
  });

  it("retira depois de confirmar e mostra no histórico", async () => {
    vi.mocked(listBillingGrants)
      .mockResolvedValueOnce([ativo])
      .mockResolvedValueOnce([{ ...ativo, active: false, revoked_at: "2026-10-29T12:00:00Z", revoked_by_name: "Werner" }]);
    vi.mocked(revokeBillingGrant).mockResolvedValue();
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "Retirar" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Retirar" }));

    await screen.findByText("Acesso grátis retirado.");
    expect(revokeBillingGrant).toHaveBeenCalledWith(session, "g1");
    expect(screen.getByText("Histórico (1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dar acesso grátis" })).toBeTruthy();
  });

  it("conta da equipe só recebe a explicação", async () => {
    vi.mocked(listBillingGrants).mockResolvedValue([]);
    renderCard(true);
    await screen.findByText(/já usa o app sem assinatura/);
    expect(screen.queryByRole("button", { name: "Dar acesso grátis" })).toBeNull();
  });

  it("mostra o erro da API", async () => {
    vi.mocked(listBillingGrants).mockResolvedValue([]);
    vi.mocked(createBillingGrant).mockRejectedValue(new Error("Esta conta já tem acesso grátis ativo."));
    renderCard();
    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: "Teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar acesso grátis" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("já tem acesso grátis ativo"));
  });

  it("validade vazia é sem prazo", () => {
    expect(grantExpiresAt("")).toBeNull();
    expect(grantExpiresAt("30", 0)).toBe(new Date(30 * 86_400_000).toISOString());
  });
});
