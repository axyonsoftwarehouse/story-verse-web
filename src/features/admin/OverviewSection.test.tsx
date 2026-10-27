import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { getBillingSummary, type BillingSummary } from "../../lib/adminBilling";
import {
  getMetricsOverview,
  getMetricsRetention,
  getReadingSeries,
  type MetricsOverview,
} from "../../lib/adminMetrics";
import { getOverview, type AdminOverview } from "../../lib/adminOverview";
import { fetchRanking } from "../../lib/ranking";
import { OverviewSection } from "./OverviewSection";
import { isoDate } from "./dashboardMath";

vi.mock("../../lib/adminOverview", () => ({ getOverview: vi.fn() }));
vi.mock("../../lib/adminMetrics", () => ({
  getMetricsOverview: vi.fn(),
  getReadingSeries: vi.fn(),
  getMetricsRetention: vi.fn(),
}));
vi.mock("../../lib/adminBilling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminBilling")>()),
  getBillingSummary: vi.fn(),
}));
vi.mock("../../lib/ranking", () => ({ fetchRanking: vi.fn() }));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const overview: AdminOverview = {
  moderation: { pendingSubmissions: 2, openReports: 0 },
  accounts: { total: 42, newLast7Days: 5 },
  features: { library: 11 },
  backup: { status: "success", finishedAt: "2026-10-26T06:00:00Z", sizeBytes: 2048, stale: false },
};

function metrics(reading: Partial<MetricsOverview["reading"]>): MetricsOverview {
  return {
    accounts: { total: 42, new7: 5, new30: 12, confirmed: 30, staff: 3 },
    reading: {
      activeReaders: 0,
      minutes: 0,
      booksStarted: 0,
      booksFinished: 0,
      shelfEntries: 0,
      ...reading,
    },
    features: {},
    retention: [],
  };
}

const billing: BillingSummary = {
  active: 9,
  trialing: 2,
  past_due: 1,
  canceled: 3,
  new_count: 4,
  canceled_count: 1,
  failed: 1,
  mrr_cents: 12990,
  from: "2026-09-26",
  to: "2026-10-26",
};

function renderSection(roles: string[]) {
  return render(
    <MemoryRouter>
      <OverviewSection session={session} roles={roles} />
    </MemoryRouter>,
  );
}

describe("OverviewSection", () => {
  beforeEach(() => {
    vi.mocked(getOverview).mockResolvedValue(overview);
    // O período atual termina hoje; o anterior termina antes. Números diferentes para ver a seta.
    const today = isoDate(new Date());
    vi.mocked(getMetricsOverview).mockImplementation(async (_session, range) =>
      range.to === today
        ? metrics({ activeReaders: 20, minutes: 600, booksStarted: 8, booksFinished: 4 })
        : metrics({ activeReaders: 10, minutes: 300, booksStarted: 4, booksFinished: 4 }),
    );
    vi.mocked(getReadingSeries).mockResolvedValue([]);
    vi.mocked(getMetricsRetention).mockResolvedValue([]);
    vi.mocked(getBillingSummary).mockResolvedValue(billing);
    vi.mocked(fetchRanking).mockResolvedValue([
      {
        place: 1,
        user_id: "u1",
        name: "Ana",
        avatar: null,
        photo: null,
        minutes: 320,
        is_me: false,
      },
      {
        place: 2,
        user_id: "u2",
        name: "Bia",
        avatar: null,
        photo: null,
        minutes: 150,
        is_me: false,
      },
    ]);
  });

  it("mostra ações, números do período com variação, ranking e assinaturas", async () => {
    renderSection(["superadmin"]);

    expect(await screen.findByText("Precisa de ação")).toBeInTheDocument();
    expect(screen.getByText("envios esperando revisão")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "revisar" })).toHaveAttribute(
      "href",
      "/admin/acervo/envios",
    );
    // Denúncias zeradas não ganham atalho.
    expect(screen.queryByRole("link", { name: "ver fórum" })).toBeNull();

    expect(await screen.findByText("20")).toBeInTheDocument();
    expect(screen.getAllByText("↑ 100%").length).toBeGreaterThan(0);
    expect(screen.getByText("50%")).toBeInTheDocument(); // 4 terminados ÷ 8 iniciados
    expect(screen.getByText("30")).toBeInTheDocument(); // 600 min ÷ 20 leitores

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("320 min")).toBeInTheDocument();
    expect(await screen.findByText("R$ 129,90")).toBeInTheDocument();
    expect(screen.getByText("assinaturas com pagamento pendente")).toBeInTheDocument();
    expect(screen.getByText("Ainda sem dados na API")).toBeInTheDocument();
  });

  it("em Hoje compara com ontem e marca novos usuários como pendentes de endpoint", async () => {
    renderSection(["superadmin"]);
    await screen.findByText("20");

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() =>
      expect(getMetricsOverview).toHaveBeenCalledWith(
        session,
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      ),
    );
    expect(await screen.findAllByText(/ontem:/)).not.toHaveLength(0);
    expect(screen.getAllByText("aguardando endpoint").length).toBeGreaterThan(0);
  });

  it("moderador vê só as ações, sem métricas de negócio", async () => {
    renderSection(["moderator"]);

    expect(await screen.findByText("Precisa de ação")).toBeInTheDocument();
    expect(getMetricsOverview).not.toHaveBeenCalled();
    expect(getBillingSummary).not.toHaveBeenCalled();
    expect(fetchRanking).not.toHaveBeenCalled();
    expect(screen.queryByText("Ranking da semana")).toBeNull();
  });

  it("mostra o erro da visão geral", async () => {
    vi.mocked(getOverview).mockRejectedValueOnce(new Error("Falha na visão geral."));
    renderSection(["moderator"]);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Falha na visão geral."),
    );
  });
});
