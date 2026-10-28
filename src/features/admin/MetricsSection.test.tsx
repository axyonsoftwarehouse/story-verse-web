import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  getMetricsOverview,
  getReadingSeries,
  type MetricsOverview,
} from "../../lib/adminMetrics";
import { MetricsSection } from "./MetricsSection";

vi.mock("../../lib/adminMetrics", () => ({
  getMetricsOverview: vi.fn(),
  getReadingSeries: vi.fn(),
  getMetricsRetention: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const overview: MetricsOverview = {
  accounts: { total: 42, new7: 5, new30: 12, confirmed: 30, staff: 3 },
  reading: { activeReaders: 18, minutes: 930, booksStarted: 7, booksFinished: 4, shelfEntries: 9 },
  features: { library: 11 },
  retention: [{ cohortWeek: "2026-10-19", cohortSize: 10, d1: 4, d7: 2, d30: 1 }],
};

describe("MetricsSection", () => {
  beforeEach(() => {
    vi.mocked(getMetricsOverview).mockResolvedValue(overview);
    vi.mocked(getReadingSeries).mockResolvedValue([
      { bucket: "2026-10-24", activeReaders: 8, minutes: 210, booksStarted: 2, booksFinished: 1 },
    ]);
  });

  it("mostra os cards, a retenção e a série", async () => {
    render(<MetricsSection session={session} />);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("930")).toBeInTheDocument();
    expect(screen.getByText("19/10/2026")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("24/10/2026")).toBeInTheDocument();
  });

  it("troca o período e o agrupamento", async () => {
    render(<MetricsSection session={session} />);
    await screen.findByText("42");
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "7" } });
    await waitFor(() =>
      expect(getMetricsOverview).toHaveBeenLastCalledWith(
        session,
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      ),
    );
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "week" } });
    await waitFor(() =>
      expect(getReadingSeries).toHaveBeenLastCalledWith(session, expect.any(Object), "week"),
    );
  });

  it("mostra vazio e erro", async () => {
    vi.mocked(getMetricsOverview).mockResolvedValue({ ...overview, retention: [] });
    vi.mocked(getReadingSeries).mockResolvedValue([]);
    render(<MetricsSection session={session} />);
    expect(await screen.findByText("Sem dados de retenção no período.")).toBeInTheDocument();
    expect(screen.getByText("Sem dados de leitura no período.")).toBeInTheDocument();

    vi.mocked(getMetricsOverview).mockRejectedValueOnce(new Error("Falha nas métricas."));
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Falha nas métricas."));
  });
});
