import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Ebook } from "../../data/types";
import { bookKeyOf } from "../../lib/library";
import { markFinishPrompted, setRating, setReview } from "../../lib/libraryStore";
import { RatingStars } from "./RatingStars";
import "./library.css";

const REVIEW_MAX = 4000;

/** Depois de terminar o livro: nota e resenha opcionais. Aparece uma vez por livro. */
export function FinishBookDialog({ book, onClose }: { book: Ebook; onClose: () => void }) {
  const key = bookKeyOf(book);
  const [rating, setLocalRating] = useState<number | null>(null);
  const [review, setLocalReview] = useState("");

  useEffect(() => {
    if (key) markFinishPrompted(key);
  }, [key]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function save() {
    if (key) {
      if (rating !== null) setRating(key, rating);
      if (review.trim()) setReview(key, review);
    }
    onClose();
  }

  // No body: dentro da barra do leitor (backdrop-filter) o position:fixed ficaria preso a ela.
  return createPortal(
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-card shelf-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
        <span className="eyebrow">{book.title}</span>
        <h2 id="finish-title">Você terminou. Que nota dá?</h2>
        <RatingStars value={rating} onChange={setLocalRating} />
        <div className="shelf-field">
          <label htmlFor="finish-review">Resenha (opcional)</label>
          <textarea
            id="finish-review"
            value={review}
            maxLength={REVIEW_MAX}
            rows={4}
            onChange={(e) => setLocalReview(e.target.value)}
            placeholder="O que ficou com você?"
          />
          <small aria-live="polite">
            {review.length}/{REVIEW_MAX}
          </small>
        </div>
        <div className="shelf-actions">
          <button type="button" className="btn" onClick={onClose}>
            Agora não
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Salvar
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
