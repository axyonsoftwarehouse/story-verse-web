import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { getVitals } from "../../lib/adminVitals";
import { WebVitals } from "./WebVitals";

vi.mock("../../lib/adminVitals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/adminVitals")>()),
  getVitals: vi.fn(),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;
const range = { from: "2026-10-21", to: "2026-10-27" };

describe("WebVitals", () => {
  beforeEach(() => vi.mocked(getVitals).mockReset());

  it("mostra o p75 de cada métrica com a faixa do Google", async () => {
    vi.mocked(getVitals).mockResolvedValue({
      ...range,
      vitals: { lcp: 2712.3, inp: 184, cls: 0.31, samples: 148 },
      error: null,
    });
    render(<WebVitals session={session} range={range} />);

    expect(await screen.findByText("2,7 s")).toBeInTheDocument();
    expect(screen.getByText("184 ms")).toBeInTheDocument();
    expect(screen.getByText("0,31")).toBeInTheDocument();
    expect(screen.getByText("melhorar")).toHaveClass("is-needs-improvement");
    expect(screen.getByText("bom")).toHaveClass("is-good");
    expect(screen.getByText("ruim")).toHaveClass("is-poor");
    expect(screen.getByText(/148 medidas/)).toBeInTheDocument();
    expect(getVitals).toHaveBeenCalledWith(session, range);
  });

  it("não inventa número para métrica sem medida nem para período vazio", async () => {
    vi.mocked(getVitals).mockResolvedValue({
      ...range,
      vitals: { lcp: 900, inp: null, cls: 0, samples: 1 },
      error: null,
    });
    const { unmount } = render(<WebVitals session={session} range={range} />);
    expect(await screen.findByText("900 ms")).toBeInTheDocument();
    expect(screen.getByText("sem medida")).toBeInTheDocument();
    expect(screen.getByText(/1 medida$/)).toBeInTheDocument();
    unmount();

    vi.mocked(getVitals).mockResolvedValue({
      ...range,
      vitals: { lcp: null, inp: null, cls: null, samples: 0 },
      error: null,
    });
    render(<WebVitals session={session} range={range} />);
    expect(await screen.findByText(/nenhuma medida no período/)).toBeInTheDocument();
  });

  it("mostra o motivo quando o Umami não responde", async () => {
    vi.mocked(getVitals).mockResolvedValue({
      ...range,
      vitals: null,
      error: "Umami não configurado.",
    });
    render(<WebVitals session={session} range={range} />);
    expect(await screen.findByText(/Umami não configurado\./)).toBeInTheDocument();
  });
});
