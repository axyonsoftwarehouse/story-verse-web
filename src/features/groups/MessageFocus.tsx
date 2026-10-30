import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { GROUP_EMOJIS, messageTime, type GroupMessage } from "../../lib/groups";
import { hueOf } from "./groupHelpers";
import { formatMessage } from "./messageFormat";
import { GIcon } from "./groupIcons";

const MARGIN = 12;

/**
 * Mensagem em destaque, como ao segurar uma mensagem no WhatsApp: a conversa escurece, a bolha
 * fica onde estava, a barra de emojis aparece em cima e as ações (e as reações dela) embaixo.
 */
export function MessageFocus({
  message: m,
  anchor,
  mine,
  hideText,
  canDelete,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDelete,
  onReport,
}: {
  message: GroupMessage;
  /** Onde a bolha está na tela (o destaque abre no mesmo lugar). */
  anchor: DOMRect;
  mine: boolean;
  /** Spoiler ainda escondido para quem está vendo: não mostra o texto no destaque. */
  hideText: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Põe a bolha do destaque em cima da original, sem deixar o painel sair da tela.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const bubble = panel.querySelector<HTMLElement>(".group-focus-bubble");
    const offset = bubble ? bubble.offsetTop : 0;
    const max = window.innerHeight - panel.offsetHeight - MARGIN;
    setTop(Math.max(MARGIN, Math.min(anchor.top - offset, max)));
  }, [anchor]);

  const side: CSSProperties = mine
    ? { right: Math.max(MARGIN, window.innerWidth - anchor.right) }
    : { left: Math.max(MARGIN, anchor.left) };
  const total = m.reactions.reduce((n, r) => n + r.count, 0);

  return createPortal(
    <div className="group-focus" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`group-focus-panel ${mine ? "is-mine" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Mensagem de ${m.author_name}`}
        style={{ ...side, top: top ?? anchor.top, visibility: top === null ? "hidden" : undefined }}
      >
        <div className="group-focus-emojis" role="group" aria-label="Reagir">
          {GROUP_EMOJIS.map((emoji, i) => {
            const on = m.reactions.some((r) => r.emoji === emoji && r.mine);
            return (
              <button
                key={emoji}
                type="button"
                className={on ? "is-mine" : ""}
                style={{ "--i": i } as CSSProperties}
                onClick={() => onReact(emoji)}
                aria-pressed={on}
                aria-label={on ? `Tirar a reação ${emoji}` : `Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        <div className="group-focus-bubble" style={{ "--hue": hueOf(m.author_id) } as CSSProperties}>
          {!mine ? <span className="group-author" style={{ color: `hsl(${hueOf(m.author_id)} 55% 70%)` }}>{m.author_name}</span> : null}
          <span className="group-text">{hideText ? "🙈 Spoiler" : m.body ? formatMessage(m.body) : m.media_kind === "image" ? "📷 Foto" : "🎤 Áudio"}</span>
          <span className="group-meta">{messageTime(m.created_at)}</span>
        </div>

        {total > 0 ? (
          <section className="group-focus-reactions" aria-label="Reações">
            <h3>
              Reações <small>{total}</small>
            </h3>
            <div>
              {m.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  className={r.mine ? "is-mine" : ""}
                  onClick={() => onReact(r.emoji)}
                  aria-label={`${r.emoji}: ${r.count}${r.mine ? ", inclui você (toque para tirar)" : " (toque para reagir)"}`}
                >
                  <span className="group-focus-emoji">{r.emoji}</span>
                  <strong>{r.count}</strong>
                  {r.mine ? <small>você</small> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="group-focus-actions" role="menu">
          <button type="button" role="menuitem" onClick={onReply}>
            Responder {GIcon.reply}
          </button>
          {!hideText && m.body ? (
            <button type="button" role="menuitem" onClick={onCopy}>
              Copiar {GIcon.copy}
            </button>
          ) : null}
          {!mine ? (
            <button type="button" role="menuitem" onClick={onReport}>
              Denunciar {GIcon.flag}
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" role="menuitem" className="is-danger" onClick={onDelete}>
              Apagar para todos {GIcon.trash}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type Burst = { key: number; emoji: string; x: number; y: number };

/** O emoji escolhido sobe da bolha e some, com umas faíscas em volta. */
export function ReactionBursts({ bursts }: { bursts: Burst[] }) {
  if (bursts.length === 0) return null;
  return createPortal(
    <div className="group-bursts" aria-hidden="true">
      {bursts.map((b) => (
        <span key={b.key} className="group-burst" style={{ left: b.x, top: b.y }}>
          <span className="group-burst-emoji">{b.emoji}</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} style={{ "--a": `${i * 60 + 15}deg` } as CSSProperties} />
          ))}
        </span>
      ))}
    </div>,
    document.body,
  );
}
