import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import "./App.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { QaBanner } from "./components/QaBanner";
import { AdminRoute } from "./features/admin/AdminRoute";
import { ForumHome } from "./features/forum/ForumHome";
import { TopicPage } from "./features/forum/TopicPage";
import { FORUM_VISIBLE } from "./lib/features";
import { installTelemetry } from "./lib/telemetry";
import { registerServiceWorker } from "./lib/pwa";
import { startSplashExit } from "./lib/splash";
import { applyAppTheme } from "./lib/appTheme";

installTelemetry();

// Cor escolhida pela pessoa antes do primeiro desenho (sem piscar o dourado antes).
applyAppTheme();

// App instalável e leitura offline (só no build de produção).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QaBanner env={import.meta.env.VITE_APP_ENV} />
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
    <DiagnosticsPanel />
  </StrictMode>,
);

// A abertura sai quando o app está pronto (a página inicial espera o login carregar).
startSplashExit();
