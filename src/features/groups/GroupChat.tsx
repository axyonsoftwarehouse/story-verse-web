import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
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
import { GroupAvatar, GroupsBlocked, PersonFace } from "./GroupParts";
import { GIcon } from "./groupIcons";
import { dayLabel, hueOf, myChapter, useGroupsGate } from "./groupHelpers";

const PAGE = 50;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(" de ", " ").replace(".", "");

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
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [spoilerOn, setSpoilerOn] = useState(false);
  const [spoiler, setSpoiler] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [menuFor, setMenuFor] = useState<GroupMessage | null>(null);
  const [reporting, setReporting] = useState<GroupMessage | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    setLoaded(false);
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
        setLoaded(true);
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

  // A caixa de texto cresce com a mensagem (até umas 6 linhas).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [input]);

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
      spoiler_chapter: spoilerOn && spoiler ? Number(spoiler) : null,
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
    setSpoilerOn(false);
    setReplyTo(null);
    setError("");
    void deliver(draft);
    inputRef.current?.focus();
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
  const members = Number(group?.member_count ?? 0);

  return (
    <div className="group-chat-page">
      <header className="group-chat-header">
        <Link className="group-icon-btn" to="/grupos" aria-label="Voltar para os grupos">
          {GIcon.back}
        </Link>
        {group ? (
          <button type="button" className="group-chat-title" onClick={() => setInfoOpen(true)} aria-label={`Ver detalhes de ${group.name}`}>
            <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="sm" />
            <span className="group-chat-title-text">
              <strong>{group.name}</strong>
              <small>
                {group.book_title ? `${group.book_title} · ` : ""}
                {members} {members === 1 ? "membro" : "membros"}
              </small>
            </span>
          </button>
        ) : (
          <span className="group-chat-title" />
        )}
        {group ? (
          <button type="button" className="group-icon-btn" onClick={() => setInfoOpen(true)} aria-label="Detalhes do grupo">
            {GIcon.info}
          </button>
        ) : null}
      </header>

      {group?.is_member && group.book_title && group.goal_chapter ? (
        <div className="group-goal-strip">
          <span>
            🎯 Meta: capítulo {group.goal_chapter}
            {group.goal_until ? ` até ${shortDate(group.goal_until)}` : ""}
          </span>
          {chapter ? (
            <span className={`group-goal-me ${chapter >= group.goal_chapter ? "is-done" : ""}`}>
              {chapter >= group.goal_chapter ? "✓ você chegou lá" : `você está no cap. ${chapter}`}
            </span>
          ) : null}
        </div>
      ) : null}

      {error || notice ? (
        <div className="group-chat-alerts">
          {error ? (
            <p className="group-toast is-error" role="alert">
              {error}
              <button type="button" className="group-icon-btn" aria-label="Fechar aviso" onClick={() => setError("")}>
                {GIcon.close}
              </button>
            </p>
          ) : null}
          {notice ? (
            <p className="group-toast" role="status">
              {notice}
              <button type="button" className="group-icon-btn" aria-label="Fechar aviso" onClick={() => setNotice("")}>
                {GIcon.close}
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {!group ? (
        <div className="group-chat-body">
          {error ? null : (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              Carregando…
            </div>
          )}
        </div>
      ) : !isMember ? (
        <div className="group-chat-body">
          <section className="group-preview">
            <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="xl" />
            <h1>{group.name}</h1>
            <p className="group-preview-meta">
              {group.visibility === "public" ? "Grupo público" : "Grupo privado"} · {members} {members === 1 ? "membro" : "membros"}
            </p>
            {group.description ? <p className="group-preview-desc">{group.description}</p> : null}
            {group.book_title ? (
              <p className="group-preview-book">
                {GIcon.book} Clube de leitura de “{group.book_title}”
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void join()}>
              Entrar no grupo
            </button>
          </section>
        </div>
      ) : (
        <>
          <div className="group-chat-body" ref={listRef} onScroll={onScroll}>
            <div className="group-messages" aria-live="polite">
              {hasMore ? (
                <button type="button" className="group-older" onClick={() => void loadOlder()} disabled={loadingOlder}>
                  {loadingOlder ? "Carregando…" : "Mensagens anteriores"}
                </button>
              ) : loaded ? (
                <div className="group-chat-start">
                  <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="lg" />
                  <strong>{group.name}</strong>
                  <span>{group.description ?? "Este é o começo da conversa."}</span>
                </div>
              ) : null}
              {messages.map((m, i) => {
                const mine = m.author_id === me;
                const prev = messages[i - 1];
                const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                const grouped = !newDay && prev && prev.author_id === m.author_id && !prev.deleted;
                const spoilerHidden = m.spoiler_chapter !== null && !mine && chapter <= m.spoiler_chapter && !revealed.has(m.id);
                const parent = m.reply_to ? byId.get(m.reply_to) : undefined;
                const canAct = !m.pending && !m.failed && !m.deleted;
                return (
                  <div key={m.pending || m.failed ? m.client_id : m.id}>
                    {newDay ? (
                      <div className="group-day">
                        <span>{dayLabel(m.created_at)}</span>
                      </div>
                    ) : null}
                    <div className={`group-msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""}`}>
                      {!mine ? grouped ? <span className="group-face-gap" /> : <PersonFace id={m.author_id} name={m.author_name} avatar={m.author_avatar} size="sm" /> : null}
                      <div className="group-bubble-wrap">
                        <div
                          className={`group-bubble ${m.deleted || m.hidden ? "is-muted" : ""} ${m.pending ? "is-pending" : ""}`}
                          onDoubleClick={() => canAct && void toggleReaction(m, "❤️")}
                        >
                          {!mine && !grouped ? (
                            <span className="group-author" style={{ color: `hsl(${hueOf(m.author_id)} 55% 70%)` }}>
                              {m.author_name}
                            </span>
                          ) : null}
                          {parent ? (
                            <span className="group-quote">
                              <strong>{parent.author_name}</strong>
                              <span>{parent.deleted ? "Mensagem apagada" : parent.spoiler_chapter ? "🙈 Spoiler" : parent.body?.slice(0, 90)}</span>
                            </span>
                          ) : null}
                          {m.deleted ? (
                            <em className="group-text">Mensagem apagada</em>
                          ) : m.hidden ? (
                            <em className="group-text">Mensagem oculta por denúncias, aguardando a moderação.</em>
                          ) : spoilerHidden ? (
                            <button type="button" className="group-spoiler" onClick={() => setRevealed((s) => new Set(s).add(m.id))}>
                              <span className="group-spoiler-blur" aria-hidden="true">
                                {m.body}
                              </span>
                              <span className="group-spoiler-label">
                                {GIcon.eyeOff} Spoiler até o cap. {m.spoiler_chapter} · tocar para ver
                              </span>
                            </button>
                          ) : (
                            <>
                              {m.spoiler_chapter ? <span className="group-spoiler-tag">Spoiler · cap. {m.spoiler_chapter}</span> : null}
                              <span className="group-text">{m.body}</span>
                            </>
                          )}
                          <span className="group-meta">
                            {m.failed ? (
                              <button type="button" className="group-retry" onClick={() => retry(m)}>
                                Não enviada · tentar de novo
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
                                {r.emoji} <span>{r.count}</span>
                              </button>
                            ))}
                          </span>
                        ) : null}
                      </div>
                      {canAct ? (
                        <button type="button" className="group-more" aria-label="Ações da mensagem" onClick={() => setMenuFor(m)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                            <circle cx="5" cy="12" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="19" cy="12" r="1.8" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form className="group-composer" onSubmit={submit}>
            <div className="group-composer-inner">
              {replyTo ? (
                <div className="group-replying">
                  {GIcon.reply}
                  <span>
                    <strong>{replyTo.author_name}</strong> {replyTo.spoiler_chapter ? "🙈 Spoiler" : replyTo.body?.slice(0, 70)}
                  </span>
                  <button type="button" className="group-icon-btn" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)}>
                    {GIcon.close}
                  </button>
                </div>
              ) : null}
              {spoilerOn ? (
                <div className="group-spoiler-row">
                  {GIcon.eyeOff}
                  <label>
                    Spoiler até o capítulo
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={spoiler}
                      onChange={(e) => setSpoiler(e.target.value)}
                      placeholder="nº"
                      autoFocus
                    />
                  </label>
                  <small>Fica borrada para quem ainda não passou desse capítulo.</small>
                </div>
              ) : null}
              <div className="group-composer-row">
                {group.book_key ? (
                  <button
                    type="button"
                    className={`group-icon-btn group-spoiler-toggle ${spoilerOn ? "is-on" : ""}`}
                    onClick={() => setSpoilerOn((v) => !v)}
                    aria-pressed={spoilerOn}
                    aria-label="Marcar como spoiler"
                    title="Marcar como spoiler"
                  >
                    {GIcon.eyeOff}
                  </button>
                ) : null}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Mensagem"
                  aria-label="Mensagem"
                  maxLength={MESSAGE_MAX}
                  rows={1}
                />
                <button type="submit" className="group-send" disabled={!input.trim() || (spoilerOn && !spoiler)} aria-label="Enviar">
                  {GIcon.send}
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {menuFor ? (
        <MessageSheet
          message={menuFor}
          mine={menuFor.author_id === me}
          canDelete={menuFor.author_id === me || manager}
          onClose={() => setMenuFor(null)}
          onReact={(emoji) => void toggleReaction(menuFor, emoji)}
          onReply={() => {
            setReplyTo(menuFor);
            setMenuFor(null);
            inputRef.current?.focus();
          }}
          onDelete={() => void remove(menuFor)}
          onReport={() => {
            setReporting(menuFor);
            setMenuFor(null);
          }}
        />
      ) : null}

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

/** Ações de uma mensagem numa folha embaixo da tela: reagir, responder, apagar, denunciar. */
function MessageSheet({
  message: m,
  mine,
  canDelete,
  onClose,
  onReact,
  onReply,
  onDelete,
  onReport,
}: {
  message: GroupMessage;
  mine: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="group-sheet-backdrop is-bottom" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="group-action-sheet" role="menu" aria-label={`Ações da mensagem de ${m.author_name}`}>
        <div className="group-action-emojis">
          {GROUP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className={m.reactions.some((r) => r.emoji === emoji && r.mine) ? "is-mine" : ""}
              onClick={() => onReact(emoji)}
              aria-label={`Reagir com ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button type="button" role="menuitem" onClick={onReply}>
          {GIcon.reply} Responder
        </button>
        {canDelete ? (
          <button type="button" role="menuitem" className="is-danger" onClick={onDelete}>
            {GIcon.trash} Apagar para todos
          </button>
        ) : null}
        {!mine ? (
          <button type="button" role="menuitem" onClick={onReport}>
            {GIcon.flag} Denunciar
          </button>
        ) : null}
        <button type="button" role="menuitem" className="group-action-cancel" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
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

  return createPortal(
    <div className="about-backdrop group-sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="group-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={send}>
        <header className="group-sheet-head">
          <h2 id="report-title">Denunciar mensagem</h2>
          <button type="button" className="group-icon-btn" onClick={onClose} aria-label="Fechar">
            {GIcon.close}
          </button>
        </header>
        <p className="group-sheet-sub">Mensagem de {target.author_name}. A equipe de moderação vai analisar.</p>
        <fieldset className="group-field group-reasons">
          <legend>Motivo</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className={reason === r.value ? "is-on" : ""}>
              <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="group-field">
          <span>Detalhes (opcional)</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="group-sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Enviar denúncia
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
