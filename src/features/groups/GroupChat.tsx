import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../../App.css";
import "./groups.css";
import { useConfirm } from "../../components/ConfirmDialog";
import { useStoredSession } from "../auth/useStoredSession";
import {
  applyReaction,
  deleteMessage,
  getGroup,
  GROUP_EMOJIS,
  joinGroup,
  listMessages,
  markRead,
  MESSAGE_MAX,
  mergeMessages,
  messageTime,
  newClientId,
  notifyGroupMessage,
  openGroupStream,
  react,
  REPORT_REASONS,
  reportMessage,
  sendMessage,
  type Group,
  type GroupMessage,
} from "../../lib/groups";
import { GroupInfo } from "./GroupInfo";
import { GroupsBlocked, PersonFace } from "./GroupParts";
import { myChapter, useGroupsGate } from "./groupHelpers";

const PAGE = 50;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

/** Conversa de um grupo: histórico, envio, reações, respostas, spoiler e denúncia. */
export function GroupChat() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useStoredSession();
  const gate = useGroupsGate(session, sessionLoading);
  const me = session?.user.id ?? "";
  const { confirm, dialog } = useConfirm();

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [spoiler, setSpoiler] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [reporting, setReporting] = useState<GroupMessage | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastReadSent = useRef(0);
  const messagesRef = useRef<GroupMessage[]>([]);
  messagesRef.current = messages;
  const groupRef = useRef<Group | null>(null);
  groupRef.current = group;

  const isMember = Boolean(group?.is_member);
  const chapter = myChapter(group?.book_key ?? null);

  const reloadGroup = useCallback(async () => {
    try {
      setGroup(await getGroup(id));
    } catch (err) {
      setError(message(err));
    }
  }, [id]);

  /** Marca como lido até a última mensagem confirmada (só com a tela visível). */
  const sendRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const last = [...messagesRef.current].reverse().find((m) => !m.pending && !m.failed);
    if (!last || last.id <= lastReadSent.current) return;
    lastReadSent.current = last.id;
    void markRead(id, last.id).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!gate.ready) return;
    setGroup(null);
    setMessages([]);
    setError("");
    void reloadGroup();
  }, [gate.ready, reloadGroup]);

  useEffect(() => {
    if (!gate.ready || !isMember) return;
    let alive = true;
    stickToBottom.current = true;
    listMessages(id, { limit: PAGE })
      .then((list) => {
        if (!alive) return;
        setMessages(list);
        setHasMore(list.length === PAGE);
      })
      .catch((err: unknown) => alive && setError(message(err)));

    const close = openGroupStream(
      (event) => {
        if (event.type === "message" && event.data.group_id === id) {
          setMessages((cur) => mergeMessages(cur, [event.data]));
          const g = groupRef.current;
          if (g && event.data.author_id !== me) notifyGroupMessage(event.data, g.name, g.muted);
        } else if (event.type === "message_deleted" && event.data.groupId === id) {
          setMessages((cur) => cur.map((m) => (m.id === event.data.id ? { ...m, deleted: true, body: null } : m)));
        } else if (event.type === "reaction" && event.data.groupId === id) {
          const { messageId, emoji, added, userId } = event.data;
          // A minha reação já foi aplicada na hora do clique.
          if (userId === me) return;
          setMessages((cur) => cur.map((m) => (m.id === messageId ? applyReaction(m, emoji, added, false) : m)));
        } else if (event.type === "group" && event.data.groupId === id) {
          if (event.data.type === "deleted") {
            navigate("/grupos", { replace: true });
            return;
          }
          void reloadGroup();
        }
      },
      () => {
        // Voltou a conexão: busca o que chegou enquanto estava fora.
        const last = [...messagesRef.current].reverse().find((m) => !m.pending && !m.failed);
        if (last) void listMessages(id, { after: last.id, limit: 100 }).then((list) => setMessages((cur) => mergeMessages(cur, list)));
      },
    );
    const onVisible = () => sendRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [gate.ready, isMember, id, me, navigate, reloadGroup, sendRead]);

  // Mensagem nova: desce até ela se a pessoa já estava no fim da conversa.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    sendRead();
  }, [messages, sendRead]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlder() {
    const first = messages.find((m) => !m.pending && !m.failed);
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    try {
      const older = await listMessages(id, { before: first.id, limit: PAGE });
      stickToBottom.current = false;
      setMessages((cur) => mergeMessages(older, cur));
      setHasMore(older.length === PAGE);
      // Mantém a mesma mensagem na tela depois de inserir as antigas acima.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch (err) {
      setError(message(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function deliver(draft: GroupMessage) {
    try {
      const saved = await sendMessage(id, {
        body: draft.body ?? "",
        clientId: draft.client_id!,
        spoilerChapter: draft.spoiler_chapter,
        replyTo: draft.reply_to,
      });
      setMessages((cur) => mergeMessages(cur, [saved]));
    } catch (err) {
      setMessages((cur) => cur.map((m) => (m.client_id === draft.client_id && m.pending ? { ...m, pending: false, failed: true } : m)));
      setError(message(err));
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !session) return;
    const draft: GroupMessage = {
      id: Number.MAX_SAFE_INTEGER,
      group_id: id,
      author_id: me,
      author_name: String(session.user.user_metadata?.name ?? "Você"),
      author_avatar: String(session.user.user_metadata?.avatar ?? ""),
      body: text,
      spoiler_chapter: spoiler ? Number(spoiler) : null,
      reply_to: replyTo?.id ?? null,
      client_id: newClientId(),
      created_at: new Date().toISOString(),
      deleted: false,
      hidden: false,
      reactions: [],
      pending: true,
    };
    stickToBottom.current = true;
    setMessages((cur) => [...cur, draft]);
    setInput("");
    setSpoiler("");
    setReplyTo(null);
    setError("");
    void deliver(draft);
  }

  function retry(m: GroupMessage) {
    const again = { ...m, failed: false, pending: true };
    setMessages((cur) => cur.map((x) => (x.client_id === m.client_id && x.failed ? again : x)));
    void deliver(again);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra a linha.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  async function toggleReaction(m: GroupMessage, emoji: string) {
    setMenuFor(null);
    const mine = m.reactions.some((r) => r.emoji === emoji && r.mine);
    setMessages((cur) => cur.map((x) => (x.id === m.id ? applyReaction(x, emoji, !mine, true) : x)));
    try {
      const reactions = await react(m.id, emoji, !mine);
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, reactions } : x)));
    } catch (err) {
      setMessages((cur) => cur.map((x) => (x.id === m.id ? applyReaction(x, emoji, mine, true) : x)));
      setError(message(err));
    }
  }

  async function remove(m: GroupMessage) {
    setMenuFor(null);
    if (!(await confirm({ title: "Apagar esta mensagem?", message: "Ela some para todos do grupo.", confirmLabel: "Apagar", danger: true }))) return;
    try {
      await deleteMessage(m.id);
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null } : x)));
    } catch (err) {
      setError(message(err));
    }
  }

  async function join() {
    try {
      setGroup(await joinGroup(id));
    } catch (err) {
      setError(message(err));
    }
  }

  if (!gate.ready) return <GroupsBlocked text={gate.blocked} />;

  const manager = group?.my_role === "owner" || group?.my_role === "moderator";
  const byId = new Map(messages.map((m) => [m.id, m]));

  return (
    <div className="home groups-page group-chat-page">
      <nav className="home-nav profile-nav group-chat-nav">
        <Link className="btn" to="/grupos">
          Voltar
        </Link>
        {group ? (
          <button type="button" className="group-chat-title" onClick={() => setInfoOpen(true)} aria-label={`Ver detalhes de ${group.name}`}>
            <strong>{group.name}</strong>
            <small>
              {group.book_title ? `📖 ${group.book_title} · ` : ""}
              {group.member_count} {Number(group.member_count) === 1 ? "membro" : "membros"}
            </small>
          </button>
        ) : (
          <span className="wordmark">Grupo</span>
        )}
        {group ? (
          <button type="button" className="btn" onClick={() => setInfoOpen(true)}>
            Detalhes
          </button>
        ) : null}
      </nav>

      {error ? (
        <p className="auth-error forum-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="auth-global-notice" role="status">
          {notice}
        </p>
      ) : null}

      {!group ? (
        error ? null : (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando…
          </div>
        )
      ) : !isMember ? (
        <section className="shelf group-preview">
          <h1>{group.name}</h1>
          {group.description ? <p className="forum-intro">{group.description}</p> : null}
          {group.book_title ? <p>📖 Clube de leitura de “{group.book_title}”</p> : null}
          <p className="group-card-sub">
            {group.member_count} {Number(group.member_count) === 1 ? "membro" : "membros"}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void join()}>
            Entrar no grupo
          </button>
        </section>
      ) : (
        <>
          {group.book_title && group.goal_chapter ? (
            <p className="group-goal-banner">
              🎯 Meta: até o capítulo {group.goal_chapter}
              {group.goal_until ? ` até ${new Date(`${group.goal_until}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}` : ""}
              {chapter ? ` · você está no capítulo ${chapter}` : ""}
            </p>
          ) : null}
          <div className="group-messages" ref={listRef} onScroll={onScroll} aria-live="polite">
            {hasMore ? (
              <button type="button" className="btn group-older" onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? "Carregando…" : "Carregar mensagens anteriores"}
              </button>
            ) : messages.length === 0 ? (
              <p className="profile-empty">Nenhuma mensagem ainda. Diga oi! 👋</p>
            ) : null}
            {messages.map((m, i) => {
              const mine = m.author_id === me;
              const prev = messages[i - 1];
              const grouped = prev && prev.author_id === m.author_id && !prev.deleted;
              const spoilerHidden = m.spoiler_chapter !== null && !mine && chapter <= m.spoiler_chapter && !revealed.has(m.id);
              const parent = m.reply_to ? byId.get(m.reply_to) : undefined;
              return (
                <div key={m.pending || m.failed ? m.client_id : m.id} className={`group-msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""}`}>
                  {!mine && !grouped ? <PersonFace name={m.author_name} avatar={m.author_avatar} size="sm" /> : <span className="group-face-gap" />}
                  <div className="group-bubble-wrap">
                    {!mine && !grouped ? <span className="group-author">{m.author_name}</span> : null}
                    <div className={`group-bubble ${m.deleted || m.hidden ? "is-muted" : ""}`}>
                      {parent ? (
                        <span className="group-quote">
                          <strong>{parent.author_name}</strong> {parent.deleted ? "mensagem apagada" : parent.spoiler_chapter ? "🙈 spoiler" : parent.body?.slice(0, 80)}
                        </span>
                      ) : null}
                      {m.deleted ? (
                        <em>Mensagem apagada</em>
                      ) : m.hidden ? (
                        <em>Mensagem oculta por denúncias, aguardando a moderação.</em>
                      ) : spoilerHidden ? (
                        <button type="button" className="group-spoiler" onClick={() => setRevealed((s) => new Set(s).add(m.id))}>
                          🙈 Spoiler até o capítulo {m.spoiler_chapter}. Toque para ver.
                        </button>
                      ) : (
                        <>
                          {m.spoiler_chapter ? <span className="group-spoiler-tag">Spoiler · cap. {m.spoiler_chapter}</span> : null}
                          <span className="group-text">{m.body}</span>
                        </>
                      )}
                      <span className="group-meta">
                        {m.failed ? (
                          <button type="button" className="link-btn" onClick={() => retry(m)}>
                            Não enviada. Tentar de novo
                          </button>
                        ) : m.pending ? (
                          "enviando…"
                        ) : (
                          messageTime(m.created_at)
                        )}
                      </span>
                    </div>
                    {m.reactions.length > 0 ? (
                      <span className="group-reactions">
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            className={`group-reaction ${r.mine ? "is-mine" : ""}`}
                            onClick={() => void toggleReaction(m, r.emoji)}
                            aria-label={`${r.emoji} ${r.count}${r.mine ? ", você reagiu" : ""}`}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  {!m.pending && !m.failed && !m.deleted ? (
                    <div className="group-msg-actions">
                      <button
                        type="button"
                        className="icon-btn group-more"
                        aria-label="Ações da mensagem"
                        aria-expanded={menuFor === m.id}
                        onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      >
                        ⋯
                      </button>
                      {menuFor === m.id ? (
                        <div className="group-menu-backdrop" onClick={() => setMenuFor(null)} aria-hidden="true" />
                      ) : null}
                      {menuFor === m.id ? (
                        <div className="group-menu" role="menu" aria-label={`Ações da mensagem de ${m.author_name}`}>
                          <div className="group-menu-emojis">
                            {GROUP_EMOJIS.map((emoji) => (
                              <button key={emoji} type="button" role="menuitem" onClick={() => void toggleReaction(m, emoji)} aria-label={`Reagir com ${emoji}`}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setReplyTo(m);
                              setMenuFor(null);
                            }}
                          >
                            Responder
                          </button>
                          {mine || manager ? (
                            <button type="button" role="menuitem" className="is-danger" onClick={() => void remove(m)}>
                              Apagar
                            </button>
                          ) : null}
                          {!mine ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setReporting(m);
                                setMenuFor(null);
                              }}
                            >
                              Denunciar
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <form className="group-composer" onSubmit={submit}>
            {replyTo ? (
              <div className="group-replying">
                <span>
                  Respondendo a <strong>{replyTo.author_name}</strong>: {replyTo.spoiler_chapter ? "🙈 spoiler" : replyTo.body?.slice(0, 60)}
                </span>
                <button type="button" className="link-btn" onClick={() => setReplyTo(null)}>
                  Cancelar
                </button>
              </div>
            ) : null}
            <div className="group-composer-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escreva uma mensagem"
                aria-label="Mensagem"
                maxLength={MESSAGE_MAX}
                rows={1}
              />
              <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
                Enviar
              </button>
            </div>
            {group.book_key ? (
              <label className="group-spoiler-pick">
                Spoiler até o capítulo
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={spoiler}
                  onChange={(e) => setSpoiler(e.target.value)}
                  placeholder="—"
                  aria-describedby="spoiler-help"
                />
                <small id="spoiler-help">Quem ainda não passou desse capítulo vê a mensagem borrada.</small>
              </label>
            ) : null}
          </form>
        </>
      )}

      {reporting ? (
        <ReportDialog
          message={reporting}
          onClose={() => setReporting(null)}
          onSent={() => {
            setReporting(null);
            setNotice("Denúncia enviada. Obrigado por avisar.");
          }}
        />
      ) : null}

      {infoOpen && group ? (
        <GroupInfo
          group={group}
          me={me}
          confirm={confirm}
          onClose={() => setInfoOpen(false)}
          onChanged={(g) => setGroup(g)}
          onLeft={() => navigate("/grupos", { replace: true })}
        />
      ) : null}
      {dialog}
    </div>
  );
}

function ReportDialog({ message: target, onClose, onSent }: { message: GroupMessage; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await reportMessage(target.id, reason, details.trim() || undefined);
      onSent();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="auth-card shelf-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={send}>
        <h2 id="report-title">Denunciar mensagem</h2>
        <p className="group-card-sub">
          De {target.author_name}. A equipe de moderação vai analisar.
        </p>
        <label>
          Motivo
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Detalhes (opcional)
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="shelf-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Enviar denúncia
          </button>
        </div>
      </form>
    </div>
  );
}
