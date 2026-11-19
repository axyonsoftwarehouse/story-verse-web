import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { grantDiamonds, grantProblem, parseGrantAmount } from "./adminDiamonds";
import { rpc } from "./rpc";

vi.mock("./rpc", () => ({ rpc: vi.fn() }));

const session = { access_token: "token", user: { id: "admin-1" } } as SupabaseSession;

afterEach(() => vi.mocked(rpc).mockReset());

describe("parseGrantAmount", () => {
  it("aceita positivo, negativo e milhar", () => {
    expect(parseGrantAmount("500")).toBe(500);
    expect(parseGrantAmount(" -100 ")).toBe(-100);
    expect(parseGrantAmount("+20")).toBe(20);
    expect(parseGrantAmount("−50")).toBe(-50);
    expect(parseGrantAmount("1.500")).toBe(1500);
    expect(parseGrantAmount("-10.000")).toBe(-10000);
  });
  it("recusa o que não é inteiro", () => {
    expect(parseGrantAmount("")).toBeNaN();
    expect(parseGrantAmount("1.5")).toBeNaN();
    expect(parseGrantAmount("1,5")).toBeNaN();
    expect(parseGrantAmount("dez")).toBeNaN();
  });
});

describe("grantProblem", () => {
  const ok = { email: "ana@example.com", amount: 500, note: "Beta tester" };
  it("formulário certo passa", () => {
    expect(grantProblem(ok)).toBeNull();
    expect(grantProblem({ ...ok, amount: -100 })).toBeNull();
  });
  it("aponta o primeiro problema", () => {
    expect(grantProblem({ ...ok, email: "ana" })).toMatch(/e-mail/);
    expect(grantProblem({ ...ok, amount: 0 })).toMatch(/diferente de zero/);
    expect(grantProblem({ ...ok, amount: Number.NaN })).toMatch(/diferente de zero/);
    expect(grantProblem({ ...ok, amount: 100_001 })).toMatch(/grande demais/);
    expect(grantProblem({ ...ok, note: "  a " })).toMatch(/motivo/);
    expect(grantProblem({ ...ok, note: "x".repeat(201) })).toMatch(/motivo/);
  });
});

describe("grantDiamonds", () => {
  it("chama admin_grant_diamonds com os campos limpos e devolve o saldo novo", async () => {
    vi.mocked(rpc).mockResolvedValue([{ user_id: "u1", email: "ana@example.com", amount: 500, balance: 520 }]);
    const result = await grantDiamonds(session, { email: " ana@example.com ", amount: 500, note: " Beta tester " });
    expect(rpc).toHaveBeenCalledWith(
      session,
      "admin_grant_diamonds",
      { p_email: "ana@example.com", p_amount: 500, p_note: "Beta tester" },
      { feature: "Conceder diamantes" },
    );
    expect(result.balance).toBe(520);
  });
  it("repassa o erro do banco (ex.: quem não é superadmin)", async () => {
    vi.mocked(rpc).mockRejectedValue(new Error("Só superadmin pode conceder diamantes."));
    await expect(grantDiamonds(session, { email: "a@b.co", amount: 1, note: "abc" })).rejects.toThrow("Só superadmin");
  });
  it("sem linha de volta vira erro", async () => {
    vi.mocked(rpc).mockResolvedValue([]);
    await expect(grantDiamonds(session, { email: "a@b.co", amount: 1, note: "abc" })).rejects.toThrow(/Não foi possível/);
  });
});
