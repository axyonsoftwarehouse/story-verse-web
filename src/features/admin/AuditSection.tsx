import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { listAudit, type AuditEntry, type AuditFilters } from "../../lib/adminAudit";
import { actionLabel, actorLabel, metadataLines } from "./auditFormat";

const ACTIONS = [
  { value: "", label: "Todas" },
  { value: "feature.", label: "Features" },
  { value: "role.", label: "Papéis" },
  { value: "user.", label: "Contas" },
  { value: "admin.", label: "Admin" },
  { value: "book_submission.", label: "Acervo" },
  { value: "forum.", label: "Fórum" },
];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a auditoria.";
}

function when(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function AuditSection({ session }: { session: SupabaseSession }) {
  const [form, setForm] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listAudit(session, {})
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setNextBefore(page.nextBefore);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  async function load(nextFilters: AuditFilters, before: number | null, append: boolean) {
    setLoading(true);
    setError("");
    try {
      const page = await listAudit(session, nextFilters, before);
      setItems((current) => (append ? [...(current ?? []), ...page.items] : page.items));
      setNextBefore(page.nextBefore);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean: AuditFilters = {};
    for (const [key, value] of Object.entries(form)) {
      if (value) clean[key as keyof AuditFilters] = value;
    }
    setFilters(clean);
    setItems(null);
    setNextBefore(null);
    void load(clean, null, false);
  }

  function clear() {
    setForm({});
    setFilters({});
    setItems(null);
    setNextBefore(null);
    void load({}, null, false);
  }

  function field(key: keyof AuditFilters, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="shelf">
      <div className="shelf-head">
        <h1>Auditoria</h1>
      </div>

      <form className="admin-filters" onSubmit={submit}>
        <label>
          Ação
          <select value={form.action ?? ""} onChange={(event) => field("action", event.target.value)}>
            {ACTIONS.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ID do ator
          <input value={form.actorId ?? ""} onChange={(event) => field("actorId", event.target.value)} />
        </label>
        <label>
          ID do alvo
          <input value={form.targetId ?? ""} onChange={(event) => field("targetId", event.target.value)} />
        </label>
        <label>
          De
          <input type="date" value={form.from ?? ""} onChange={(event) => field("from", event.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={form.to ?? ""} onChange={(event) => field("to", event.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          Filtrar
        </button>
        <button className="btn" type="button" onClick={clear} disabled={loading}>
          Limpar
        </button>
      </form>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items === null ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando auditoria…
        </div>
      ) : items && items.length === 0 ? (
        <p className="profile-empty">Nenhuma ação registrada.</p>
      ) : (
        <ul className="admin-audit-list">
          {items?.map((entry) => (
            <li key={entry.id} className="admin-audit-entry">
              <div className="admin-audit-head">
                <strong>{actionLabel(entry.action)}</strong>
                <span className="muted">{when(entry.createdAt)}</span>
              </div>
              <div>
                {entry.actorId ? (
                  <Link to={`/admin/contas/${entry.actorId}`}>{actorLabel(entry)}</Link>
                ) : (
                  <span>{actorLabel(entry)}</span>
                )}
                {" · alvo "}
                {entry.targetType === "user" ? (
                  <Link to={`/admin/contas/${entry.targetId}`}>{entry.targetId}</Link>
                ) : (
                  <span>
                    {entry.targetType}: {entry.targetId}
                  </span>
                )}
              </div>
              {metadataLines(entry.metadata).map((line, index) => (
                <span className="admin-audit-meta" key={index}>
                  {line}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}

      {nextBefore ? (
        <button
          type="button"
          className="btn"
          onClick={() => void load(filters, nextBefore, true)}
          disabled={loading}
        >
          {loading ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </section>
  );
}
