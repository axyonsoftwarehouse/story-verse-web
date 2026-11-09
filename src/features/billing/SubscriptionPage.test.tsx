import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import type { SubscriptionStatus } from "../../lib/billing";
import { SubscriptionPage } from "./SubscriptionPage";

const authState = vi.hoisted(() => ({
  session: null as SupabaseSession | null,
  status: null as SubscriptionStatus | null,
}));

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: authState.session, loading: false }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({
    status: authState.status,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

const session = { access_token: "token" } as SupabaseSession;

const active: SubscriptionStatus = {
  status: "active",
  active: true,
  accessUntil: "2026-11-24T00:00:00Z",
  plan: "Storyverse",
  cancelAtPeriodEnd: false,
  portalAvailable: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/conta/assinatura"]}>
      <SubscriptionPage />
    </MemoryRouter>,
  );
}

describe("SubscriptionPage", () => {
  beforeEach(() => {
    authState.session = session;
    authState.status = active;
  });

  it("mostra a assinatura ativa e o portal", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Assinatura ativa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar assinatura" })).toBeInTheDocument();
    expect(screen.getByText("Acesso liberado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Atualizar status" })).toBeNull();
  });

  it("mostra o teste grátis e a data", async () => {
    authState.status = {
      ...active,
      status: "trialing",
      trialEnd: "2026-10-31T00:00:00Z",
    };
    renderPage();
    expect(await screen.findByRole("heading", { name: "Em teste grátis" })).toBeInTheDocument();
    expect(screen.getByText(/Teste grátis até/)).toBeInTheDocument();
  });

  it("oferece assinar quando não há acesso", async () => {
    authState.status = { ...active, status: "none", active: false, accessUntil: null };
    renderPage();
    expect(await screen.findByRole("link", { name: "Assinar agora" })).toHaveAttribute(
      "href",
      "/assinar",
    );
    expect(screen.queryByRole("link", { name: "Ir para o início" })).toBeNull();
  });

  it("pagamento pendente ainda com acesso avisa que o acesso continua", async () => {
    authState.status = { ...active, status: "past_due", active: true };
    renderPage();
    expect(await screen.findByText(/O acesso continua por alguns dias/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar assinatura" })).toBeInTheDocument();
  });

  it("pagamento pendente sem acesso manda atualizar o cartão, não assinar de novo", async () => {
    authState.status = {
      ...active,
      status: "past_due",
      active: false,
      accessUntil: "2026-11-02T00:00:00Z",
    };
    renderPage();
    expect(await screen.findByText(/acesso está suspenso/)).toBeInTheDocument();
    expect(screen.queryByText(/O acesso continua/)).toBeNull();
    expect(screen.getByText("Acesso terminou em")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar cartão" })).toHaveClass("btn-primary");
    expect(screen.queryByRole("link", { name: "Assinar agora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir portal" })).toBeNull();
  });

  it("pagamento pendente sem portal ainda oferece assinar", async () => {
    authState.status = { ...active, status: "past_due", active: false, portalAvailable: false };
    renderPage();
    expect(await screen.findByRole("link", { name: "Assinar agora" })).toBeInTheDocument();
  });

  it("mostra o período pago com Pix e oferece somar mais dias", async () => {
    authState.status = {
      ...active,
      status: "none",
      reason: "pix",
      accessUntil: "2026-11-27T12:00:00Z",
      pixAvailable: true,
      pixDays: 30,
    };
    renderPage();
    expect(await screen.findByRole("heading", { name: "Pago com Pix" })).toBeInTheDocument();
    expect(screen.getByText("Pix — 30 dias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar mais 30 dias com Pix" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar assinatura" })).toBeNull();
    expect(screen.queryByText("Cancelamento")).toBeNull();
  });

  it("no teste grátis oferece pagar com Pix", async () => {
    authState.status = { ...active, status: "trialing", trialEnd: "2026-11-04T00:00:00Z", pixAvailable: true };
    renderPage();
    expect(await screen.findByRole("button", { name: "Pagar 30 dias com Pix" })).toBeInTheDocument();
  });
});
