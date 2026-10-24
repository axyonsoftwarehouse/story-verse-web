import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { searchUsers, type AdminUserSummary } from "../../lib/adminUsers";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  moderator: "Moderador",
  support: "Suporte",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível buscar as contas.";
}

export function AccountsSection({ session }: { session: SupabaseSession }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminUserSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setResults(null);
    searchUsers(session, query)
      .then((rows) => setResults(rows))
      .catch((err) => setError(message(err)))
      .finally(() => setLoading(false));
  }

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
        <button className="btn btn-primary" type="submit" disabled={loading || !q.trim()}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Buscando…
        </div>
      ) : null}

      {!loading && results !== null && results.length === 0 ? (
        <p className="profile-empty">Nenhuma conta encontrada.</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="admin-user-list">
          {results.map((user) => (
            <li key={user.id}>
              <Link className="admin-user-row" to={`/admin/contas/${user.id}`}>
                <span>
                  <strong>{user.name}</strong>
                  <span className="muted">{user.emailMasked}</span>
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
      ) : null}
    </section>
  );
}
