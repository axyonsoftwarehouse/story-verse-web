import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import { apiRequest } from "../../lib/backend";
import { useStoredSession } from "../auth/useStoredSession";
import { ForumModeration } from "./ForumModeration";

const ADMIN_ROLES = ["superadmin", "moderator", "support"];

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  moderator: "Moderador",
  support: "Suporte",
};

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
  const canModerate = allowed.includes("superadmin") || allowed.includes("moderator");
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

  return (
    <Page>
      <section className="shelf">
        <div className="shelf-head">
          <h1>Dashboard admin</h1>
        </div>
        <div className="profile-card profile-admin">
          <div>
            <strong>Estrutura pronta</strong>
            <span>
              Papéis: {allowed.map((role) => ROLE_LABEL[role] ?? role).join(", ")}
            </span>
          </div>
        </div>
      </section>
      <ForumModeration session={session} canModerate={canModerate} />
      <section className="shelf">
        <div className="shelf-head">
          <h2>Próximos módulos</h2>
        </div>
        <div className="dash-tiles">
          {["Visão geral", "Usuários", "Moderação", "Auditoria"].map((title) => (
            <article className="dash-card" key={title}>
              <strong>{title}</strong>
              <span>Em construção na fase 1.</span>
            </article>
          ))}
        </div>
      </section>
    </Page>
  );
}
