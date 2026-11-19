import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { grantDiamonds } from "../../lib/adminDiamonds";
import { DiamondGrantSection } from "./DiamondGrantSection";

vi.mock("../../lib/adminDiamonds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminDiamonds")>();
  return { ...actual, grantDiamonds: vi.fn() };
});

const session = { access_token: "token", user: { id: "admin-1" } } as SupabaseSession;

afterEach(() => vi.mocked(grantDiamonds).mockReset());

function fill(email: string, amount: string, note: string) {
  render(<DiamondGrantSection session={session} />);
  fireEvent.change(screen.getByLabelText("E-mail da conta"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: note } });
  fireEvent.click(screen.getByRole("button", { name: "Lançar" }));
}

describe("DiamondGrantSection", () => {
  it("confirma com e-mail e quantidade, credita e mostra o saldo novo", async () => {
    vi.mocked(grantDiamonds).mockResolvedValue({ user_id: "u1", email: "ana@example.com", amount: 500, balance: 1520 });
    fill("ana@example.com", "500", "Beta tester");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Creditar 500 diamantes?")).toBeTruthy();
    expect(within(dialog).getByText(/ana@example\.com/)).toBeTruthy();
    expect(grantDiamonds).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Creditar" }));

    await waitFor(() =>
      expect(grantDiamonds).toHaveBeenCalledWith(session, { email: "ana@example.com", amount: 500, note: "Beta tester" }),
    );
    expect((await screen.findByRole("status")).textContent).toMatch(/500 diamantes creditados.*Saldo novo: 1\.520/);
  });

  it("debito pede confirmação de débito", async () => {
    vi.mocked(grantDiamonds).mockResolvedValue({ user_id: "u1", email: "ana@example.com", amount: -100, balance: 20 });
    fill("ana@example.com", "-100", "Correção");
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Debitar 100 diamantes?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Debitar" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/100 diamantes debitados.*Saldo novo: 20/);
  });

  it("cancelar a confirmação não envia", async () => {
    fill("ana@example.com", "500", "Beta tester");
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(grantDiamonds).not.toHaveBeenCalled();
  });

  it("formulário inválido não abre confirmação", () => {
    fill("ana@example.com", "0", "Beta tester");
    expect(screen.getByRole("alert").textContent).toMatch(/diferente de zero/);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("mostra o erro do servidor (ex.: quem não é superadmin)", async () => {
    vi.mocked(grantDiamonds).mockRejectedValue(new Error("Só superadmin pode conceder diamantes."));
    fill("ana@example.com", "500", "Beta tester");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Creditar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Só superadmin/);
  });
});
