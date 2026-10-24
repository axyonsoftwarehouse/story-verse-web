import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import type { SubscriptionStatus } from "../../lib/billing";
import { fetchBillingPlans } from "../../lib/billing";
import { SubscribePage } from "./SubscribePage";

const authState = vi.hoisted(() => ({
  session: null as SupabaseSession | null,
  status: null as SubscriptionStatus | null,
}));

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: authState.session, loading: false }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ status: authState.status, loading: false, error: "", refresh: vi.fn() }),
}));

vi.mock("../../lib/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/billing")>();
  return { ...actual, fetchBillingPlans: vi.fn() };
});

const session = { access_token: "token" } as SupabaseSession;

const status: SubscriptionStatus = {
  status: "none",
  active: false,
  accessUntil: null,
  plan: "R$ 9,90",
  cancelAtPeriodEnd: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assinar"]}>
      <SubscribePage />
    </MemoryRouter>,
  );
}

describe("SubscribePage", () => {
  beforeEach(() => {
    authState.session = null;
    authState.status = null;
    vi.mocked(fetchBillingPlans).mockResolvedValue({
      plans: [
        {
          id: "storyverse",
          name: "Storyverse",
          priceLabel: "R$ 9,90",
          currency: "BRL",
          interval: "month",
          trialDays: 7,
        },
      ],
    });
  });

  it("pede login antes de assinar", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: "Entrar para começar" })).toHaveAttribute(
      "href",
      "/?login=1&retorno=/assinar",
    );
    expect(screen.getAllByText(/7 dias grátis/).length).toBeGreaterThan(0);
  });

  it("mostra o checkout para quem entrou sem assinatura", async () => {
    authState.session = session;
    authState.status = status;
    renderPage();
    expect(await screen.findByRole("button", { name: "Começar teste grátis" })).toBeInTheDocument();
  });

  it("não oferece checkout para quem já tem acesso", async () => {
    authState.session = session;
    authState.status = { ...status, status: "active", active: true };
    renderPage();
    expect(await screen.findByRole("link", { name: "Continuar lendo" })).toBeInTheDocument();
  });
});
