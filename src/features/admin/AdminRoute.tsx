import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import "../../App.css";
import { getOverview } from "../../lib/adminOverview";
import { apiRequest } from "../../lib/backend";
import { useStoredSession } from "../auth/useStoredSession";
import { AccountDetail } from "./AccountDetail";
import { AccountsSection } from "./AccountsSection";
import { AdminAcervo } from "./AdminAcervo";
import { AdminNav, type AdminPending } from "./AdminNav";
import { AuditSection } from "./AuditSection";
import { BillingSection } from "./BillingSection";
import { CatalogBookPage } from "./CatalogBookPage";
import { FeaturesSection } from "./FeaturesSection";
import { ForumModeration } from "./ForumModeration";
import { MetricsSection } from "./MetricsSection";
import { OverviewSection } from "./OverviewSection";
import { SanctionsSection } from "./SanctionsSection";
import { SiteSection } from "./SiteSection";
import { canModerate, visibleSections, type AdminSectionId } from "./adminSections";
import "./admin.css";

const ADMIN_ROLES = ["superadmin", "moderator", "support"];

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
      </nav>
      {children}
    </div>
  );
}

function NoPermission() {
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h1>Sem permissão</h1>
      </div>
      <div className="profile-card admin-message-card">
        <div>
          <strong>Sem permissão</strong>
          <span>Esta conta não tem acesso a esta seção.</span>
        </div>
        <Link className="btn" to="/">
          Voltar para a home
        </Link>
      </div>
    </section>
  );
}

function RequireSection({
  id,
  roles,
  children,
}: {
  id: AdminSectionId;
  roles: string[];
  children: ReactNode;
}) {
  const allowed = visibleSections(roles).some((section) => section.id === id);
  if (!allowed) return <NoPermission />;
  return <>{children}</>;
}

export function AdminRoute() {
  const { session, loading } = useStoredSession();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [pending, setPending] = useState<AdminPending>({});

  useEffect(() => {
    if (!session) {
      setRoles(null);
      return;
    }
    let alive = true;
    apiRequest<{ roles: string[] }>("/api/v1/auth/capabilities", {
      accessToken: session.access_token,
    })
      .then((result) => {
        if (alive) setRoles(result.roles ?? []);
      })
      .catch(() => {
        if (alive) setRoles([]);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  // Contadores do menu: a mesma visão geral do dashboard, carregada uma vez por sessão.
  const isAdmin = (roles ?? []).some((role) => ADMIN_ROLES.includes(role));
  useEffect(() => {
    if (!session || !isAdmin) return;
    let alive = true;
    getOverview(session)
      .then((result) => {
        if (!alive || !result.moderation) return;
        setPending({
          catalog: result.moderation.pendingSubmissions,
          forum: result.moderation.openReports,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [session, isAdmin]);

  if (loading) {
    return (
      <Page>
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando sessão…
        </div>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page>
        <section className="shelf">
          <div className="shelf-head">
            <h1>Admin</h1>
          </div>
          <div className="profile-card admin-message-card">
            <div>
              <strong>Entre na sua conta</strong>
              <span>O painel administrativo usa a mesma conta do site.</span>
            </div>
            <Link className="btn btn-primary" to="/">
              Ir para a home
            </Link>
          </div>
        </section>
      </Page>
    );
  }

  if (roles === null) {
    return (
      <Page>
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Conferindo permissões…
        </div>
      </Page>
    );
  }

  const allowed = roles.filter((role) => ADMIN_ROLES.includes(role));
  if (allowed.length === 0) {
    return (
      <Page>
        <section className="shelf">
          <div className="shelf-head">
            <h1>Admin</h1>
          </div>
          <div className="profile-card admin-message-card">
            <div>
              <strong>Sem permissão</strong>
              <span>Esta conta não tem acesso ao painel administrativo.</span>
            </div>
            <Link className="btn" to="/">
              Voltar para a home
            </Link>
          </div>
        </section>
      </Page>
    );
  }

  const canModerateForum = canModerate(allowed);

  return (
    <Page>
      <div className="admin-shell">
        <AdminNav roles={allowed} pending={pending} />
        <div className="admin-content">
          <Routes>
            <Route
              index
              element={
                <RequireSection id="overview" roles={allowed}>
                  <OverviewSection session={session} roles={allowed} />
                </RequireSection>
              }
            />
            <Route
              path="contas"
              element={
                <RequireSection id="accounts" roles={allowed}>
                  <AccountsSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="contas/:id"
              element={
                <RequireSection id="accounts" roles={allowed}>
                  <AccountDetail session={session} roles={allowed} />
                </RequireSection>
              }
            />
            <Route
              path="sancoes"
              element={
                <RequireSection id="sanctions" roles={allowed}>
                  <SanctionsSection session={session} roles={allowed} />
                </RequireSection>
              }
            />
            <Route
              path="features"
              element={
                <RequireSection id="features" roles={allowed}>
                  <FeaturesSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="acervo"
              element={
                <RequireSection id="catalog" roles={allowed}>
                  <AdminAcervo session={session} tab="catalog" />
                </RequireSection>
              }
            />
            <Route
              path="acervo/envios"
              element={
                <RequireSection id="catalog" roles={allowed}>
                  <AdminAcervo session={session} tab="envios" />
                </RequireSection>
              }
            />
            <Route
              path="acervo/colecoes"
              element={
                <RequireSection id="catalog" roles={allowed}>
                  <AdminAcervo session={session} tab="colecoes" />
                </RequireSection>
              }
            />
            <Route
              path="acervo/importacoes"
              element={
                <RequireSection id="catalog" roles={allowed}>
                  <AdminAcervo session={session} tab="importacoes" />
                </RequireSection>
              }
            />
            <Route
              path="acervo/:id"
              element={
                <RequireSection id="catalog" roles={allowed}>
                  <CatalogBookPage session={session} roles={allowed} />
                </RequireSection>
              }
            />
            {/* Endereço antigo da moderação: mantém links salvos e o fluxo do QA funcionando. */}
            <Route
              path="moderacao/acervo"
              element={<Navigate to="/admin/acervo/envios" replace />}
            />
            <Route
              path="moderacao/forum"
              element={
                <RequireSection id="forum" roles={allowed}>
                  <ForumModeration session={session} canModerate={canModerateForum} />
                </RequireSection>
              }
            />
            <Route
              path="metricas"
              element={
                <RequireSection id="metrics" roles={allowed}>
                  <MetricsSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="site"
              element={
                <RequireSection id="site" roles={allowed}>
                  <SiteSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="financeiro"
              element={
                <RequireSection id="billing" roles={allowed}>
                  <BillingSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="auditoria"
              element={
                <RequireSection id="audit" roles={allowed}>
                  <AuditSection session={session} />
                </RequireSection>
              }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </Page>
  );
}
