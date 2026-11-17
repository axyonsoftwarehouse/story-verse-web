import type { ChatMsg } from "../../lib/chatHistory";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import type { Ebook, StoryCharacter } from "../../data/types";
import { USER_MESSAGE_MAX_CHARS } from "../../lib/ai";
import { shortNameOf } from "../../lib/characterName";
import { Avatar } from "../../components/Avatar";
import { PrivacyNote } from "../../components/PrivacyNote";
import { suggestionsFor, type Msg } from "./chatHelpers";

/** Conversa com os personagens, ao lado do texto. */
export function ChatPanel({
  book,
  castReady,
  character,
  characters,
  chatAvatarRef,
  chatBodyRef,
  chatOpen,
  chatReaction,
  error,
  extraMessagesLeft,
  input,
  inputRef,
  limitApplies,
  loading,
  messages,
  messagesLeft,
  onSend,
  outOfMessages,
  ready,
  resetConversation,
  sendMessage,
  setActiveCharId,
  setChatOpen,
  setInput,
  setShopOpen,
  shareMessage,
  userHasSpoken,
}: {
  book: Ebook;
  castReady: boolean;
  character: StoryCharacter;
  characters: StoryCharacter[];
  chatAvatarRef: RefObject<HTMLSpanElement | null>;
  chatBodyRef: RefObject<HTMLDivElement | null>;
  chatOpen: boolean;
  chatReaction: { id: string; emoji: string | null } | null;
  error: string | null;
  extraMessagesLeft: number;
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  limitApplies: boolean;
  loading: boolean;
  messages: ChatMsg[];
  messagesLeft: number;
  onSend: (e: React.FormEvent) => void;
  outOfMessages: boolean;
  ready: boolean;
  resetConversation: () => void;
  sendMessage: (raw: string) => Promise<void>;
  setActiveCharId: Dispatch<SetStateAction<string>>;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  setInput: Dispatch<SetStateAction<string>>;
  setShopOpen: Dispatch<SetStateAction<boolean>>;
  shareMessage: (m: Msg) => void;
  userHasSpoken: boolean;
}) {
  return (
    <aside className={`chat ${chatOpen ? "is-open" : ""}`} aria-label="Conversa com os personagens">
      {character ? (
        <div className="chat-head" style={{ "--c": character.color } as React.CSSProperties}>
          <span className="chat-head-avatar" ref={chatAvatarRef}>
            <Avatar character={character} size="lg" bookTitle={book.title} generate />
            {chatReaction?.emoji ? (
              <span key={chatReaction.id} className="chat-reaction" aria-hidden="true">
                {chatReaction.emoji}
              </span>
            ) : null}
          </span>
          <div className="chat-head-text">
            <strong>{character.name}</strong>
            <span>{character.role}</span>
          </div>
          {userHasSpoken ? (
            <button
              type="button"
              className="icon-btn"
              onClick={resetConversation}
              aria-label={`Recomeçar a conversa com ${character.name}`}
              title="Recomeçar a conversa"
            >
              {Icon.refresh}
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn chat-close"
            onClick={() => setChatOpen(false)}
            aria-label="Fechar conversa"
          >
            {Icon.close}
          </button>
        </div>
      ) : (
        <div className="chat-head chat-head-pending">
          <span className="spinner" aria-hidden="true" />
          <div className="chat-head-text">
            <strong>{ready ? "Conhecendo os personagens…" : "Abrindo o livro…"}</strong>
            <span>Em instantes eles chegam para conversar</span>
          </div>
          <button
            type="button"
            className="icon-btn chat-close"
            onClick={() => setChatOpen(false)}
            aria-label="Fechar conversa"
          >
            {Icon.close}
          </button>
        </div>
      )}

      {characters.length > 1 ? (
        <div className="cast" role="tablist" aria-label="Personagens">
          {characters.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === character?.id}
              className={`cast-chip ${c.id === character?.id ? "active" : ""}`}
              style={{ "--c": c.color } as React.CSSProperties}
              onClick={() => setActiveCharId(c.id)}
            >
              <Avatar character={c} size="sm" bookTitle={book.title} generate />
              {shortNameOf(c)}
            </button>
          ))}
        </div>
      ) : null}

      <PrivacyNote
        details={
          <>
            Ninguém da comunidade vê suas conversas. Cada mensagem vai por conexão criptografada
            (HTTPS) até a IA que dá voz ao personagem, só para ele responder, e o histórico fica no
            seu aparelho e na sua conta, para continuar de onde parou. Você pode apagar tudo em
            Perfil › Ajustes › Privacidade.
          </>
        }
      >
        Conversa privada: só você vê.
      </PrivacyNote>

      <div ref={chatBodyRef} className="chat-body">
        {character ? (
          // Sempre no começo da conversa: deixa claro que é ficção feita por IA.
          <p className="chat-ai-notice" role="note">
            <span aria-hidden="true">🤖</span>
            <span>
              <strong>Conversa fictícia criada por inteligência artificial.</strong>{" "}
              {character.name} é um personagem, não uma pessoa real: as respostas são geradas por IA
              e podem conter erros.
            </span>
          </p>
        ) : null}
        {messages.map((m) =>
          m.role === "assistant" && character ? (
            <div key={m.id} className="msg msg-assistant">
              <Avatar character={character} size="sm" bookTitle={book.title} generate />
              <div className="bubble assistant">{m.text}</div>
              <button
                type="button"
                className="msg-share"
                onClick={() => shareMessage(m)}
                aria-label="Compartilhar esta fala como imagem"
                title="Compartilhar como imagem"
              >
                {Icon.share}
              </button>
            </div>
          ) : (
            <div key={m.id} className={`msg msg-user ${m.reaction ? "has-reaction" : ""}`}>
              <div className="bubble user">
                {m.text}
                {m.reaction ? (
                  <span
                    className="bubble-reaction"
                    role="img"
                    aria-label={`${character?.name ?? "O personagem"} reagiu com ${m.reaction}`}
                  >
                    {m.reaction}
                  </span>
                ) : null}
              </div>
              {loading && messages[messages.length - 1]?.id === m.id ? (
                <span
                  className="msg-seen"
                  aria-label={`${character?.name ?? "O personagem"} viu a mensagem`}
                >
                  Visto
                </span>
              ) : null}
            </div>
          ),
        )}
        {loading && character ? (
          <div className="msg msg-assistant is-typing">
            <Avatar character={character} size="sm" bookTitle={book.title} generate />
            <div
              className="bubble assistant typing"
              aria-label={`${character.name} está escrevendo`}
            >
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="chat-err">{error}</div> : null}

      {!userHasSpoken && character && ready && !loading && !outOfMessages ? (
        <div className="suggestions">
          {suggestionsFor(character).map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion"
              onClick={() => void sendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {limitApplies && messagesLeft > 0 && messagesLeft <= 5 ? (
        <p className="limit-note">
          {messagesLeft === 1 ? "Resta 1 mensagem hoje." : `Restam ${messagesLeft} mensagens hoje.`}
        </p>
      ) : null}
      {limitApplies && messagesLeft === 0 && extraMessagesLeft > 0 ? (
        <p className="limit-note">
          {extraMessagesLeft === 1
            ? "Usando 1 mensagem extra."
            : `Usando mensagens extras: ${extraMessagesLeft} restantes.`}
        </p>
      ) : null}

      {outOfMessages ? (
        <div className="limit-out" role="status">
          <strong>Por hoje é só 💛</strong>
          <span>
            Você usou as mensagens gratuitas e extras de hoje. Os personagens voltam a conversar
            amanhã — enquanto isso, a leitura continua.
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setShopOpen(true)}>
            Comprar mensagens extras
          </button>
        </div>
      ) : (
        <form className="composer" onSubmit={onSend}>
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={USER_MESSAGE_MAX_CHARS}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              ready && character
                ? `Escreva para ${shortNameOf(character)}…`
                : "Aguarde um instante…"
            }
            disabled={loading || !ready || !castReady || !character}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={loading || !ready || !character || !input.trim()}
            aria-label="Enviar"
          >
            {Icon.send}
          </button>
        </form>
      )}
    </aside>
  );
}
