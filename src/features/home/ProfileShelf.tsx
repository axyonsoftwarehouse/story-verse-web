import { useState } from "react";
import { Icon } from "../../components/Icon";
import { ReaderCount } from "../../components/ReaderCount";
import type { Ebook } from "../../data/types";
import { bookKeyOf } from "../../lib/library";
import { CONTINUE_PREVIEW } from "../../lib/homePreviews";
import { BookCover } from "../../components/BookCover";

/** Estante do perfil: mostra 4 e o resto em "Ver todos", como em Continue lendo. */
export function ProfileShelf({
  title,
  subtitle,
  eyebrow,
  className,
  items,
  empty,
  action,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
  items: { book: Ebook; sub: string; pct?: number; badge?: string }[];
  empty?: string;
  /** Link/ação extra no rodapé da estante (ex.: "Ver a biblioteca"). */
  action?: React.ReactNode;
  onOpen: (book: Ebook) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0 && !empty) return null;
  const shown = showAll ? items : items.slice(0, CONTINUE_PREVIEW);
  return (
    <section className={`shelf ${className ?? ""}`}>
      <div className="shelf-head">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="profile-empty profile-empty-card">
          <span className="profile-empty-icon" aria-hidden="true">
            {Icon.book}
          </span>
          <span>{empty}</span>
        </p>
      ) : (
        <div className="result-grid">
          {shown.map(({ book, sub, pct, badge }) => (
            <button key={book.id} type="button" className="result" onClick={() => onOpen(book)}>
              {badge ? <span className="new-badge">{badge}</span> : null}
              <BookCover book={book} />
              {pct !== undefined ? (
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
              ) : null}
              <strong>{book.title}</strong>
              <span>{sub}</span>
              <ReaderCount bookKey={bookKeyOf(book)} />
            </button>
          ))}
        </div>
      )}
      {items.length > CONTINUE_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
          </button>
        </div>
      ) : null}
      {action ? <div className="shelf-more">{action}</div> : null}
    </section>
  );
}
