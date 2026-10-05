import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { installTelemetry } from "./lib/telemetry";
import { registerServiceWorker } from "./lib/pwa";

installTelemetry();

// App instalável e leitura offline (só no build de produção).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Visitantes e páginas vistas no painel do Vercel (aba Analytics). */}
    <Analytics />
    <DiagnosticsPanel />
  </StrictMode>,
);
