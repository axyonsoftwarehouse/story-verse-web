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
export const PeoplePage = lazy(() =>
  loadRoute(() => import("./features/social/PeoplePage")).then((m) => ({ default: m.PeoplePage })),
);
export const PersonProfilePage = lazy(() =>
  loadRoute(() => import("./features/social/PersonProfilePage")).then((m) => ({ default: m.PersonProfilePage })),
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
export const AudiobooksPage = lazy(() =>
  loadRoute(() => import("./features/audiobook/AudiobooksPage")).then((m) => ({
    default: m.AudiobooksPage,
  })),
);
export const AudiobookPage = lazy(() =>
  loadRoute(() => import("./features/audiobook/AudiobookPage")).then((m) => ({
    default: m.AudiobookPage,
  })),
);

export const ShopPage = lazy(() =>
  loadRoute(() => import("./features/shop/ShopPage")).then((m) => ({ default: m.ShopPage })),
);

/* Telas da home que só abrem por clique (V3): fora do bundle principal. */
export const DiamondShopPage = lazy(() =>
  loadRoute(() => import("./features/home/DiamondShop")).then((m) => ({ default: m.DiamondShopPage })),
);

export const DailySpinModal = lazy(() =>
  loadRoute(() => import("./features/home/DiamondShop")).then((m) => ({ default: m.DailySpinModal })),
);

export const RankingPage = lazy(() =>
  loadRoute(() => import("./features/home/RankingPage")).then((m) => ({ default: m.RankingPage })),
);

export const ProfilePage = lazy(() =>
  loadRoute(() => import("./features/profile/ProfilePage")).then((m) => ({ default: m.ProfilePage })),
);

export const LegalPage = lazy(() =>
  loadRoute(() => import("./features/legal/LegalPage")).then((m) => ({ default: m.LegalPage })),
);

/* Modais que só abrem por clique ou link (V3): login, senha nova, instalar e "Sobre". */
export const AuthModal = lazy(() =>
  loadRoute(() => import("./features/auth/AuthModal")).then((m) => ({ default: m.AuthModal })),
);
export const NewPasswordModal = lazy(() =>
  loadRoute(() => import("./features/auth/AuthModal")).then((m) => ({ default: m.NewPasswordModal })),
);
export const InstallAppDialog = lazy(() =>
  loadRoute(() => import("./features/home/InstallAppDialog")).then((m) => ({ default: m.InstallAppDialog })),
);
export const AboutDialog = lazy(() =>
  loadRoute(() => import("./features/home/AboutDialog")).then((m) => ({ default: m.AboutDialog })),
);

let communityPrefetched = false;

/** Baixa cedo as páginas que abrem por clique, para a troca não esperar o arquivo. */
export function prefetchCommunityRoutes() {
  if (communityPrefetched) return;
  communityPrefetched = true;
  const routes = [
    () => import("./features/groups/GroupsHome"),
    () => import("./features/groups/GroupChat"),
    () => import("./features/social/PeoplePage"),
    () => import("./features/social/PersonProfilePage"),
    () => import("./features/profile/ProfilePage"),
    () => import("./features/home/RankingPage"),
    () => import("./features/home/DiamondShop"),
    () => import("./features/shop/ShopPage"),
    () => import("./features/audiobook/AudiobooksPage"),
    () => import("./features/audiobook/AudiobookPage"),
    () => import("./features/billing/SubscribePage"),
    () => import("./features/catalog/PublicLibraryPage"),
  ];
  for (const load of routes) void loadRoute(load as () => Promise<unknown>);
}

/** Enquanto o código da rota chega: casca fixa, sem spinner central que pisca. */
export function RouteLoading() {
  return (
    <main className="home groups-page route-loading-shell" role="status" aria-live="polite" data-route-loading>
      <nav className="home-nav profile-nav" aria-hidden="true">
        <span className="route-loading-pill skeleton" />
      </nav>
      <header className="groups-hero route-loading-hero skeleton" aria-hidden="true" />
      <ul className="route-loading-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="route-loading-row skeleton" />
        ))}
      </ul>
    </main>
  );
}
