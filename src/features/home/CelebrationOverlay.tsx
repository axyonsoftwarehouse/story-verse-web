import { useEffect } from "react";
import type { Ebook } from "../../data/types";
import { haptic } from "../../lib/motion";
import { BookCover } from "../../components/BookCover";

/** Comemoração no centro da tela (meta do dia, sequência, livro terminado). */
export type Celebration = {
  emoji: string;
  title: string;
  text?: string;
  /** Livro terminado: a capa aparece no lugar do emoji, com brilho dourado. */
  book?: Ebook;
  /** Sequência que subiu: o número antigo sai e o novo entra. */
  roll?: { from: number; to: number; suffix: string };
};

export function CelebrationOverlay({
  celebration,
  onClose,
}: {
  celebration: Celebration;
  onClose: () => void;
}) {
  useEffect(() => {
    haptic(celebration.book ? [30, 60, 30, 60, 90] : [25, 50, 40]);
  }, [celebration]);
  const { book, roll } = celebration;
  const pieces = book ? 24 : 14;
  return (
    <div
      className={`celebration ${book ? "is-book" : ""} ${roll ? "is-streak" : ""}`}
      role="status"
      onClick={onClose}
    >
      <div className="celebration-card">
        {book ? (
          <div className="celebration-cover" aria-hidden="true">
            <BookCover book={book} />
          </div>
        ) : (
          <span className="celebration-emoji" aria-hidden="true">
            {celebration.emoji}
          </span>
        )}
        {roll ? (
          <strong>
            <span className="sr-only">{celebration.title}</span>
            <span className="roll-title" aria-hidden="true">
              <span className="roll">
                <span className="roll-old">{roll.from}</span>
                <span className="roll-new">{roll.to}</span>
              </span>{" "}
              {roll.suffix}
            </span>
          </strong>
        ) : (
          <strong>{celebration.title}</strong>
        )}
        {celebration.text ? <span>{celebration.text}</span> : null}
      </div>
      <div
        className="celebration-burst"
        aria-hidden="true"
        style={{ "--step": `${360 / pieces}deg` } as React.CSSProperties}
      >
        {Array.from({ length: pieces }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
