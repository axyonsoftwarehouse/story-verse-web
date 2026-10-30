import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  messagePreview,
  sendMediaMessage,
  sendMessage,
  sendTyping,
  TYPING_SEND_MS,
  TYPING_SHOWN_MS,
  typingLabel,
  type Group,
  type GroupMessage,
} from "../../lib/groups";
import { GroupInfo } from "./GroupInfo";
import { GroupAvatar, GroupsBlocked, PersonFace } from "./GroupParts";
import { GIcon } from "./groupIcons";
import { chatBackground, dayLabel, hotAuthors, hueOf, isJumboEmoji, myChapter, useGroupsGate } from "./groupHelpers";
import { formatMessage } from "./messageFormat";
import { ChatAudio, ChatImage } from "./MediaParts";
import { clock, keepMedia, prepareChatImage, recordingMime } from "../../lib/chatMedia";
import { MessageFocus, ReactionBursts, type Burst } from "./MessageFocus";

const PAGE = 50;
/** Segurar a mensagem por este tempo abre o destaque (reações e ações). */
const LONG_PRESS_MS = 420;
/** Arrastar a mensagem para a direita além disto responde a ela. */
const SWIPE_REPLY_PX = 56;
/** Áudio de no máximo 2 minutos (para sozinho e envia). */
const MAX_AUDIO_MS = 120_000;

type Gesture = { id: number; x: number; y: number; timer: number; swipe: number; swiping: boolean; armed: boolean; el: HTMLElement };

/**
 * Altura e topo da área que sobra na tela com o teclado aberto. No celular o teclado não encolhe
 * a página (iOS) ou encolhe de um jeito diferente (Android): a conversa acompanha a área visível,
 * como no WhatsApp, e o topo nunca sai da tela. Trava a rolagem da página por baixo.
 */
function useVisibleArea() {
  const [area, setArea] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    const vv = window.visualViewport;
    const update = () => vv && setArea({ height: Math.round(vv.height), top: Math.round(vv.offsetTop) });
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      html.style.overflow = previous;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);
  return area;
}

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
  const [recordingMs, setRecordingMs] = useState<number | null>(null);
  const recorder = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; start: number; timer: number; send: boolean } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  /** Arquivo de cada mídia enviada, para "tentar de novo" sem escolher de novo. */
  const mediaFiles = useRef(new Map<string, { blob: Blob; durationMs?: number; width?: number; height?: number }>());
  const [spoilerOn, setSpoilerOn] = useState(false);
  const [spoiler, setSpoiler] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [menuFor, setMenuFor] = useState<{ message: GroupMessage; anchor: DOMRect } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flashId, setFlashId] = useState<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [reporting, setReporting] = useState<GroupMessage | null>(null);
  /** Quem está digitando agora: conta → até quando mostrar. */
  const [typing, setTyping] = useState<Record<string, number>>({});
  const lastTypingSent = useRef(0);
  /** Mensagens que já estavam lá ao abrir: só as que chegam depois entram com animação. */
  const initialIds = useRef<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const area = useVisibleArea();
  const lastReadSent = useRef(0);
  const messagesRef = useRef<GroupMessage[]>([]);
  messagesRef.current = messages;
  const groupRef = useRef<Group | null>(null);
  groupRef.current = group;

  const isMember = Boolean(group?.is_member);
  const hot = useMemo(() => hotAuthors(messages), [messages]);
  const online = useMemo(() => new Set((group?.members ?? []).filter((m) => m.online && m.user_id !== me).map((m) => m.user_id)), [group?.members, me]);
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
        initialIds.current = new Set(list.map((m) => m.id));
        setMessages(list);
        setHasMore(list.length === PAGE);
        setLoaded(true);
      })
      .catch((err: unknown) => alive && setError(message(err)));

    const close = openGroupStream(
      (event) => {
        if (event.type === "message" && event.data.group_id === id) {
          setMessages((cur) => mergeMessages(cur, [event.data]));
          setTyping(({ [event.data.author_id]: _sent, ...rest }) => rest);
          const g = groupRef.current;
          if (event.data.author_id !== me) {
            if (!stickToBottom.current && !messagesRef.current.some((m) => m.id === event.data.id)) setNewBelow((n) => n + 1);
            if (g) notifyGroupMessage(event.data, g.name, g.muted);
          }
        } else if (event.type === "message_deleted" && event.data.groupId === id) {
          setMessages((cur) => cur.map((m) => (m.id === event.data.id ? { ...m, deleted: true, body: null } : m)));
        } else if (event.type === "reaction" && event.data.groupId === id) {
          const { messageId, emoji, added, userId } = event.data;
          // A minha reação já foi aplicada na hora do clique.
          if (userId === me) return;
          setMessages((cur) => cur.map((m) => (m.id === messageId ? applyReaction(m, emoji, added, false) : m)));
        } else if (event.type === "presence") {
          const { userId, online: on } = event.data;
          setGroup((g) =>
            g?.members?.some((m) => m.user_id === userId) ? { ...g, members: g.members.map((m) => (m.user_id === userId ? { ...m, online: on } : m)) } : g,
          );
        } else if (event.type === "typing" && event.data.groupId === id && event.data.userId !== me) {
          setTyping((cur) => ({ ...cur, [event.data.userId]: Date.now() + TYPING_SHOWN_MS }));
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

  // O "digitando" some sozinho quando para de chegar aviso.
  useEffect(() => {
    const until = Object.values(typing);
    if (until.length === 0) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, at]) => at > now)));
    }, Math.max(100, Math.min(...until) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [typing]);

  function onInput(value: string) {
    setInput(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = now;
      void sendTyping(id).catch(() => {});
    }
  }

  // Mensagem nova: desce até ela se a pessoa já estava no fim da conversa.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    sendRead();
  }, [messages, typing, sendRead]);

  // Teclado abriu ou fechou: quem estava no fim continua vendo a última mensagem.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [area?.height]);

  function scrollToEnd() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  }

  // A caixa de texto cresce com a mensagem (até umas 6 linhas).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // scrollHeight não conta a borda (border-box): sem somá-la sobra a barra de rolagem.
    el.style.height = "auto";
    const full = el.scrollHeight + el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(full, 150)}px`;
    el.style.overflowY = full > 150 ? "auto" : "hidden";
  }, [input]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(stickToBottom.current);
    if (stickToBottom.current) setNewBelow(0);
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
      const file = draft.media_kind ? mediaFiles.current.get(draft.client_id!) : undefined;
      const saved = file
        ? await sendMediaMessage(id, file.blob, {
            kind: draft.media_kind!,
            clientId: draft.client_id!,
            durationMs: file.durationMs,
            width: file.width,
            height: file.height,
            caption: draft.body,
            spoilerChapter: draft.spoiler_chapter,
            replyTo: draft.reply_to,
          })
        : await sendMessage(id, {
            body: draft.body ?? "",
            clientId: draft.client_id!,
            spoilerChapter: draft.spoiler_chapter,
            replyTo: draft.reply_to,
          });
      if (file) {
        // A cópia local fica no aparelho: a própria foto/áudio não é baixada de volta.
        await keepMedia(saved.id, file.blob);
        mediaFiles.current.delete(draft.client_id!);
      }
      setMessages((cur) => mergeMessages(cur, [saved]));
    } catch (err) {
      setMessages((cur) => cur.map((m) => (m.client_id === draft.client_id && m.pending ? { ...m, pending: false, failed: true } : m)));
      setError(message(err));
    }
  }

  /** Mensagem provisória (aparece na hora; a confirmada do servidor entra no lugar). */
  function newDraft(fields: Partial<GroupMessage>): GroupMessage | null {
    if (!session) return null;
    return {
      id: Number.MAX_SAFE_INTEGER,
      group_id: id,
      author_id: me,
      author_name: String(session.user.user_metadata?.name ?? "Você"),
      author_avatar: String(session.user.user_metadata?.avatar ?? ""),
      author_photo: typeof session.user.user_metadata?.photo === "string" ? session.user.user_metadata.photo : null,
      body: null,
      spoiler_chapter: spoilerOn && spoiler ? Number(spoiler) : null,
      reply_to: replyTo?.id ?? null,
      client_id: newClientId(),
      created_at: new Date().toISOString(),
      deleted: false,
      hidden: false,
      reactions: [],
      pending: true,
      ...fields,
    };
  }

  function queue(draft: GroupMessage) {
    stickToBottom.current = true;
    setMessages((cur) => [...cur, draft]);
    setSpoiler("");
    setSpoilerOn(false);
    setReplyTo(null);
    setError("");
    void deliver(draft);
  }

  /** Foto ou áudio: aparece na hora com o arquivo local e sobe em seguida. */
  function sendFile(kind: "image" | "audio", blob: Blob, meta: { durationMs?: number; width?: number; height?: number }) {
    const caption = kind === "image" ? input.trim() || null : null;
    const draft = newDraft({
      body: caption,
      media_kind: kind,
      media_mime: blob.type,
      media_duration_ms: meta.durationMs ?? null,
      media_width: meta.width ?? null,
      media_height: meta.height ?? null,
      media_available: true,
      media_local: URL.createObjectURL(blob),
    });
    if (!draft) return;
    mediaFiles.current.set(draft.client_id!, { blob, ...meta });
    if (caption) setInput("");
    queue(draft);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const { blob, width, height } = await prepareChatImage(file);
      sendFile("image", blob, { width, height });
    } catch (err) {
      setError(message(err));
    }
  }

  async function startRecording() {
    const mime = recordingMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não grava áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      // 24 kbps: bom para voz e leve (1 minuto ≈ 180 KB).
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24_000 });
      const state = { rec, stream, chunks: [] as Blob[], start: Date.now(), timer: 0, send: false };
      rec.ondataavailable = (e) => e.data.size > 0 && state.chunks.push(e.data);
      rec.onstop = () => {
        window.clearInterval(state.timer);
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - state.start;
        recorder.current = null;
        setRecordingMs(null);
        if (!state.send || durationMs < 700) return;
        sendFile("audio", new Blob(state.chunks, { type: mime.split(";")[0] }), { durationMs: Math.min(durationMs, MAX_AUDIO_MS) });
      };
      state.timer = window.setInterval(() => {
        const elapsed = Date.now() - state.start;
        setRecordingMs(elapsed);
        if (elapsed >= MAX_AUDIO_MS) stopRecording(true);
      }, 200);
      recorder.current = state;
      setRecordingMs(0);
      rec.start(1000);
      navigator.vibrate?.(15);
    } catch {
      setError("Libere o microfone nas permissões do navegador para gravar áudio.");
    }
  }

  function stopRecording(send: boolean) {
    const state = recorder.current;
    if (!state) return;
    state.send = send;
    if (state.rec.state !== "inactive") state.rec.stop();
  }

  // Saiu da conversa no meio da gravação: descarta.
  useEffect(() => () => stopRecording(false), []);

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
      author_photo: typeof session.user.user_metadata?.photo === "string" ? session.user.user_metadata.photo : null,
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
    lastTypingSent.current = 0;
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

  function burst(m: GroupMessage, emoji: string) {
    const bubble = listRef.current?.querySelector(`[data-mid="${m.id}"] .group-bubble`);
    if (!bubble) return;
    const r = bubble.getBoundingClientRect();
    const key = Date.now() + Math.random();
    setBursts((cur) => [...cur, { key, emoji, x: m.author_id === me ? r.right - 24 : r.left + 24, y: r.bottom - 10 }]);
    window.setTimeout(() => setBursts((cur) => cur.filter((b) => b.key !== key)), 1000);
  }

  async function toggleReaction(m: GroupMessage, emoji: string) {
    setMenuFor(null);
    const mine = m.reactions.some((r) => r.emoji === emoji && r.mine);
    if (!mine) burst(m, emoji);
    setMessages((cur) => cur.map((x) => (x.id === m.id ? applyReaction(x, emoji, !mine, true) : x)));
    try {
      const reactions = await react(m.id, emoji, !mine);
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, reactions } : x)));
    } catch (err) {
      setMessages((cur) => cur.map((x) => (x.id === m.id ? applyReaction(x, emoji, mine, true) : x)));
      setError(message(err));
    }
  }

  /** Abre o destaque da mensagem no lugar onde a bolha está. */
  function openFocus(m: GroupMessage, row: Element | null) {
    const bubble = row?.querySelector(".group-bubble") ?? row;
    if (!bubble || menuFor?.message.id === m.id) return;
    navigator.vibrate?.(10);
    setMenuFor({ message: m, anchor: bubble.getBoundingClientRect() });
  }

  function resetSwipe(g: Gesture) {
    g.el.classList.add("is-returning");
    g.el.classList.remove("is-armed");
    g.el.style.setProperty("--swipe", "0");
    window.setTimeout(() => g.el.classList.remove("is-returning"), 220);
  }

  // Toque: segurar abre o destaque; arrastar para a direita responde (como no WhatsApp).
  function onPointerDown(m: GroupMessage, e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || (e.target as Element).closest("button, a")) return;
    const el = e.currentTarget;
    const timer = window.setTimeout(() => {
      gesture.current = null;
      openFocus(m, el);
    }, LONG_PRESS_MS);
    gesture.current = { id: m.id, x: e.clientX, y: e.clientY, timer, swipe: 0, swiping: false, armed: false, el };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.swiping) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) window.clearTimeout(g.timer);
      if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) g.swiping = true;
      else if (Math.abs(dy) > 10) gesture.current = null;
      return;
    }
    // Depois do ponto de responder, a bolha anda mais devagar (resistência).
    g.swipe = Math.max(0, dx < SWIPE_REPLY_PX ? dx : SWIPE_REPLY_PX + (dx - SWIPE_REPLY_PX) * 0.3);
    g.el.style.setProperty("--swipe", String(Math.min(g.swipe, 90)));
    const armed = g.swipe >= SWIPE_REPLY_PX;
    if (armed !== g.armed) {
      g.armed = armed;
      g.el.classList.toggle("is-armed", armed);
      if (armed) navigator.vibrate?.(8);
    }
  }

  function onPointerEnd(m: GroupMessage) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    window.clearTimeout(g.timer);
    if (g.swiping) {
      resetSwipe(g);
      if (g.armed) {
        setReplyTo(m);
        inputRef.current?.focus();
      }
    }
  }

  async function copyText(m: GroupMessage) {
    setMenuFor(null);
    try {
      await navigator.clipboard.writeText(m.body ?? "");
      setNotice("Mensagem copiada.");
    } catch {
      setError("Não foi possível copiar.");
    }
  }

  /** Toque na citação: vai até a mensagem original e ela pisca. */
  function jumpTo(messageId: number) {
    const row = listRef.current?.querySelector(`[data-mid="${messageId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(messageId);
    window.setTimeout(() => setFlashId((cur) => (cur === messageId ? null : cur)), 1600);
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
  const typingIds = Object.keys(typing);
  const typingNames = typingIds.map((uid) => group?.members?.find((m) => m.user_id === uid)?.name ?? "Alguém");
  const typingText = typingLabel(typingNames);
  const wallpaper = chatBackground(group?.background);

  return (
    <div
      className="group-chat-page"
      style={area ? { top: area.top, height: area.height, bottom: "auto" } : undefined}
    >
      <header className="group-chat-header">
        <Link className="group-icon-btn" to="/grupos" aria-label="Voltar para os grupos">
          {GIcon.back}
        </Link>
        {group ? (
          <button type="button" className="group-chat-title" onClick={() => setInfoOpen(true)} aria-label={`Ver detalhes de ${group.name}`}>
            <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="sm" />
            <span className="group-chat-title-text">
              <strong>{group.name}</strong>
              {typingText ? (
                <small className="is-typing">{typingText}</small>
              ) : (
                <small>
                  {group.book_title ? `${group.book_title} · ` : ""}
                  {members} {members === 1 ? "membro" : "membros"}
                </small>
              )}
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
          <div className="group-chat-main">
            <div className={`group-chat-body ${wallpaper.className}`} style={wallpaper.style} ref={listRef} onScroll={onScroll}>
              <div className="group-messages" aria-live="polite">
                {hasMore ? (
                  <button type="button" className="group-older" onClick={() => void loadOlder()} disabled={loadingOlder}>
                    {loadingOlder ? "Carregando…" : "Mensagens anteriores"}
                  </button>
                ) : loaded ? (
                  <div className="group-chat-start">
                    <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="md" />
                    <strong>{group.name}</strong>
                    <span className="group-chat-start-desc">{group.description ?? "Este é o começo da conversa."}</span>
                    {group.my_role === "owner" && (!group.description || !group.background) ? (
                      <button type="button" className="group-start-edit" onClick={() => setInfoOpen(true)}>
                        {GIcon.pencil} {group.description ? "Escolher o fundo da conversa" : "Adicionar descrição e fundo"}
                      </button>
                    ) : null}
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
                  const fresh = m.pending || !initialIds.current.has(m.id);
                  const jumbo = !m.media_kind && !m.deleted && !m.hidden && !spoilerHidden && !parent && !m.spoiler_chapter && isJumboEmoji(m.body);
                  const total = m.reactions.reduce((n, r) => n + r.count, 0);
                  return (
                    <Fragment key={m.client_id ?? m.id}>
                      {newDay ? (
                        <div className="group-day">
                          <span>{dayLabel(m.created_at)}</span>
                        </div>
                      ) : null}
                      <div
                        className={`group-msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""} ${fresh ? "is-new" : ""} ${total ? "has-reactions" : ""} ${flashId === m.id ? "is-flash" : ""}`}
                        style={{ "--hue": hueOf(m.author_id) } as CSSProperties}
                        data-mid={m.pending || m.failed ? undefined : m.id}
                        onPointerDown={canAct ? (e) => onPointerDown(m, e) : undefined}
                        onPointerMove={canAct ? onPointerMove : undefined}
                        onPointerUp={canAct ? () => onPointerEnd(m) : undefined}
                        onPointerCancel={canAct ? () => onPointerEnd(m) : undefined}
                        onContextMenu={
                          canAct
                            ? (e) => {
                                e.preventDefault();
                                if (gesture.current) window.clearTimeout(gesture.current.timer);
                                gesture.current = null;
                                openFocus(m, e.currentTarget);
                              }
                            : undefined
                        }
                      >
                        <span className="group-swipe-icon" aria-hidden="true">
                          {GIcon.reply}
                        </span>
                        {!mine ? grouped ? <span className="group-face-gap" /> : <PersonFace
                              id={m.author_id}
                              name={m.author_name}
                              avatar={m.author_avatar}
                              photo={m.author_photo ?? group.members?.find((x) => x.user_id === m.author_id)?.photo}
                              size="sm"
                              hot={hot.has(m.author_id)}
                              online={online.has(m.author_id)}
                            /> : null}
                        <div className="group-bubble-wrap">
                          <div
                            className={`group-bubble ${m.deleted || m.hidden ? "is-muted" : ""} ${m.pending ? "is-pending" : ""} ${jumbo ? "is-jumbo" : ""}`}
                            onDoubleClick={() => canAct && void toggleReaction(m, "❤️")}
                          >
                            {!mine && !grouped ? (
                              <span className="group-author" style={{ color: `hsl(${hueOf(m.author_id)} 55% 70%)` }}>
                                {m.author_name}
                              </span>
                            ) : null}
                            {parent ? (
                              <button type="button" className="group-quote" onClick={() => jumpTo(parent.id)} aria-label={`Ir para a mensagem de ${parent.author_name}`}>
                                <strong>{parent.author_name}</strong>
                                <span>{parent.deleted ? "Mensagem apagada" : messagePreview(parent)}</span>
                              </button>
                            ) : null}
                            {m.deleted ? (
                              <em className="group-text">Mensagem apagada</em>
                            ) : m.hidden ? (
                              <em className="group-text">Mensagem oculta por denúncias, aguardando a moderação.</em>
                            ) : spoilerHidden ? (
                              <button type="button" className="group-spoiler" onClick={() => setRevealed((s) => new Set(s).add(m.id))}>
                                <span className="group-spoiler-blur" aria-hidden="true">
                                  {m.body || messagePreview({ ...m, spoiler_chapter: null })}
                                </span>
                                <span className="group-spoiler-label">
                                  {GIcon.eyeOff} Spoiler até o cap. {m.spoiler_chapter} · tocar para ver
                                </span>
                              </button>
                            ) : (
                              <>
                                {m.spoiler_chapter ? <span className="group-spoiler-tag">Spoiler · cap. {m.spoiler_chapter}</span> : null}
                                {m.media_kind === "image" ? <ChatImage message={m} /> : m.media_kind === "audio" ? <ChatAudio message={m} /> : null}
                                {m.body ? <span className="group-text">{formatMessage(m.body)}</span> : null}
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
                          {total > 0 ? (
                            <button
                              type="button"
                              className={`group-reactions ${m.reactions.some((r) => r.mine) ? "is-mine" : ""}`}
                              onClick={(e) => openFocus(m, e.currentTarget.closest(".group-msg"))}
                              aria-label={`Reações: ${m.reactions.map((r) => `${r.emoji} ${r.count}`).join(", ")}. Toque para ver ou reagir.`}
                            >
                              {[...m.reactions]
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 3)
                                .map((r) => (
                                  <span key={r.emoji} className="group-reaction-emoji">
                                    {r.emoji}
                                  </span>
                                ))}
                              {total > 1 ? <span className="group-reaction-count">{total}</span> : null}
                            </button>
                          ) : null}
                        </div>
                        {canAct ? (
                          <button
                            type="button"
                            className="group-more"
                            aria-label="Reagir ou ver as ações da mensagem"
                            onClick={(e) => openFocus(m, e.currentTarget.closest(".group-msg"))}
                          >
                            {GIcon.smile}
                          </button>
                        ) : null}
                      </div>
                    </Fragment>
                  );
                })}
                {typingIds.length > 0 ? (
                  <div className="group-msg group-typing" aria-label={typingText} style={{ "--hue": hueOf(typingIds[0]) } as CSSProperties}>
                    <PersonFace
                      id={typingIds[0]}
                      name={typingNames[0]}
                      avatar={group.members?.find((m) => m.user_id === typingIds[0])?.avatar ?? null}
                      photo={group.members?.find((m) => m.user_id === typingIds[0])?.photo}
                      size="sm"
                      hot={hot.has(typingIds[0])}
                      online
                    />
                    <div className="group-bubble">
                      <span className="group-typing-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {!atBottom ? (
              <button type="button" className="group-to-end" onClick={scrollToEnd} aria-label={newBelow ? `${newBelow} mensagens novas, ir para o fim` : "Ir para a última mensagem"}>
                {newBelow ? <span className="group-to-end-count">{newBelow > 99 ? "99+" : newBelow}</span> : null}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : null}
          </div>

          <form className="group-composer" onSubmit={submit}>
            <div className="group-composer-inner">
              {replyTo ? (
                <div className="group-replying">
                  {GIcon.reply}
                  <span>
                    <strong>{replyTo.author_name}</strong> {messagePreview(replyTo, 70)}
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
              {recordingMs !== null ? (
                <div className="group-composer-row group-recording" role="status">
                  <button type="button" className="group-icon-btn" onClick={() => stopRecording(false)} aria-label="Descartar o áudio">
                    {GIcon.trash}
                  </button>
                  <span className="group-recording-time">
                    <i aria-hidden="true" /> {clock(recordingMs)} <small>gravando · até {clock(MAX_AUDIO_MS)}</small>
                  </span>
                  <button type="button" className="group-send" onClick={() => stopRecording(true)} aria-label="Enviar o áudio">
                    {GIcon.send}
                  </button>
                </div>
              ) : (
              <div className="group-composer-row">
                <button type="button" className="group-icon-btn group-attach" onClick={() => photoRef.current?.click()} aria-label="Enviar foto" title="Enviar foto">
                  {GIcon.image}
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void pickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
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
                  onChange={(e) => onInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Mensagem"
                  aria-label="Mensagem"
                  maxLength={MESSAGE_MAX}
                  rows={1}
                />
                {input.trim() ? (
                  <button type="submit" className="group-send" disabled={spoilerOn && !spoiler} aria-label="Enviar">
                    {GIcon.send}
                  </button>
                ) : (
                  <button type="button" className="group-send is-mic" onClick={() => void startRecording()} aria-label="Gravar áudio" title="Gravar áudio">
                    {GIcon.mic}
                  </button>
                )}
              </div>
              )}
            </div>
          </form>
        </>
      )}

      {menuFor ? (
        <MessageFocus
          message={messages.find((x) => x.id === menuFor.message.id) ?? menuFor.message}
          anchor={menuFor.anchor}
          mine={menuFor.message.author_id === me}
          hideText={
            menuFor.message.spoiler_chapter !== null && menuFor.message.author_id !== me && chapter <= menuFor.message.spoiler_chapter && !revealed.has(menuFor.message.id)
          }
          canDelete={menuFor.message.author_id === me || manager}
          onClose={() => setMenuFor(null)}
          onReact={(emoji) => void toggleReaction(messages.find((x) => x.id === menuFor.message.id) ?? menuFor.message, emoji)}
          onReply={() => {
            setReplyTo(menuFor.message);
            setMenuFor(null);
            inputRef.current?.focus();
          }}
          onCopy={() => void copyText(menuFor.message)}
          onDelete={() => void remove(menuFor.message)}
          onReport={() => {
            setReporting(menuFor.message);
            setMenuFor(null);
          }}
        />
      ) : null}
      <ReactionBursts bursts={bursts} />

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
          hot={hot}
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
