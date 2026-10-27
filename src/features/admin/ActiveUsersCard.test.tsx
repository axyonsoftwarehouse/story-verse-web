import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { getActiveUsers } from "../../lib/adminActive";
import { ActiveUsersCard } from "./ActiveUsersCard";

vi.mock("../../lib/adminActive", () => ({ getActiveUsers: vi.fn() }));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

describe("ActiveUsersCard", () => {
  beforeEach(() => {
    vi.mocked(getActiveUsers).mockReset();
  });

  it("pede os 30 dias até hoje e mostra DAU, WAU, MAU e a série", async () => {
    vi.mocked(getActiveUsers).mockResolvedValue({
      dau: 13,
      wau: 57,
      mau: 1211,
      series: [
        { day: "2026-10-26", active: 9 },
        { day: "2026-10-27", active: 13 },
      ],
    });
    render(<ActiveUsersCard session={session} today="2026-10-27" />);

    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(screen.getByText("57")).toBeInTheDocument();
    expect(screen.getByText("1.211")).toBeInTheDocument();
    expect(screen.getByText("últimos 30 dias (MAU)")).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "Pessoas ativas por dia: atual: 13 pessoas" }),
    ).toBeInTheDocument();
    expect(getActiveUsers).toHaveBeenCalledWith(session, { from: "2026-09-28", to: "2026-10-27" });
  });

  it("avisa quando a API não responde, sem inventar número", async () => {
    vi.mocked(getActiveUsers).mockRejectedValue(new Error("falhou"));
    render(<ActiveUsersCard session={session} today="2026-10-27" />);

    expect(await screen.findByText(/Usuários ativos indisponíveis/)).toBeInTheDocument();
    expect(screen.queryByText("hoje (DAU)")).toBeNull();
  });
});
