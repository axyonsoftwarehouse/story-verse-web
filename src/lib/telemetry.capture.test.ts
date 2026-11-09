import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@sentry/react", () => sentry);

async function loadTelemetry() {
  vi.resetModules();
  vi.stubEnv("VITE_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
  const telemetry = await import("./telemetry");
  telemetry.installTelemetry();
  // A instalação pode registrar eventos próprios (ex.: vitals sem PerformanceObserver no jsdom).
  telemetry.clearTelemetry();
  sentry.captureException.mockClear();
  sentry.addBreadcrumb.mockClear();
  return telemetry;
}

describe("o que vai para o Sentry", () => {
  beforeEach(() => {
    sentry.captureException.mockClear();
    sentry.addBreadcrumb.mockClear();
  });

  it("falha de rede no aparelho vira contexto, não issue", async () => {
    const { captureError, listTelemetry } = await loadTelemetry();
    captureError("api-network", new TypeError("Failed to fetch"), { path: "/api/v1/me" });
    captureError("api-network", Object.assign(new Error("signal timed out"), { name: "TimeoutError" }));
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
    // O diagnóstico local continua registrando.
    expect(listTelemetry()).toHaveLength(2);
  });

  it("erro marcado como esperado (offline, sessão expirada) também não abre issue", async () => {
    const { captureError } = await loadTelemetry();
    const offline = Object.assign(new Error("Não foi possível conectar ao serviço."), { expected: true });
    captureError("sync", offline);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("erro de verdade vai agrupado por tipo e mensagem, não pelo arquivo minificado", async () => {
    const { captureError } = await loadTelemetry();
    captureError("shelf-sync-rejected", new Error("Endereço da capa grande demais."), { status: 400 });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [, options] = sentry.captureException.mock.calls[0];
    expect(options.fingerprint).toEqual(["shelf-sync-rejected", "Endereço da capa grande demais."]);
    expect(options.tags).toEqual({ kind: "shelf-sync-rejected" });
  });
});
