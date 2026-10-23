import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import "../../App.css";
import { apiRequest } from "../../lib/backend";
import { useStoredSession } from "../auth/useStoredSession";
import { AccountDetail } from "./AccountDetail";
import { AccountsSection } from "./AccountsSection";
import { AdminNav } from "./AdminNav";
import { FeaturesSection } from "./FeaturesSection";
import { ForumModeration } from "./ForumModeration";
import { OverviewSection } from "./OverviewSection";
import { SubmissionsModeration } from "./SubmissionsModeration";
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
      <div className="profile-card">
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

function Placeholder({ title }: { title: string }) {
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h1>{title}</h1>
      </div>
      <p className="muted">Em construção nesta fase.</p>
    </section>
  );
}

export function AdminRoute() {
  const { session, loading } = useStoredSession();
  const [roles, setRoles] = useState<string[] | null>(null);

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
          <div className="profile-card">
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
          <div className="profile-card">
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
        <AdminNav roles={allowed} />
        <div className="admin-content">
          <Routes>
            <Route
              index
              element={
                <RequireSection id="overview" roles={allowed}>
                  <OverviewSection session={session} />
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
              path="features"
              element={
                <RequireSection id="features" roles={allowed}>
                  <FeaturesSection session={session} />
                </RequireSection>
              }
            />
            <Route
              path="moderacao/acervo"
              element={
                <RequireSection id="submissions" roles={allowed}>
                  <SubmissionsModeration session={session} />
                </RequireSection>
              }
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
              path="auditoria"
              element={
                <RequireSection id="audit" roles={allowed}>
                  <Placeholder title="Auditoria" />
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
