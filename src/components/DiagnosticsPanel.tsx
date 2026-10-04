import { useSyncExternalStore, useState, type CSSProperties } from "react";
import {
  buildDiagnosticsReport,
  clearTelemetry,
  getVitals,
  listTelemetry,
  subscribeTelemetry,
} from "../lib/telemetry";

function debugEnabled(): boolean {
  try {
    if (new URLSearchParams(location.search).get("debug") === "1") return true;
    return localStorage.getItem("storyverse:debug") === "1";
  } catch {
    return false;
  }
}

const enabled = typeof window !== "undefined" && debugEnabled();

const badge: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 12,
  zIndex: 9999,
  border: "1px solid rgba(228,184,106,0.5)",
  background: "rgba(12,10,8,0.92)",
  color: "#e4b86a",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontFamily: "system-ui, sans-serif",
  cursor: "pointer",
};

const panel: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 56,
  zIndex: 9999,
  width: "min(440px, calc(100vw - 24px))",
  maxHeight: "60vh",
  overflow: "auto",
  background: "rgba(12,10,8,0.97)",
  border: "1px solid rgba(228,184,106,0.35)",
  borderRadius: 12,
  padding: 12,
  color: "#e8e0d4",
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  lineHeight: 1.5,
};

const miniButton: CSSProperties = {
  border: "1px solid rgba(228,184,106,0.4)",
  background: "transparent",
  color: "#e4b86a",
  borderRadius: 8,
  padding: "2px 8px",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  cursor: "pointer",
};

const row: CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 6,
  marginTop: 6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

export function DiagnosticsPanel() {
  const events = useSyncExternalStore(subscribeTelemetry, listTelemetry, listTelemetry);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!enabled) return null;

  const errors = events.filter((event) => event.level === "error").length;

  const copy = () => {
    void navigator.clipboard?.writeText(buildDiagnosticsReport());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button style={badge} onClick={() => setOpen((value) => !value)}>
        diag {errors > 0 ? `· ${errors} erro${errors === 1 ? "" : "s"}` : `· ${events.length}`}
      </button>
      {open && (
        <div style={panel}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <strong style={{ color: "#e4b86a", flex: 1 }}>Diagnóstico local</strong>
            <button style={miniButton} onClick={copy}>
              {copied ? "copiado" : "copiar"}
            </button>
            <button style={miniButton} onClick={() => clearTelemetry()}>
              limpar
            </button>
          </div>
          <div>
            vitals: {JSON.stringify(getVitals())}
          </div>
          {events.length === 0 && <div style={row}>nenhum evento</div>}
          {events.map((event) => (
            <div key={`${event.at}-${event.kind}-${event.message}`} style={row}>
              <div>
                [{new Date(event.at).toLocaleTimeString()}] {event.level.toUpperCase()} {event.kind}
              </div>
              <div>{event.message}</div>
              {event.context && <div style={{ opacity: 0.6 }}>{JSON.stringify(event.context)}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
