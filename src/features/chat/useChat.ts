import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ebook, StoryCharacter } from "../../data/types";
import { characterReply, detectProvider, refreshAiQuota, type ChatTurn } from "../../lib/ai";
import { AuthNetworkError, authEnabled, type SupabaseSession } from "../../lib/auth";
import { NUDGE_AFTER_DAYS, nudgeText, voiceFor } from "../../lib/characterNudge";
import { loadChat, saveChat } from "../../lib/chatHistory";
import { currentDataOwner } from "../../lib/dataOwner";
import { bookKeyOf } from "../../lib/library";
import { shelfEnabled, shelfEntry } from "../../lib/libraryStore";
import { prefersReducedMotion } from "../../lib/motion";
import { missYouMessage, tidyAmbientMessages } from "../../lib/readingAmbient";
import { rememberCharacter } from "../../lib/reminders";
import { countMessage, extraMessages, messagesLeftToday } from "../../lib/usageLimit";
import { initialThreadsFor, uid, type Msg } from "./chatHelpers";

const EMPTY_THREAD: Msg[] = [];

/** O que a conversa precisa saber do leitor na hora de mandar uma mensagem. */
export type ChatSendContext = {
  /** Livro carregado e texto pronto na tela. */
  ready: boolean;
  /** Trecho perto de onde o leitor está, para o personagem não dar spoiler. */
  textExcerpt: string;
  readingProgressPct: number;
};

/** Status e nota deste livro na estante, para o chat (só com a estante ligada). */
function shelfContextFor(book: Ebook) {
  if (!shelfEnabled()) return undefined;
  const key = bookKeyOf(book);
  const entry = key ? shelfEntry(key) : null;
  return entry ? { status: entry.status, rating: entry.rating } : undefined;
}

/**
 * Estado da conversa com os personagens do livro aberto: fios por personagem, quem está ativo,
 * cota de mensagens, envio e a conversa guardada no aparelho.
 */
export function useChat({
  book,
  cast,
  authSession,
  sendContext,
  beginRequest,
}: {
  book: Ebook | null;
  /** Elenco do livro aberto (null enquanto a IA ainda está sugerindo). */
  cast: StoryCharacter[] | null;
  authSession: SupabaseSession | null;
  /** Lido na hora do envio (a posição de leitura muda a cada rolagem). */
  sendContext: () => ChatSendContext;
  /** Marca o início de um pedido; a função devolvida diz se a resposta ainda vale (mesmo livro e conta). */
  beginRequest: () => () => boolean;
}) {
  const [activeCharId, setActiveCharId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  /** No celular o chat abre como painel por cima do texto. */
  const [chatOpen, setChatOpen] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState(messagesLeftToday);
  const [extraMessagesLeft, setExtraMessagesLeft] = useState(extraMessages);
  useEffect(() => {
    if (!authEnabled || !authSession) return;
    let alive = true;
    void refreshAiQuota().then(() => {
      if (!alive) return;
      setMessagesLeft(messagesLeftToday());
      setExtraMessagesLeft(extraMessages());
    });
    return () => {
      alive = false;
    };
  }, [authSession]);

  /** O personagem "ouviu": o avatar do topo do chat pula; quando ele reage à mensagem, solta o emoji. */
  const [chatReaction, setChatReaction] = useState<{ id: string; emoji: string | null } | null>(
    null,
  );
  const chatAvatarRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!chatReaction || prefersReducedMotion()) return;
    chatAvatarRef.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-7px) scale(1.06)" },
        { transform: "translateY(0)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }, [chatReaction]);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const characters = useMemo(() => cast ?? [], [cast]);
  const character = useMemo(
    () => characters.find((c) => c.id === activeCharId) ?? characters[0],
    [activeCharId, characters],
  );

  const messages = character ? (threads[character.id] ?? EMPTY_THREAD) : EMPTY_THREAD;

  /** Guarda a conversa do livro para continuar na próxima vez. */
  useEffect(() => {
    if (!book || !cast || Object.keys(threads).length === 0) return;
    const owner = currentDataOwner();
    const t = window.setTimeout(() => saveChat(book.id, threads, activeCharId, owner), 400);
    return () => window.clearTimeout(t);
  }, [book, cast, threads, activeCharId]);

  /** Trocou de personagem no chat: o retrato do topo gira como uma moeda. */
  const flippedForRef = useRef<string | null>(null);
  useEffect(() => {
    const id = character?.id ?? null;
    const before = flippedForRef.current;
    flippedForRef.current = id;
    if (!id || !before || before === id || prefersReducedMotion()) return;
    chatAvatarRef.current?.animate(
      [
        { transform: "perspective(400px) rotateY(0)" },
        { transform: "perspective(400px) rotateY(180deg) scale(0.9)" },
        { transform: "perspective(400px) rotateY(360deg)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
    );
  }, [character?.id]);

  /** Guarda com quem o leitor conversou por último (usado no texto dos lembretes). */
  useEffect(() => {
    if (book && character) rememberCharacter(book.id, character.name);
  }, [book, character]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activeCharId, loading, chatOpen]);

  /** Conversa do zero (outro livro, saiu do livro ou trocou de conta). */
  const resetChat = useCallback((opts?: { characterId?: string; open?: boolean }) => {
    setLoading(false);
    setActiveCharId(opts?.characterId ?? "");
    setThreads({});
    setError(null);
    setInput("");
    setChatOpen(opts?.open ?? false);
  }, []);

  /**
   * O elenco chegou: retoma a conversa guardada da última vez (personagem sem conversa começa com
   * a saudação). Se o leitor voltou depois de dias, o personagem manda uma mensagem de saudade.
   */
  const startConversation = useCallback(
    (forBook: Ebook, list: StoryCharacter[], away: { days: number; chapter?: string }) => {
      const saved = loadChat(forBook.id);
      const greetings = initialThreadsFor(list);
      setThreads((prev) =>
        Object.keys(prev).length > 0
          ? prev
          : Object.fromEntries(
              list.map((c) => [
                c.id,
                saved?.threads[c.id]?.length ? saved.threads[c.id] : greetings[c.id],
              ]),
            ),
      );
      const savedActive = saved?.activeCharId && list.some((c) => c.id === saved.activeCharId);
      const activeId = savedActive ? saved!.activeCharId : list[0]?.id;
      setActiveCharId((id) => id || activeId || "");
      if (away.days >= NUDGE_AFTER_DAYS && away.chapter && activeId) {
        // O mesmo recado da tela inicial, de quem o mandou (sem ele, a saudade genérica).
        const voice = voiceFor(forBook);
        const from = list.find((c) => c.id === voice?.id || c.name === voice?.name)?.id ?? activeId;
        const line = voice
          ? nudgeText(forBook, voice, away.chapter, away.days)
          : missYouMessage(away.chapter, away.days);
        setThreads((prev) => ({
          ...prev,
          // Uma saudade só: se a anterior ficou sem resposta, a nova toma o lugar dela.
          [from]: tidyAmbientMessages([
            ...(prev[from] ?? []),
            { id: uid(), role: "assistant", text: line },
          ]),
        }));
      }
    },
    [],
  );

  function resetConversation() {
    if (!character) return;
    if (
      !window.confirm(
        `Recomeçar a conversa com ${character.name}? As mensagens desta conversa serão apagadas.`,
      )
    ) {
      return;
    }
    setThreads((prev) => ({
      ...prev,
      [character.id]: initialThreadsFor([character])[character.id],
    }));
  }

  const limitApplies = detectProvider() === "live";
  const outOfMessages = limitApplies && messagesLeft + extraMessagesLeft <= 0;

  async function sendMessage(raw: string) {
    const { ready, textExcerpt, readingProgressPct } = sendContext();
    if (!book || !character || !ready) return;
    const text = raw.trim();
    if (!text || loading) return;
    if (limitApplies && messagesLeftToday() + extraMessages() <= 0) {
      setMessagesLeft(0);
      setExtraMessagesLeft(0);
      return;
    }

    setError(null);
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text };
    setChatReaction({ id: userMsg.id, emoji: null });
    setThreads((prev) => ({
      ...prev,
      [character.id]: [...(prev[character.id] ?? []), userMsg],
    }));

    const prior = [...(threads[character.id] ?? []), userMsg];
    const history: ChatTurn[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    setLoading(true);
    const stillCurrent = beginRequest();
    try {
      const { text: reply, reaction } = await characterReply({
        character,
        history: history.slice(0, -1),
        userMessage: text,
        ebookTitle: book.title,
        ebookAuthor: book.author,
        textExcerpt,
        readingProgressPct,
        textLanguage: book.textLanguage,
        shelf: shelfContextFor(book),
      });
      if (!stillCurrent()) return;
      const botMsg: Msg = { id: uid(), role: "assistant", text: reply };
      if (limitApplies) {
        setMessagesLeft(countMessage());
        setExtraMessagesLeft(extraMessages());
      }
      // Achou a mensagem fofa ou engraçada: o emoji fica preso nela (e sobe do avatar).
      if (reaction) setChatReaction({ id: botMsg.id, emoji: reaction });
      setThreads((prev) => ({
        ...prev,
        [character.id]: [
          ...(prev[character.id] ?? []).map((m) =>
            m.id === userMsg.id && reaction ? { ...m, reaction } : m,
          ),
          botMsg,
        ],
      }));
    } catch (err) {
      if (!stillCurrent()) return;
      console.warn("Falha no envio da mensagem:", err);
      if (err instanceof AuthNetworkError && err.code === "AI_QUOTA_EXHAUSTED") {
        setMessagesLeft(0);
        setExtraMessagesLeft(0);
      }
      setError(
        err instanceof Error ? err.message : "Não foi possível concluir o envio. Tente de novo.",
      );
      setThreads((prev) => ({
        ...prev,
        [character.id]: [...(prev[character.id] ?? []).filter((m) => m.id !== userMsg.id)],
      }));
      setInput(text);
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return {
    activeCharId,
    setActiveCharId,
    input,
    setInput,
    loading,
    error,
    threads,
    chatOpen,
    setChatOpen,
    messagesLeft,
    extraMessagesLeft,
    chatReaction,
    chatAvatarRef,
    chatBodyRef,
    inputRef,
    characters,
    character,
    messages,
    castReady: cast !== null,
    userHasSpoken: messages.some((m) => m.role === "user"),
    limitApplies,
    outOfMessages,
    resetChat,
    startConversation,
    resetConversation,
    sendMessage,
    onSend,
  };
}

export type ChatState = ReturnType<typeof useChat>;
