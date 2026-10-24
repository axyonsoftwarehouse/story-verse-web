import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  listUsers,
  recentUsers,
  type AdminUserFilters,
  type AdminUserSummary,
} from "../../lib/adminUsers";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  moderator: "Moderador",
  support: "Suporte",
};

const FEATURES = [{ id: "library", label: "Estante (library)" }];

type AppliedFilters = Pick<AdminUserFilters, "q" | "role" | "feature">;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar as contas.";
}

function createdDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function lastSignIn(value: string | null): string {
  if (!value) return "nunca entrou";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function UserList({ users }: { users: AdminUserSummary[] }) {
  return (
    <ul className="admin-user-list">
      {users.map((user) => (
        <li key={user.id}>
          <Link className="admin-user-row" to={`/admin/contas/${user.id}`}>
            <span>
              <strong>{user.name}</strong>
              <span className="muted">{user.emailMasked}</span>
              <span className="muted">
                Criada em {createdDate(user.createdAt)} · último login {lastSignIn(user.lastSignInAt)}
              </span>
            </span>
            <span className="admin-user-flags">
              {!user.emailConfirmed ? <span className="status-chip">e-mail não confirmado</span> : null}
              {user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <span className="status-chip is-approved" key={role}>
                    {ROLE_LABEL[role] ?? role}
                  </span>
                ))
              ) : (
                <span className="muted">sem papel</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AccountsSection({ session }: { session: SupabaseSession }) {
  const [recent, setRecent] = useState<AdminUserSummary[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [items, setItems] = useState<AdminUserSummary[] | null>(null);
  const [filters, setFilters] = useState<AppliedFilters | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [feature, setFeature] = useState("");

  useEffect(() => {
    let alive = true;
    setRecentLoading(true);
    recentUsers(session)
      .then((rows) => {
        if (alive) setRecent(rows);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setRecentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  function load(next: AppliedFilters, append = false, cursor?: string) {
    if (!append) {
      setLoading(true);
      setItems(null);
      setNextCursor(null);
    } else {
      setLoadingMore(true);
    }
    setError("");
    listUsers(session, { ...next, cursor, limit: 20 })
      .then((page) => {
        setItems((current) => {
          if (!append) return page.items;
          const seen = new Set((current ?? []).map((item) => item.id));
          return [...(current ?? []), ...page.items.filter((item) => !seen.has(item.id))];
        });
        setNextCursor(page.nextCursor);
      })
      .catch((err) => setError(message(err)))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: AppliedFilters = { q: q.trim(), role, feature };
    if (!next.q && !next.role && !next.feature) {
      clear();
      return;
    }
    setFilters(next);
    load(next);
  }

  function clear() {
    setQ("");
    setRole("");
    setFeature("");
    setFilters(null);
    setItems(null);
    setNextCursor(null);
    setError("");
  }

  function more() {
    if (!filters || !nextCursor || loadingMore) return;
    load(filters, true, nextCursor);
  }

  const showingRecent = items === null && filters === null;

  return (
    <section className="shelf">
      <div className="shelf-head">
        <h1>Contas</h1>
      </div>

      <form className="admin-search" onSubmit={submit}>
        <label>
          Buscar conta
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="UUID, e-mail ou parte do nome"
            autoComplete="off"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Filtrar"}
        </button>
      </form>

      <div className="admin-filters">
        <label>
          Papel
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Todos</option>
            <option value="superadmin">Superadmin</option>
            <option value="moderator">Moderador</option>
            <option value="support">Suporte</option>
          </select>
        </label>
        <label>
          Feature
          <select value={feature} onChange={(event) => setFeature(event.target.value)}>
            <option value="">Todas</option>
            {FEATURES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {filters !== null ? (
          <button type="button" className="btn" onClick={clear} disabled={loading}>
            Limpar
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {showingRecent ? (
        <>
          <div className="shelf-head">
            <h2>Contas recentes</h2>
          </div>
          {recentLoading ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              Carregando contas…
            </div>
          ) : recent && recent.length > 0 ? (
            <UserList users={recent} />
          ) : (
            <p className="profile-empty">Nenhuma conta ainda.</p>
          )}
        </>
      ) : (
        <>
          <div className="shelf-head">
            <h2>Resultados</h2>
            <p className="muted">
              {loading ? "Buscando…" : `${items?.length ?? 0} ${(items?.length ?? 0) === 1 ? "conta" : "contas"}`}
            </p>
          </div>
          {loading ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              Buscando…
            </div>
          ) : items && items.length > 0 ? (
            <UserList users={items} />
          ) : (
            <p className="profile-empty">Nenhuma conta encontrada.</p>
          )}
          {nextCursor ? (
            <div className="catalog-pager">
              <button type="button" className="btn" onClick={more} disabled={loadingMore}>
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
