import { lazy } from "react";
import { loadRoute } from "./lib/loadRoute";

// Só a página inicial vem no arquivo principal: admin, grupos, assinatura e acervo público
// carregam quando a rota abre, para a primeira tela desenhar mais cedo.
export const AdminRoute = lazy(() =>
  loadRoute(() => import("./features/admin/AdminRoute")).then((m) => ({ default: m.AdminRoute })),
);
export const GroupsHome = lazy(() =>
  loadRoute(() => import("./features/groups/GroupsHome")).then((m) => ({ default: m.GroupsHome })),
);
export const GroupChat = lazy(() =>
  loadRoute(() => import("./features/groups/GroupChat")).then((m) => ({ default: m.GroupChat })),
);
export const GroupInvite = lazy(() =>
  loadRoute(() => import("./features/groups/GroupInvite")).then((m) => ({ default: m.GroupInvite })),
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

export const LegalPage = lazy(() =>
  loadRoute(() => import("./features/legal/LegalPage")).then((m) => ({ default: m.LegalPage })),
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
