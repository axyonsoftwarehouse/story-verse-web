import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { getOverview } from "./adminOverview";

vi.mock("./backend", () => ({ apiRequest: vi.fn() }));

const { apiRequest } = await import("./backend");
const mocked = vi.mocked(apiRequest);

const sessao = { access_token: "token", user: { id: "user-1" } } as unknown as SupabaseSession;
const outraSessao = { access_token: "token-2", user: { id: "user-1" } } as unknown as SupabaseSession;
const resumo = {
  moderation: { pendingSubmissions: 1, openReports: 0 },
  accounts: { total: 2, newLast7Days: 1 },
  features: {},
  backup: { status: "success", finishedAt: "2026-11-06T00:00:00Z", sizeBytes: 10, stale: false },
};

describe("getOverview", () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockResolvedValue(resumo);
  });

  it("compartilha uma chamada quando o menu e o painel pedem juntos", async () => {
    // É o que acontecia no /admin: AdminRoute e OverviewSection pediam a mesma visão geral.
    const [primeira, segunda] = await Promise.all([getOverview(sessao), getOverview(outraSessao)]);
    expect(primeira).toEqual(resumo);
    expect(segunda).toEqual(resumo);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("não guarda o resultado: a próxima carga pede de novo", async () => {
    await getOverview(sessao);
    await getOverview(sessao);
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it("não compartilha entre usuários diferentes", async () => {
    const outroUsuario = { access_token: "token-3", user: { id: "user-2" } } as unknown as SupabaseSession;
    await Promise.all([getOverview(sessao), getOverview(outroUsuario)]);
    expect(mocked).toHaveBeenCalledTimes(2);
  });
});
