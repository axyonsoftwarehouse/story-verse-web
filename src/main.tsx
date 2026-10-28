import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import "./App.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { OfflineNotice } from "./components/OfflineNotice";
import { ScrollToTop } from "./components/ScrollToTop";
import {
  AdminRoute,
  ForumHome,
  LegalPage,
  PublicBookPage,
  PublicLibraryPage,
  RouteLoading,
  SubscribePage,
  SubscriptionPage,
  TopicPage,
} from "./lazyRoutes";
import { FORUM_VISIBLE } from "./lib/features";
import { installTelemetry } from "./lib/telemetry";
import { installAnalytics } from "./lib/analytics";
import { registerServiceWorker } from "./lib/pwa";
import { startSplashExit } from "./lib/splash";
import { applyAppTheme } from "./lib/appTheme";

installTelemetry();

// Tráfego no Umami (só nos builds com VITE_UMAMI_WEBSITE_ID).
installAnalytics();

// Cor escolhida pela pessoa antes do primeiro desenho (sem piscar o dourado antes).
applyAppTheme();

// App instalável e leitura offline (só no build de produção).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OfflineNotice />
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteLoading />}>
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
            <Route path="/assinar" element={<SubscribePage />} />
            <Route path="/conta/assinatura" element={<SubscriptionPage />} />
            <Route path="/biblioteca" element={<PublicLibraryPage />} />
            <Route path="/biblioteca/:bookKey" element={<PublicBookPage />} />
            <Route path="/termos" element={<LegalPage doc="termos" />} />
            <Route path="/privacidade" element={<LegalPage doc="privacidade" />} />
            <Route path="/cancelamento" element={<LegalPage doc="cancelamento" />} />
            <Route path="*" element={<App />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
    <DiagnosticsPanel />
  </StrictMode>,
);

// A abertura sai quando o app está pronto (a página inicial espera o login carregar).
startSplashExit();
