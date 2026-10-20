import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import "./App.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { AdminRoute } from "./features/admin/AdminRoute";
import { ForumHome } from "./features/forum/ForumHome";
import { TopicPage } from "./features/forum/TopicPage";
import { FORUM_VISIBLE } from "./lib/features";
import { installTelemetry } from "./lib/telemetry";
import { registerServiceWorker } from "./lib/pwa";

installTelemetry();

// App instalável e leitura offline (só no build de produção).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/confirmar-email" element={<App />} />
          <Route path="/redefinir-senha" element={<App />} />
          <Route
            path="/comunidade"
            element={FORUM_VISIBLE ? <ForumHome /> : <Navigate to="/" replace />}
          />
          <Route
            path="/comunidade/t/:id"
            element={FORUM_VISIBLE ? <TopicPage /> : <Navigate to="/" replace />}
          />
          <Route path="/admin/*" element={<AdminRoute />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
    {/* Visitantes e páginas vistas no painel do Vercel (aba Analytics). */}
    <Analytics />
    <DiagnosticsPanel />
  </StrictMode>,
);
