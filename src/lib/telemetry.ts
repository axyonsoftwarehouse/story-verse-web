import * as Sentry from "@sentry/react";

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
let sentryEnabled = false;

function redact(text: string): string {
  return text.replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return "[URL]"; }
  }).replace(/((?:access_token|refresh_token|password|authorization|api[_-]?key)\s*[=:]\s*)[^&\s]+/gi, "$1[redacted]");
}

function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;
  const sampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0");
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE?.trim() || appVersion(),
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
      },
      tracesSampleRate: Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : 0,
      // Os erros globais já passam pelo buffer local abaixo; evita evento duplicado.
      integrations: (defaults) => defaults.filter((integration) => integration.name !== "GlobalHandlers"),
      beforeSend(event) {
        event.user = undefined;
        event.request = undefined;
        event.breadcrumbs = undefined;
        if (event.extra) event.extra = sanitizeTelemetry(event.extra);
        if (event.contexts) event.contexts = sanitizeTelemetry(event.contexts);
        if (event.tags) event.tags = sanitizeTelemetry(event.tags);
        return event;
      },
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
        if (breadcrumb.data) breadcrumb.data = sanitizeTelemetry(breadcrumb.data);
        return breadcrumb;
      },
    });
    sentryEnabled = true;
  } catch (error) {
    console.warn("Sentry não inicializou:", error);
  }
}

/** Dispara um evento de teste para confirmar a integração no painel do Sentry. */
export function sendSentryTest(): boolean {
  if (!sentryEnabled) return false;
  Sentry.captureException(new Error("Storyverse: teste de integração com o Sentry"), {
    tags: { kind: "sentry-test" },
  });
  return true;
}

export function sanitizeTelemetry<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, item: unknown) => {
    if (/^(access_token|refresh_token|accessToken|refreshToken|authorization|password|apiKey|anonKey)$/i.test(key)) return "[redacted]";
    return typeof item === "string" ? redact(item) : item;
  })) as T;
}

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
    events = Array.isArray(parsed.events) ? sanitizeTelemetry(parsed.events).slice(0, MAX_EVENTS) : [];
    vitals = parsed.vitals ?? {};
    persist();
  } catch {
    events = [];
    vitals = {};
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function push(event: TelemetryEvent): void {
  events = [sanitizeTelemetry(event), ...events].slice(0, MAX_EVENTS);
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
  const safeContext = context ? sanitizeTelemetry(context) : undefined;
  push({
    at: Date.now(),
    level: "error",
    kind,
    message: messageOf(error),
    detail: detailOf(error),
    context: safeContext,
  });
  if (sentryEnabled) {
    const exception = error instanceof Error ? error : new Error(messageOf(error));
    Sentry.captureException(exception, { tags: { kind }, extra: safeContext });
  }
}

export function captureEvent(
  level: TelemetryLevel,
  kind: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  const safeContext = context ? sanitizeTelemetry(context) : undefined;
  push({ at: Date.now(), level, kind, message, context: safeContext });
  if (!sentryEnabled) return;
  if (level === "info") {
    Sentry.addBreadcrumb({ category: kind, message, level: "info", data: safeContext });
  } else {
    Sentry.captureMessage(message, {
      level: level === "error" ? "error" : "warning",
      tags: { kind },
      extra: safeContext,
    });
  }
}

function appVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}

export function environment(): Record<string, unknown> {
  return {
    version: appVersion(),
    mode: import.meta.env.MODE,
    url: location.origin + location.pathname,
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
  initSentry();
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
