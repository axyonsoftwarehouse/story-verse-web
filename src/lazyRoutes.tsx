import { lazy } from "react";
import { loadRoute } from "./lib/loadRoute";

// Só a página inicial vem no arquivo principal: admin, fórum, assinatura e acervo público
// carregam quando a rota abre, para a primeira tela desenhar mais cedo.
export const AdminRoute = lazy(() =>
  loadRoute(() => import("./features/admin/AdminRoute")).then((m) => ({ default: m.AdminRoute })),
);
export const ForumHome = lazy(() =>
  loadRoute(() => import("./features/forum/ForumHome")).then((m) => ({ default: m.ForumHome })),
);
export const TopicPage = lazy(() =>
  loadRoute(() => import("./features/forum/TopicPage")).then((m) => ({ default: m.TopicPage })),
);
export const SubscribePage = lazy(() =>
  loadRoute(() => import("./features/billing/SubscribePage")).then((m) => ({
    default: m.SubscribePage,
  })),
);
export const SubscriptionPage = lazy(() =>
  loadRoute(() => import("./features/billing/SubscriptionPage")).then((m) => ({
    default: m.SubscriptionPage,
  })),
);
export const PublicBookPage = lazy(() =>
  loadRoute(() => import("./features/catalog/PublicBookPage")).then((m) => ({
    default: m.PublicBookPage,
  })),
);
export const PublicLibraryPage = lazy(() =>
  loadRoute(() => import("./features/catalog/PublicLibraryPage")).then((m) => ({
    default: m.PublicLibraryPage,
  })),
);

/** Enquanto o código da rota chega (na primeira visita a abertura ainda cobre a tela). */
export function RouteLoading() {
  return (
    <main className="auth-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>Carregando…</p>
    </main>
  );
}
