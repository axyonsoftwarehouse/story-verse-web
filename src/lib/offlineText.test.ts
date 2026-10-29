import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthNetworkError } from "./backend";
import { SLOW_NETWORK_MS, readOfflineText, saveOfflineText, withOfflineCopy } from "./offlineText";

/** Cache API mínima (o jsdom não tem). */
function fakeCaches() {
  const store = new Map<string, string>();
  const cache = {
    match: async (url: string) => (store.has(url) ? new Response(store.get(url)) : undefined),
    put: async (url: string, res: Response) => {
      store.set(url, await res.text());
    },
  };
  return { open: async () => cache, store };
}

let fake: ReturnType<typeof fakeCaches>;

beforeEach(() => {
  fake = fakeCaches();
  vi.stubGlobal("caches", fake);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("withOfflineCopy", () => {
  it("com rede, baixa e guarda a cópia", async () => {
    await expect(withOfflineCopy("catalog:a", async () => "texto novo")).resolves.toBe("texto novo");
    await expect(readOfflineText("catalog:a")).resolves.toBe("texto novo");
  });

  it("sem conexão, abre a cópia guardada", async () => {
    await saveOfflineText("catalog:a", "cópia");
    const load = vi.fn(async () => {
      throw new AuthNetworkError("Sem conexão com o servidor.");
    });
    await expect(withOfflineCopy("catalog:a", load)).resolves.toBe("cópia");
  });

  it("com o aparelho offline, nem tenta a rede", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await saveOfflineText("community:x", "cópia");
    const load = vi.fn(async () => "rede");
    await expect(withOfflineCopy("community:x", load)).resolves.toBe("cópia");
    expect(load).not.toHaveBeenCalled();
  });

  it("rede pendurada: abre a cópia depois de um tempo", async () => {
    vi.useFakeTimers();
    await saveOfflineText("catalog:a", "cópia");
    const pending = withOfflineCopy("catalog:a", () => new Promise<string>(() => {}));
    await vi.advanceTimersByTimeAsync(SLOW_NETWORK_MS);
    await expect(pending).resolves.toBe("cópia");
  });

  it("resposta do servidor (ex.: sem assinatura) não usa a cópia", async () => {
    await saveOfflineText("catalog:a", "cópia");
    const load = vi.fn(async () => {
      throw new Error("Assinatura necessária.");
    });
    await expect(withOfflineCopy("catalog:a", load)).rejects.toThrow("Assinatura necessária.");
  });

  it("sem cópia e sem conexão, mostra o erro de conexão", async () => {
    const load = vi.fn(async () => {
      throw new AuthNetworkError("Sem conexão com o servidor.");
    });
    await expect(withOfflineCopy("catalog:b", load)).rejects.toBeInstanceOf(AuthNetworkError);
  });

  it("sem Cache API, só usa a rede", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(withOfflineCopy("catalog:a", async () => "rede")).resolves.toBe("rede");
  });
});
