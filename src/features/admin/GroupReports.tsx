import { useEffect, useState } from "react";
import "../forum/forum.css";
import "../groups/groups.css";
import { forumDate } from "../../lib/forum";
import { adminGroupReports, REPORT_REASONS, resolveGroupReport, type GroupReport } from "../../lib/groups";

const FILTERS = [
  { value: "pending", label: "Pendentes" },
  { value: "actioned", label: "Resolvidas" },
  { value: "dismissed", label: "Ignoradas" },
  { value: "", label: "Todas" },
];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar as denúncias.";
}

function reasonLabel(code: string): string {
  return REPORT_REASONS.find((r) => r.value === code)?.label ?? code;
}

/** Denúncias de mensagens dos grupos. Resolver vale para todas as denúncias da mesma mensagem. */
export function GroupReports({ canModerate }: { canModerate: boolean }) {
  const [status, setStatus] = useState("pending");
  const [reports, setReports] = useState<GroupReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    adminGroupReports(status || undefined)
      .then((list) => alive && setReports(list))
      .catch((err: unknown) => alive && setError(message(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status, reload]);

  async function resolve(report: GroupReport, outcome: "actioned" | "dismissed", deleteMessage: boolean) {
    setError("");
    setNotice("");
    try {
      await resolveGroupReport(report.id, outcome, deleteMessage);
      setNotice(deleteMessage ? "Mensagem apagada e denúncias resolvidas." : outcome === "dismissed" ? "Denúncias ignoradas." : "Denúncias resolvidas.");
      setReload((n) => n + 1);
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <section className="shelf forum-admin">
      <div className="shelf-head">
        <h2>Denúncias nos grupos</h2>
      </div>
      <p className="forum-intro">
        Com 3 denúncias pendentes de pessoas diferentes, a mensagem some para os outros membros até alguém revisar.
      </p>
      <div className="forum-admin-filter">
        <label>
          Mostrar
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {!canModerate ? <span>Somente leitura para o seu papel.</span> : null}
      </div>
      {notice ? (
        <p className="auth-global-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error forum-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando…
        </div>
      ) : reports.length === 0 ? (
        <p className="profile-empty">Nada nesta fila.</p>
      ) : (
        <div className="forum-admin-list">
          {reports.map((r) => (
            <article className="profile-card forum-admin-item" key={r.id}>
              <div className="forum-meta">
                <span className="status-chip is-pending">{reasonLabel(r.reason_code)}</span>
                <span>
                  Grupo <strong>{r.group_name}</strong>
                </span>
                <span>{forumDate(r.created_at)}</span>
                {Number(r.pending_reports) > 1 ? <span>{r.pending_reports} denúncias pendentes</span> : null}
              </div>
              <p className="forum-excerpt">
                <strong>{r.author_name}:</strong> {r.body}
                {r.message_deleted_at ? <em> (já apagada)</em> : null}
              </p>
              <p className="group-card-sub">
                Denunciada por {r.reporter_name}
                {r.details ? `: “${r.details}”` : ""}
              </p>
              {canModerate && r.status === "pending" ? (
                <div className="forum-actions">
                  {!r.message_deleted_at ? (
                    <button type="button" className="btn btn-primary" onClick={() => void resolve(r, "actioned", true)}>
                      Apagar mensagem
                    </button>
                  ) : null}
                  <button type="button" className="btn" onClick={() => void resolve(r, "actioned", false)}>
                    Resolver sem apagar
                  </button>
                  <button type="button" className="btn" onClick={() => void resolve(r, "dismissed", false)}>
                    Ignorar
                  </button>
                </div>
              ) : (
                <p className="group-card-sub">Situação: {r.status === "actioned" ? "resolvida" : r.status === "dismissed" ? "ignorada" : "pendente"}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
