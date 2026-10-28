import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./backend";
import { fetchReaderCount, readersLabel, resetReaderCounts } from "./readers";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiEnabled: true, apiRequest: vi.fn() };
});

const CAT = "cat:0b6f3a2e-1c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("contador de leitores", () => {
  beforeEach(() => {
    resetReaderCounts();
    vi.mocked(apiRequest).mockReset();
  });

  it("junta os livros da tela num pedido só e guarda o resultado", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ "gb:1342": 12, [CAT]: 0 });
    const counts = await Promise.all([fetchReaderCount("gb:1342"), fetchReaderCount(CAT), fetchReaderCount("gb:1342")]);
    expect(counts).toEqual([12, 0, 12]);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      `/api/v1/catalog/readers?keys=${encodeURIComponent(`gb:1342,${CAT}`)}`,
    );

    expect(await fetchReaderCount("gb:1342")).toBe(12);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("não pergunta por livros importados nem sem chave", async () => {
    expect(await fetchReaderCount("local:-3")).toBe(0);
    expect(await fetchReaderCount(null)).toBe(0);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("sem a rota no servidor, o card só fica sem o número", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("404"));
    expect(await fetchReaderCount("gb:7")).toBe(0);
  });

  it("escreve o total por extenso e abrevia os grandes", () => {
    expect(readersLabel(1)).toBe("1 pessoa leu");
    expect(readersLabel(12)).toBe("12 pessoas leram");
    expect(readersLabel(1240)).toBe("1,2 mil pessoas leram");
  });
});
