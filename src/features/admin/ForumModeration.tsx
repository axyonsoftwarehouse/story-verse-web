import { useEffect, useState } from "react";
import "../forum/forum.css";
import { forumDate, REPORT_REASONS } from "../../lib/forum";
import type { SupabaseSession } from "../../lib/auth";
import {
  listReplies,
  listReports,
  listTopics,
  moderateReply,
  moderateTopic,
  resolveReport,
  type AdminForumReply,
  type AdminForumReport,
  type AdminForumTopic,
} from "../../lib/adminForum";

type Tab = "reports" | "topics" | "replies";

const TABS: { value: Tab; label: string }[] = [
  { value: "reports", label: "Denúncias" },
  { value: "topics", label: "Tópicos" },
  { value: "replies", label: "Respostas" },
];

const FILTERS: Record<Tab, { value: string; label: string }[]> = {
  reports: [
    { value: "pending", label: "Pendentes" },
    { value: "actioned", label: "Resolvidas" },
    { value: "dismissed", label: "Ignoradas" },
    { value: "", label: "Todas" },
  ],
  topics: [
    { value: "pending", label: "Pendentes" },
    { value: "published", label: "Publicados" },
    { value: "hidden", label: "Ocultos" },
    { value: "", label: "Todos" },
  ],
  replies: [
    { value: "pending", label: "Pendentes" },
    { value: "published", label: "Publicadas" },
    { value: "hidden", label: "Ocultas" },
    { value: "", label: "Todas" },
  ],
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a moderação.";
}

function reasonLabel(code: string): string {
  return REPORT_REASONS.find((reason) => reason.value === code)?.label ?? code;
}

export function ForumModeration({
  session,
  canModerate,
}: {
  session: SupabaseSession;
  canModerate: boolean;
}) {
  const [tab, setTab] = useState<Tab>("reports");
  const [status, setStatus] = useState("pending");
  const [reports, setReports] = useState<AdminForumReport[]>([]);
  const [topics, setTopics] = useState<AdminForumTopic[]>([]);
  const [replies, setReplies] = useState<AdminForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const request =
      tab === "reports"
        ? listReports(session, status || null).then((rows) => {
            if (alive) setReports(rows);
          })
        : tab === "topics"
          ? listTopics(session, status || null).then((rows) => {
              if (alive) setTopics(rows);
            })
          : listReplies(session, status || null).then((rows) => {
              if (alive) setReplies(rows);
            });
    request
      .catch((err: unknown) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, tab, status]);

  function changeTab(next: Tab) {
    setTab(next);
    setStatus("pending");
    setNotice("");
  }

  async function act(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setError("");
    try {
      await action();
      setNotice(success);
      const rows =
        tab === "reports"
          ? await listReports(session, status || null)
          : tab === "topics"
            ? await listTopics(session, status || null)
            : await listReplies(session, status || null);
      if (tab === "reports") setReports(rows as AdminForumReport[]);
      else if (tab === "topics") setTopics(rows as AdminForumTopic[]);
      else setReplies(rows as AdminForumReply[]);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = tab === "reports" ? reports : tab === "topics" ? topics : replies;

  return (
    <section className="shelf forum-admin">
      <div className="shelf-head">
        <h2>Moderação do fórum</h2>
      </div>

      <div className="forum-admin-tabs" role="tablist" aria-label="Moderação do fórum">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`btn ${tab === item.value ? "is-on" : ""}`}
            onClick={() => changeTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="forum-admin-filter">
        <label>
          Mostrar
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {FILTERS[tab].map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
      ) : list.length === 0 ? (
        <p className="profile-empty">Nada nesta fila.</p>
      ) : (
        <div className="forum-admin-list">
          {tab === "reports"
            ? reports.map((report) => (
                <article className="profile-card forum-admin-item" key={report.id}>
                  <div className="forum-meta">
                    <span className="status-chip is-pending">{reasonLabel(report.reason_code)}</span>
                    <span>{report.target_type === "topic" ? "Tópico" : "Resposta"}</span>
                    <span>·</span>
                    <span>{report.reporter_name}</span>
                    <span>·</span>
                    <time dateTime={report.created_at}>{forumDate(report.created_at)}</time>
                  </div>
                  <strong>{report.target_excerpt || report.target_id}</strong>
                  {report.details ? <p className="forum-excerpt">{report.details}</p> : null}
                  <div className="forum-actions">
                    {canModerate && report.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyId === report.id}
                          onClick={() =>
                            void act(
                              report.id,
                              () => resolveReport(session, report.id, "actioned"),
                              "Denúncia marcada como resolvida.",
                            )
                          }
                        >
                          Resolver
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busyId === report.id}
                          onClick={() =>
                            void act(
                              report.id,
                              () => resolveReport(session, report.id, "dismissed"),
                              "Denúncia ignorada.",
                            )
                          }
                        >
                          Ignorar
                        </button>
                      </>
                    ) : (
                      <span className="forum-meta">Situação: {report.status}</span>
                    )}
                  </div>
                </article>
              ))
            : null}

          {tab === "topics"
            ? topics.map((topic) => (
                <article className="profile-card forum-admin-item" key={topic.id}>
                  <div className="forum-meta">
                    <span className="status-chip is-pending">{topic.status}</span>
                    <span>{topic.space_name}</span>
                    <span>·</span>
                    <span>{topic.author_name}</span>
                    <span>·</span>
                    <time dateTime={topic.created_at}>{forumDate(topic.created_at)}</time>
                    {topic.spoiler_level !== "none" ? <span className="status-chip">Spoiler</span> : null}
                  </div>
                  <strong>{topic.title}</strong>
                  <p className="forum-excerpt">{topic.excerpt}</p>
                  <div className="forum-actions">
                    {canModerate ? (
                      <>
                        {topic.status !== "published" ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busyId === topic.id}
                            onClick={() =>
                              void act(
                                topic.id,
                                () => moderateTopic(session, topic.id, { status: "published" }),
                                "Tópico publicado.",
                              )
                            }
                          >
                            Publicar
                          </button>
                        ) : null}
                        {topic.status !== "hidden" ? (
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId === topic.id}
                            onClick={() =>
                              void act(
                                topic.id,
                                () => moderateTopic(session, topic.id, { status: "hidden" }),
                                "Tópico ocultado.",
                              )
                            }
                          >
                            Ocultar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn"
                          disabled={busyId === topic.id}
                          onClick={() =>
                            void act(
                              topic.id,
                              () =>
                                moderateTopic(session, topic.id, { pinned: !topic.is_pinned }),
                              topic.is_pinned ? "Tópico desafixado." : "Tópico fixado.",
                            )
                          }
                        >
                          {topic.is_pinned ? "Desafixar" : "Fixar"}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busyId === topic.id}
                          onClick={() =>
                            void act(
                              topic.id,
                              () =>
                                moderateTopic(session, topic.id, { locked: !topic.is_locked }),
                              topic.is_locked ? "Tópico reaberto." : "Tópico fechado.",
                            )
                          }
                        >
                          {topic.is_locked ? "Reabrir" : "Fechar"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            : null}

          {tab === "replies"
            ? replies.map((reply) => (
                <article className="profile-card forum-admin-item" key={reply.id}>
                  <div className="forum-meta">
                    <span className="status-chip is-pending">{reply.status}</span>
                    <span>{reply.topic_title}</span>
                    <span>·</span>
                    <span>{reply.author_name}</span>
                    <span>·</span>
                    <time dateTime={reply.created_at}>{forumDate(reply.created_at)}</time>
                  </div>
                  <p className="forum-excerpt">{reply.excerpt}</p>
                  <div className="forum-actions">
                    {canModerate && reply.status !== "published" ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === reply.id}
                        onClick={() =>
                          void act(
                            reply.id,
                            () => moderateReply(session, reply.id, "published"),
                            "Resposta publicada.",
                          )
                        }
                      >
                        Publicar
                      </button>
                    ) : null}
                    {canModerate && reply.status !== "hidden" ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === reply.id}
                        onClick={() =>
                          void act(
                            reply.id,
                            () => moderateReply(session, reply.id, "hidden"),
                            "Resposta ocultada.",
                          )
                        }
                      >
                        Ocultar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            : null}
        </div>
      )}
    </section>
  );
}
