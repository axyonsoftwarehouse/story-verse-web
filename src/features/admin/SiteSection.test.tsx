import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { getHealth, type AdminHealth } from "../../lib/adminHealth";
import { getTraffic, type AdminTraffic } from "../../lib/adminTraffic";
import { getVitals } from "../../lib/adminVitals";
import { SiteSection } from "./SiteSection";

vi.mock("../../lib/adminHealth", () => ({ getHealth: vi.fn() }));
vi.mock("../../lib/adminTraffic", () => ({ getTraffic: vi.fn() }));
vi.mock("../../lib/adminVitals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminVitals")>()),
  getVitals: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

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
  backup: null,
} as AdminHealth;

const traffic = {
  traffic: {
    visitors: 340,
    pageviews: 1200,
    visits: 400,
    bounceRate: 0.4,
    avgVisitSeconds: 95,
    activeNow: 3,
    previous: { visitors: 170, pageviews: 600 },
    topPages: [{ value: "/biblioteca", count: 300 }],
    referrers: [{ value: "", count: 120 }],
    series: [],
  },
  error: null,
} as unknown as AdminTraffic;

function renderSection() {
  return render(
    <MemoryRouter>
      <SiteSection session={session} />
    </MemoryRouter>,
  );
}

describe("SiteSection", () => {
  beforeEach(() => {
    vi.mocked(getHealth).mockReset().mockResolvedValue(health);
    vi.mocked(getTraffic).mockReset().mockResolvedValue(traffic);
    vi.mocked(getVitals).mockReset().mockRejectedValue(new Error("sem vitals"));
  });

  it("mostra o detalhe do Sentry e o tráfego do Umami", async () => {
    renderSection();
    expect(await screen.findByText(/99,3% das sessões sem crash/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TypeError: x is undefined" })).toHaveAttribute(
      "href",
      "https://sentry.io/issues/1/",
    );
    expect(await screen.findByText("340")).toBeInTheDocument();
    expect(screen.getByText("/biblioteca")).toBeInTheDocument();
    expect(screen.getByText("acesso direto")).toBeInTheDocument();
  });

  it("troca o período e consulta a janela do Sentry correspondente", async () => {
    renderSection();
    await screen.findByText("340");
    expect(getHealth).toHaveBeenCalledWith(session, "7d");
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    await waitFor(() => expect(getHealth).toHaveBeenCalledWith(session, "14d"));
    expect(getTraffic).toHaveBeenCalledTimes(2);
  });

  it("explica quando o Sentry e o Umami não respondem", async () => {
    vi.mocked(getHealth).mockResolvedValue({ ...health, sentry: null, error: "Sentry não configurado." });
    vi.mocked(getTraffic).mockRejectedValue(new Error("fora"));
    renderSection();
    expect(await screen.findByText(/Sentry não configurado\./)).toBeInTheDocument();
    expect(await screen.findByText(/Tráfego indisponível/)).toBeInTheDocument();
  });
});
