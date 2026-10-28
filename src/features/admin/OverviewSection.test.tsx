import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { getBillingSeries, getBillingSummary, type BillingSummary } from "../../lib/adminBilling";
import { getCommunitySeries } from "../../lib/adminCommunity";
import { getHealth, type AdminHealth } from "../../lib/adminHealth";
import {
  getMetricsOverview,
  getMetricsRetention,
  getReadingSeries,
  type MetricsOverview,
} from "../../lib/adminMetrics";
import { getOverview, type AdminOverview } from "../../lib/adminOverview";
import { fetchRanking } from "../../lib/ranking";
import { OverviewSection } from "./OverviewSection";
import { isoDate, shiftDays } from "./dashboardMath";

vi.mock("../../lib/adminOverview", () => ({ getOverview: vi.fn() }));
vi.mock("../../lib/adminMetrics", () => ({
  getMetricsOverview: vi.fn(),
  getReadingSeries: vi.fn(),
  getMetricsRetention: vi.fn(),
}));
vi.mock("../../lib/adminBilling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminBilling")>()),
  getBillingSummary: vi.fn(),
  getBillingSeries: vi.fn(),
}));
vi.mock("../../lib/adminHealth", () => ({ getHealth: vi.fn() }));
vi.mock("../../lib/ranking", () => ({ fetchRanking: vi.fn() }));
vi.mock("../../lib/adminCommunity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminCommunity")>()),
  getCommunitySeries: vi.fn(),
}));
const forum = vi.hoisted(() => ({ visible: false }));
vi.mock("../../lib/features", () => ({
  get FORUM_VISIBLE() {
    return forum.visible;
  },
}));

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
  trials_started: 6,
  trials_ended: 4,
  trials_converted: 1,
  from: "2026-09-26",
  to: "2026-10-26",
};

const health: AdminHealth = {
  period: "7d",
  sentry: {
    projects: [
      {
        slug: "storyverse-web",
        errorsSeries: [{ day: "2026-10-25", accepted: 7, filtered: null }],
        errorsTotal: 7,
        crashFreeSessions: 0.993,
        sessionsSeries: [{ day: "2026-10-25", sessions: 120 }],
        topIssues: [
          {
            id: "1",
            title: "TypeError: x is undefined",
            count: 5,
            users: 2,
            lastSeen: "2026-10-26T10:00:00Z",
            permalink: "https://sentry.io/issues/1/",
          },
        ],
      },
    ],
  },
  error: null,
  backup: overview.backup,
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
    forum.visible = false;
    vi.mocked(getOverview).mockResolvedValue(overview);
    // O período atual termina hoje; o anterior termina antes. Números diferentes para ver a seta.
    const today = isoDate(new Date());
    vi.mocked(getMetricsOverview).mockImplementation(async (_session, range) =>
      range.to === today
        ? metrics({
            activeReaders: 20,
            minutes: 600,
            booksStarted: 8,
            booksFinished: 4,
            pages: 120,
          })
        : metrics({
            activeReaders: 10,
            minutes: 300,
            booksStarted: 4,
            booksFinished: 4,
            pages: 60,
          }),
    );
    vi.mocked(getReadingSeries).mockResolvedValue([]);
    vi.mocked(getMetricsRetention).mockResolvedValue([]);
    vi.mocked(getBillingSummary).mockResolvedValue(billing);
    vi.mocked(getBillingSeries).mockResolvedValue([
      {
        bucket: shiftDays(today, -1),
        mrrCents: 12000,
        active: 8,
        newCount: 0,
        canceledCount: 0,
        revenueCents: 0,
        estimated: true,
      },
      {
        bucket: today,
        mrrCents: 12990,
        active: 9,
        newCount: 1,
        canceledCount: 0,
        revenueCents: 990,
        estimated: false,
      },
    ]);
    vi.mocked(getHealth).mockResolvedValue(health);
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
    expect(screen.getAllByText("+100%").length).toBeGreaterThan(0);
    expect(screen.getByText("50%")).toBeInTheDocument(); // 4 terminados ÷ 8 iniciados
    expect(screen.getByText("30")).toBeInTheDocument(); // 600 min ÷ 20 leitores
    const pages = screen.getByText("Páginas lidas").closest("article") as HTMLElement;
    expect(within(pages).getByText("120")).toBeInTheDocument();
    expect(within(pages).getByText("+100%")).toBeInTheDocument();

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("320 min")).toBeInTheDocument();
    expect(await screen.findByText("R$ 129,90")).toBeInTheDocument();
    expect(screen.getByText("assinaturas com pagamento pendente")).toBeInTheDocument();
    // Todos os blocos da spec têm dado na API: o card de pendências saiu.
    expect(screen.queryByText("Ainda sem dados na API")).not.toBeInTheDocument();
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

  it("compara cadastros com o período anterior e mostra conversão, MRR e Sentry", async () => {
    const today = isoDate(new Date());
    const point = (bucket: string, signups: number) => ({
      bucket,
      activeReaders: 0,
      minutes: 0,
      booksStarted: 0,
      booksFinished: 0,
      signups,
    });
    // 9 cadastros nos últimos 7 dias contra 3 nos 7 anteriores.
    vi.mocked(getReadingSeries).mockResolvedValue([
      point(today, 4),
      point(shiftDays(today, -3), 5),
      point(shiftDays(today, -10), 3),
    ]);
    renderSection(["superadmin"]);

    expect(await screen.findByText("+200%")).toBeInTheDocument();
    expect(await screen.findByText("25%")).toBeInTheDocument(); // 1 convertido ÷ 4 encerrados
    expect(screen.getByText(/barras tracejadas são estimadas/)).toBeInTheDocument();
    // O detalhe do Sentry foi para a aba Site; aqui fica o total e o atalho.
    expect(await screen.findByText(/erros no Sentry · 7 dias/)).toBeInTheDocument();
    expect(screen.queryByText(/99,3% das sessões sem crash/)).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir Site" })).toHaveAttribute(
      "href",
      "/admin/site",
    );
    // O que a API já entrega sai da lista de lacunas.
    expect(screen.queryByText("Erros e sessões (Sentry)")).toBeNull();
    expect(screen.getByText("Livros mais lidos")).toBeInTheDocument();
  });

  it("mostra o motivo quando o Sentry não responde e não alarma sem backup registrado", async () => {
    vi.mocked(getOverview).mockResolvedValue({
      ...overview,
      backup: { status: null, finishedAt: null, sizeBytes: null, stale: true },
    });
    vi.mocked(getHealth).mockResolvedValue({
      ...health,
      sentry: null,
      error: "Sentry não configurado.",
    });
    renderSection(["superadmin"]);

    expect(await screen.findByText(/Sentry não configurado\./)).toBeInTheDocument();
    expect(screen.getByText("backup · sem backup registrado")).toBeInTheDocument();
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("mostra a atividade do fórum só com o fórum ligado", async () => {
    const today = isoDate(new Date());
    const point = (bucket: string, topics: number, replies: number, reports: number) => ({
      bucket,
      topics,
      replies,
      reports,
    });
    // 7 dias: 3 tópicos contra 1 nos 7 anteriores; respostas sem base anterior.
    vi.mocked(getCommunitySeries).mockResolvedValue([
      point(shiftDays(today, -10), 1, 0, 0),
      point(shiftDays(today, -2), 1, 6, 0),
      point(today, 2, 5, 1),
    ]);
    const { unmount } = renderSection(["superadmin"]);
    await screen.findByText("Ranking da semana");
    expect(screen.queryByText("Comunidade")).toBeNull();
    expect(getCommunitySeries).not.toHaveBeenCalled();
    unmount();

    forum.visible = true;
    renderSection(["superadmin"]);
    expect(await screen.findByText("Comunidade")).toBeInTheDocument();
    expect(await screen.findByText("11")).toBeInTheDocument(); // 6 + 5 respostas
    expect(screen.getByText("+200%")).toBeInTheDocument(); // tópicos: 3 contra 1
    expect(getCommunitySeries).toHaveBeenCalledWith(
      session,
      { from: shiftDays(today, -59), to: today },
      "day",
    );
    fireEvent.click(screen.getByRole("button", { name: "Denúncias" }));
    expect(screen.getByLabelText("Denúncias: 1 no total")).toBeInTheDocument();
  });

  it("moderador vê só as ações, sem métricas de negócio", async () => {
    renderSection(["moderator"]);

    expect(await screen.findByText("Precisa de ação")).toBeInTheDocument();
    expect(getMetricsOverview).not.toHaveBeenCalled();
    expect(getBillingSummary).not.toHaveBeenCalled();
    expect(fetchRanking).not.toHaveBeenCalled();
    expect(getHealth).not.toHaveBeenCalled();
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
