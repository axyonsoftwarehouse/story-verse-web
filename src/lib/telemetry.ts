export type TelemetryLevel = "error" | "warn" | "info";

export type TelemetryEvent = {
  at: number;
  level: TelemetryLevel;
  kind: string;
  message: string;
  detail?: string;
  context?: Record<string, unknown>;
};

export type TelemetryVitals = Record<string, number>;

const MAX_EVENTS = 80;
const STORAGE_KEY = "storyverse:diagnostics";

let events: TelemetryEvent[] = [];
let vitals: TelemetryVitals = {};
const listeners = new Set<() => void>();
let installed = false;

function persist(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ events, vitals }));
  } catch {
    // sem espaço: o buffer segue só em memória
  }
}

function restore(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { events?: TelemetryEvent[]; vitals?: TelemetryVitals };
    events = Array.isArray(parsed.events) ? parsed.events : [];
    vitals = parsed.vitals ?? {};
  } catch {
    events = [];
    vitals = {};
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function push(event: TelemetryEvent): void {
  events = [event, ...events].slice(0, MAX_EVENTS);
  persist();
  notify();
}

export function subscribeTelemetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listTelemetry(): TelemetryEvent[] {
  return events;
}

export function getVitals(): TelemetryVitals {
  return vitals;
}

export function clearTelemetry(): void {
  events = [];
  vitals = {};
  persist();
  notify();
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function detailOf(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export function captureError(kind: string, error: unknown, context?: Record<string, unknown>): void {
  push({
    at: Date.now(),
    level: "error",
    kind,
    message: messageOf(error),
    detail: detailOf(error),
    context,
  });
}

export function captureEvent(
  level: TelemetryLevel,
  kind: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  push({ at: Date.now(), level, kind, message, context });
}

function appVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}

export function environment(): Record<string, unknown> {
  return {
    version: appVersion(),
    mode: import.meta.env.MODE,
    url: location.href,
    online: navigator.onLine,
    language: navigator.language,
    ua: navigator.userAgent,
  };
}

function setVital(name: string, value: number): void {
  if (!Number.isFinite(value)) return;
  vitals = { ...vitals, [name]: Math.round(value) };
  persist();
  notify();
}

type LayoutShiftEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean };

function observeVitals(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) setVital("ttfb", nav.responseStart);

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") setVital("fcp", entry.startTime);
      }
    }).observe({ entryTypes: ["paint"] });

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) setVital("lcp", last.startTime);
    }).observe({ entryTypes: ["largest-contentful-paint"] });

    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
      setVital("cls", cls * 1000);
    }).observe({ entryTypes: ["layout-shift"] });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) setVital("fid", entry.startTime);
    }).observe({ entryTypes: ["first-input"] });
  } catch (error) {
    captureError("vitals-setup", error);
  }
}

export function installTelemetry(): void {
  if (installed) return;
  installed = true;
  restore();

  window.addEventListener("error", (event) => {
    const e = event as ErrorEvent;
    captureError("window-error", e.error ?? e.message, {
      file: e.filename,
      line: e.lineno,
      column: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureError("unhandled-rejection", (event as PromiseRejectionEvent).reason);
  });

  window.addEventListener("online", () => captureEvent("info", "network", "online"));
  window.addEventListener("offline", () => captureEvent("warn", "network", "offline"));

  observeVitals();
  captureEvent("info", "session", `app ${appVersion()}`, environment());
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

export function buildDiagnosticsReport(): string {
  const env = environment();
  const lines: string[] = [];
  lines.push("Storyverse — diagnóstico");
  lines.push(`gerado: ${new Date().toISOString()}`);
  lines.push(`versao: ${env.version} (${env.mode})`);
  lines.push(`url: ${env.url}`);
  lines.push(`online: ${env.online} | idioma: ${env.language}`);
  lines.push(`user-agent: ${env.ua}`);
  lines.push(`vitals: ${JSON.stringify(vitals)}`);
  lines.push("");
  lines.push(`eventos (${events.length}):`);
  for (const event of events) {
    lines.push(`- [${new Date(event.at).toISOString()}] ${event.level.toUpperCase()} ${event.kind}: ${event.message}`);
    if (event.context) lines.push(indent(`ctx: ${JSON.stringify(event.context)}`));
    if (event.detail) lines.push(indent(event.detail));
  }
  return lines.join("\n");
}
