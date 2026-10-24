import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BillingBlocked } from "./BillingBlocked";

describe("BillingBlocked", () => {
  it("leva para assinar e permite sair", () => {
    const onLogout = vi.fn();
    render(
      <MemoryRouter>
        <BillingBlocked
          status={{
            status: "none",
            active: false,
            accessUntil: null,
            plan: "Storyverse",
            cancelAtPeriodEnd: false,
          }}
          onLogout={onLogout}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Sua assinatura não está ativa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assinar o Storyverse" })).toHaveAttribute("href", "/assinar");
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(onLogout).toHaveBeenCalled();
  });
});
