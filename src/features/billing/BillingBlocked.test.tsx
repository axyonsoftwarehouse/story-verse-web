import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SubscriptionSnapshot } from "../../lib/billing";
import { BillingBlocked } from "./BillingBlocked";

const none: SubscriptionSnapshot = {
  status: "none",
  active: false,
  accessUntil: null,
  plan: "Storyverse",
  cancelAtPeriodEnd: false,
};

function renderBlocked(status: SubscriptionSnapshot, onLogout = vi.fn()) {
  render(
    <MemoryRouter>
      <BillingBlocked status={status} onLogout={onLogout} />
    </MemoryRouter>,
  );
  return onLogout;
}

describe("BillingBlocked", () => {
  it("mostra a marca no topo e leva para assinar", () => {
    renderBlocked(none);
    expect(screen.getByRole("banner")).toHaveTextContent("Storyverse");
    expect(screen.getByRole("heading", { name: "Sua assinatura não está ativa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assinar o Storyverse" })).toHaveAttribute("href", "/assinar");
  });

  it("pede confirmação antes de sair, como no resto do app", async () => {
    const onLogout = renderBlocked(none);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(onLogout).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", { name: "Sair da conta?" });
    fireEvent.click(dialog.querySelector(".btn-primary") as HTMLElement);
    await vi.waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("com pagamento pendente manda atualizar o cartão em vez de assinar de novo", () => {
    renderBlocked({ ...none, status: "past_due" });
    expect(screen.getByRole("link", { name: "Atualizar cartão" })).toHaveAttribute("href", "/conta/assinatura");
    expect(screen.queryByRole("link", { name: "Assinar o Storyverse" })).toBeNull();
  });
});
