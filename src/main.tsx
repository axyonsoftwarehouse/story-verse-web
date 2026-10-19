import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import "./App.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { AdminRoute } from "./features/admin/AdminRoute";
import { ForumHome } from "./features/forum/ForumHome";
import { TopicPage } from "./features/forum/TopicPage";
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
          <Route path="/comunidade" element={<ForumHome />} />
          <Route path="/comunidade/t/:id" element={<TopicPage />} />
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
