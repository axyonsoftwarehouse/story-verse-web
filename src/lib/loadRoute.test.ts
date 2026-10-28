import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRoute } from "./loadRoute";

const reload = vi.fn();
const gone = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

beforeEach(() => {
  sessionStorage.clear();
  reload.mockReset();
});

describe("loadRoute", () => {
  it("devolve o módulo quando o arquivo chega e limpa a marca de recarga", async () => {
    sessionStorage.setItem("storyverse:route-reload", "1");
    await expect(loadRoute(() => Promise.resolve("rota"), reload)).resolves.toBe("rota");
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("storyverse:route-reload")).toBeNull();
  });

  it("recarrega uma vez quando o arquivo da rota sumiu depois de um deploy", async () => {
    void loadRoute(gone, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem("storyverse:route-reload")).toBe("1");
  });

  it("não recarrega em laço se já tentou", async () => {
    sessionStorage.setItem("storyverse:route-reload", "1");
    await expect(loadRoute(gone, reload)).rejects.toThrow("dynamically imported module");
    expect(reload).not.toHaveBeenCalled();
  });
});
