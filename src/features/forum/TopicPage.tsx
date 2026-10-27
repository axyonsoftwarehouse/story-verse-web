import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../../App.css";
import "./forum.css";
import { useStoredSession } from "../auth/useStoredSession";
import { apiRequest } from "../../lib/backend";
import {
  acceptReply,
  createReply,
  deleteReply,
  deleteTopic,
  forumDate,
  getTopic,
  listReplies,
  mergeById,
  REPORT_REASONS,
  reportContent,
  SPOILER_LABELS,
  TOPIC_STATUS_LABELS,
  toggleBookmark,
  toggleReaction,
  type ForumReply,
  type ForumTopic,
  type SpoilerLevel,
} from "../../lib/forum";

/** Papéis que a API trata como equipe: podem aceitar resposta e publicam sem fila. */
const STAFF_ROLES = ["moderator", "support", "superadmin"];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar o tópico.";
}

export function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useStoredSession();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [revealedReplies, setRevealedReplies] = useState<Record<string, boolean>>({});
  const [staff, setStaff] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replySpoiler, setReplySpoiler] = useState<SpoilerLevel>("none");
  const [parent, setParent] = useState<ForumReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "topic" | "reply"; id: string } | null>(
    null,
  );
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([getTopic(session, id), listReplies(session, id)])
      .then(([loadedTopic, page]) => {
        if (!alive) return;
        setTopic(loadedTopic);
        setReplies(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, session]);

  // A API deixa a equipe aceitar resposta e publicar sem fila; a tela precisa saber disso
  // para oferecer o botão (antes só o autor via "Aceitar resposta").
  useEffect(() => {
    if (!session) {
      setStaff(false);
      return;
    }
    let alive = true;
    apiRequest<{ roles: string[] }>("/api/v1/auth/capabilities", {
      accessToken: session.access_token,
    })
      .then((result) => {
        if (alive) setStaff((result.roles ?? []).some((role) => STAFF_ROLES.includes(role)));
      })
      .catch(() => {
        if (alive) setStaff(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  function requireSession() {
    if (!session) {
      setNotice("Entre na sua conta para participar da comunidade.");
      return null;
    }
    return session;
  }

  async function loadMore() {
    if (!id || !nextCursor || more) return;
    setMore(true);
    try {
      const page = await listReplies(session, id, nextCursor);
      setReplies((current) => mergeById(current, page.items));
      setNextCursor(page.nextCursor);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setMore(false);
    }
  }

  async function likeTopic() {
    const current = requireSession();
    if (!current || !topic) return;
    try {
      const result = await toggleReaction(current, "topic", topic.id);
      setTopic({ ...topic, liked: result.liked, reaction_count: result.reactionCount });
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function bookmarkTopic() {
    const current = requireSession();
    if (!current || !topic) return;
    try {
      const result = await toggleBookmark(current, topic.id);
      setTopic({ ...topic, bookmarked: result.saved });
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function likeReply(reply: ForumReply) {
    const current = requireSession();
    if (!current) return;
    try {
      const result = await toggleReaction(current, "reply", reply.id);
      setReplies((list) =>
        list.map((item) =>
          item.id === reply.id
            ? { ...item, liked: result.liked, reaction_count: result.reactionCount }
            : item,
        ),
      );
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    const current = requireSession();
    if (!current || !id || !replyBody.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createReply(current, id, {
        body: replyBody,
        parentId: parent?.id ?? null,
        spoilerLevel: replySpoiler,
      });
      setReplyBody("");
      setReplySpoiler("none");
      setParent(null);
      // A resposta pode entrar em moderação: dizer "publicada" nesse caso some com o texto
      // da tela (a fila do tópico só mostra publicadas) e parece que a resposta se perdeu.
      if (created.status !== "published") {
        setNotice("Resposta enviada para análise.");
      } else if (nextCursor) {
        // Ainda há páginas antes dela: recarregar voltava para a 1ª página e a resposta sumia.
        setTopic((current) =>
          current ? { ...current, reply_count: current.reply_count + 1 } : current,
        );
        setNotice("Resposta publicada. Ela aparece no fim da conversa.");
      } else {
        setReplies((list) => mergeById(list, [created]));
        setTopic((current) =>
          current ? { ...current, reply_count: current.reply_count + 1 } : current,
        );
        setNotice("Resposta publicada.");
      }
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function accept(reply: ForumReply) {
    const current = requireSession();
    if (!current || !id) return;
    setBusy(true);
    try {
      const updated = await acceptReply(current, id, reply.id);
      setTopic(updated);
      setNotice("Resposta aceita.");
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeTopic() {
    const current = requireSession();
    if (!current || !id) return;
    if (!window.confirm("Remover este tópico? As respostas deixam de aparecer.")) return;
    try {
      await deleteTopic(current, id);
      navigate("/comunidade");
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function removeReply(reply: ForumReply) {
    const current = requireSession();
    if (!current) return;
    if (!window.confirm("Remover esta resposta?")) return;
    try {
      await deleteReply(current, reply.id);
      setReplies((list) => list.filter((item) => item.id !== reply.id));
      setTopic((value) =>
        value ? { ...value, reply_count: Math.max(0, value.reply_count - 1) } : value,
      );
      setNotice("Resposta removida.");
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    const current = requireSession();
    if (!current || !reportTarget) return;
    try {
      await reportContent(current, {
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reasonCode: reportReason,
        details: reportDetails,
      });
      setReportTarget(null);
      setReportDetails("");
      setNotice("Denúncia enviada para a moderação.");
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  function openReport(type: "topic" | "reply", targetId: string) {
    if (!requireSession()) return;
    setReportTarget((open) =>
      open?.type === type && open.id === targetId ? null : { type, id: targetId },
    );
  }

  function reportForm(type: "topic" | "reply", targetId: string) {
    if (reportTarget?.type !== type || reportTarget.id !== targetId) return null;
    return (
      <form className="profile-card forum-report" onSubmit={submitReport}>
        <label>
          Motivo
          <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
            {REPORT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Detalhes (opcional)
          <textarea
            value={reportDetails}
            onChange={(event) => setReportDetails(event.target.value)}
            rows={3}
            maxLength={1000}
          />
        </label>
        <div className="forum-form-actions">
          <button type="button" className="btn" onClick={() => setReportTarget(null)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Enviar denúncia
          </button>
        </div>
      </form>
    );
  }

  function parentLabel(reply: ForumReply): string | null {
    if (!reply.parent_id) return null;
    const found = replies.find((item) => item.id === reply.parent_id);
    return found ? found.author_name : null;
  }

  if (loading) {
    return (
      <div className="home">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/comunidade">
            Voltar
          </Link>
        </nav>
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando tópico…
        </div>
      </div>
    );
  }

  if (error && !topic) {
    return (
      <div className="home">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/comunidade">
            Voltar
          </Link>
        </nav>
        <p className="auth-error forum-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!topic) {
    return null;
  }

  const mine = session?.user.id === topic.author_id;
  const hidden = topic.spoiler_level !== "none" && !revealed;
  // reply_count é o total publicado; a lista pode ter só a primeira página.
  const replyTotal = Math.max(topic.reply_count, replies.length);

  return (
    <div className="home forum-topic-page">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/comunidade">
          Voltar
        </Link>
      </nav>

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

      <article className="shelf forum-topic-detail">
        <div className="forum-meta">
          <Link to={`/comunidade?space=${encodeURIComponent(topic.space_slug)}`}>
            {topic.space_name}
          </Link>
          <span>·</span>
          <span>{topic.author_name}</span>
          <span>·</span>
          <time dateTime={topic.created_at}>{forumDate(topic.created_at)}</time>
          {topic.status !== "published" ? (
            <span className="status-chip is-pending">
              {TOPIC_STATUS_LABELS[topic.status] ?? "Fora do ar"}
            </span>
          ) : null}
          {topic.is_pinned ? <span className="status-chip is-approved">Fixado</span> : null}
          {topic.is_locked ? <span className="status-chip">Fechado</span> : null}
          {topic.spoiler_level !== "none" ? (
            <span className="status-chip is-pending">{SPOILER_LABELS[topic.spoiler_level]}</span>
          ) : null}
        </div>
        <h1>{topic.title}</h1>
        {topic.book_key ? (
          <p className="forum-book-key">
            Livro: {topic.book_key}
            {topic.chapter_ref ? ` · ${topic.chapter_ref}` : ""}
          </p>
        ) : null}
        {hidden ? (
          <div className="forum-spoiler-gate">
            <strong>Este tópico contém spoiler.</strong>
            <p>O texto pode revelar partes da história.</p>
            <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
              Mostrar mesmo assim
            </button>
          </div>
        ) : (
          <p className="forum-body">{topic.body}</p>
        )}
        <div className="forum-actions">
          <button
            type="button"
            className={`btn ${topic.liked ? "is-on" : ""}`}
            aria-pressed={topic.liked}
            onClick={() => void likeTopic()}
          >
            {topic.liked ? "Curtido" : "Curtir"} ({topic.reaction_count})
          </button>
          <button type="button" className="btn" onClick={() => void bookmarkTopic()}>
            {topic.bookmarked ? "Salvo" : "Salvar"}
          </button>
          <button type="button" className="btn" onClick={() => openReport("topic", topic.id)}>
            Denunciar
          </button>
          {mine || staff ? (
            <button type="button" className="btn forum-danger" onClick={() => void removeTopic()}>
              Remover tópico
            </button>
          ) : null}
        </div>
        {reportForm("topic", topic.id)}
      </article>

      <section className="shelf">
        <div className="shelf-head">
          <h2>
            {replyTotal} {replyTotal === 1 ? "resposta" : "respostas"}
          </h2>
        </div>
        {replies.length === 0 ? (
          <p className="profile-empty">Nenhuma resposta ainda. Comece a conversa.</p>
        ) : (
          <div className="forum-replies">
            {replies.map((reply) => {
              const parentName = parentLabel(reply);
              const accepted = topic.accepted_reply_id === reply.id;
              // Uma API anterior a V21 não manda spoiler_level: sem o campo, a resposta
              // aparece normal (não pode virar bloqueio para todo mundo).
              const spoiler =
                reply.spoiler_level && reply.spoiler_level !== "none" ? reply.spoiler_level : null;
              return (
                <article
                  className={`profile-card forum-reply ${accepted ? "is-accepted" : ""}`}
                  key={reply.id}
                >
                  <div className="forum-meta">
                    <strong>{reply.author_name}</strong>
                    <span>·</span>
                    <time dateTime={reply.created_at}>{forumDate(reply.created_at)}</time>
                    {accepted ? (
                      <span className="status-chip is-approved">Resposta aceita</span>
                    ) : null}
                    {spoiler ? (
                      <span className="status-chip is-pending">{SPOILER_LABELS[spoiler]}</span>
                    ) : null}
                  </div>
                  {parentName ? (
                    <p className="forum-reply-parent">Em resposta a {parentName}</p>
                  ) : null}
                  {spoiler && !revealedReplies[reply.id] ? (
                    <div className="forum-spoiler-gate">
                      <strong>Esta resposta contém spoiler.</strong>
                      <p>O texto pode revelar partes da história.</p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setRevealedReplies((atual) => ({ ...atual, [reply.id]: true }))
                        }
                      >
                        Mostrar mesmo assim
                      </button>
                    </div>
                  ) : (
                    <p className="forum-body">{reply.body}</p>
                  )}
                  <div className="forum-actions">
                    <button
                      type="button"
                      className={`btn ${reply.liked ? "is-on" : ""}`}
                      aria-pressed={reply.liked}
                      onClick={() => void likeReply(reply)}
                    >
                      {reply.liked ? "Curtido" : "Curtir"} ({reply.reaction_count})
                    </button>
                    {session && !topic.is_locked ? (
                      <button type="button" className="btn" onClick={() => setParent(reply)}>
                        Responder
                      </button>
                    ) : null}
                    {(mine || staff) && !accepted && reply.status === "published" ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void accept(reply)}
                      >
                        Aceitar resposta
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openReport("reply", reply.id)}
                    >
                      Denunciar
                    </button>
                    {/* A API só deixa o autor da resposta ou a equipe remover. */}
                    {session?.user.id === reply.author_id || staff ? (
                      <button
                        type="button"
                        className="btn forum-danger"
                        onClick={() => void removeReply(reply)}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  {reportForm("reply", reply.id)}
                </article>
              );
            })}
          </div>
        )}
        {nextCursor ? (
          <div className="forum-more">
            <button type="button" className="btn" onClick={() => void loadMore()} disabled={more}>
              {more ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="shelf">
        <div className="shelf-head">
          <h2>Responder</h2>
        </div>
        {!session ? (
          <div className="profile-card forum-login">
            <p>Entre na sua conta para responder e denunciar.</p>
            <Link className="btn btn-primary" to="/">
              Entrar
            </Link>
          </div>
        ) : topic.is_locked ? (
          <p className="profile-empty">Este tópico está fechado para novas respostas.</p>
        ) : (
          <form className="profile-card forum-composer" onSubmit={submitReply}>
            {parent ? (
              <div className="forum-reply-target">
                Respondendo a <strong>{parent.author_name}</strong>
                <button type="button" className="btn" onClick={() => setParent(null)}>
                  Cancelar
                </button>
              </div>
            ) : null}
            <label>
              Sua resposta
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                rows={5}
                maxLength={20000}
                required
              />
            </label>
            <label>
              Spoiler
              <select
                value={replySpoiler}
                onChange={(event) => setReplySpoiler(event.target.value as SpoilerLevel)}
              >
                {(Object.keys(SPOILER_LABELS) as SpoilerLevel[]).map((level) => (
                  <option key={level} value={level}>
                    {SPOILER_LABELS[level]}
                  </option>
                ))}
              </select>
            </label>
            {staff ? (
              <p className="forum-hint">
                Sua resposta é publicada na hora: a equipe não passa pela fila de moderação.
              </p>
            ) : null}
            <div className="forum-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !replyBody.trim()}
              >
                {busy ? "Publicando…" : "Publicar resposta"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
