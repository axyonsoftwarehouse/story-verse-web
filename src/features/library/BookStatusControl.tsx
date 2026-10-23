import { useEffect, useState } from "react";
import type { Ebook } from "../../data/types";
import { bookKeyOf } from "../../lib/library";
import { addToShelf, removeFromShelf, setDates, setRating, setReview, setStatus } from "../../lib/libraryStore";
import { AbandonBookDialog } from "./AbandonBookDialog";
import { RatingStars } from "./RatingStars";
import { STATUS_LABEL, useShelfEntry } from "./useShelf";
import "./library.css";

/** O livro na estante: status, progresso, nota, resenha, datas e as ações possíveis. */
export function BookStatusControl({ book, onClose }: { book: Ebook; onClose: () => void }) {
  const key = bookKeyOf(book);
  const entry = useShelfEntry(key);
  const [abandoning, setAbandoning] = useState(false);
  const [review, setLocalReview] = useState(entry?.review ?? "");
  const [startedOn, setStartedOn] = useState(entry?.startedOn ?? "");
  const [finishedOn, setFinishedOn] = useState(entry?.finishedOn ?? "");
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !abandoning) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, abandoning]);

  function saveDates() {
    if (!key) return;
    if (startedOn && finishedOn && startedOn > finishedOn) {
      setDateError("A data de início é depois da conclusão.");
      return;
    }
    setDateError("");
    setDates(key, startedOn || null, finishedOn || null);
  }

  return (
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-card shelf-dialog" role="dialog" aria-modal="true" aria-labelledby="shelf-book-title">
        <header className="shelf-dialog-head">
          <div>
            <span className="eyebrow">{entry ? STATUS_LABEL[entry.status] : "Fora da estante"}</span>
            <h2 id="shelf-book-title">{book.title}</h2>
            {entry?.progressPercent != null ? (
              <p className="muted">
                {entry.progressPercent}%{entry.progressLabel ? ` · ${entry.progressLabel}` : ""}
              </p>
            ) : null}
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        {!entry || !key ? (
          <div className="shelf-actions">
            <button type="button" className="btn btn-primary" onClick={() => addToShelf(book, "want_to_read")}>
              Quero ler
            </button>
          </div>
        ) : (
          <>
            {entry.finishedOn ? (
              <div className="shelf-field">
                <span>Sua nota</span>
                <RatingStars value={entry.rating} onChange={(v) => setRating(key, v)} />
              </div>
            ) : null}

            <label className="shelf-field">
              <span>Resenha</span>
              <textarea value={review} maxLength={4000} rows={3} onChange={(e) => setLocalReview(e.target.value)} />
            </label>
            <button type="button" className="btn" onClick={() => setReview(key, review)} disabled={review === (entry.review ?? "")}>
              Salvar resenha
            </button>

            <div className="shelf-dates">
              <label className="shelf-field">
                <span>Comecei em</span>
                <input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
              </label>
              <label className="shelf-field">
                <span>Terminei em</span>
                <input type="date" value={finishedOn} onChange={(e) => setFinishedOn(e.target.value)} />
              </label>
            </div>
            {dateError ? (
              <p className="auth-error" role="alert">
                {dateError}
              </p>
            ) : null}
            <button type="button" className="btn" onClick={saveDates}>
              Salvar datas
            </button>

            <div className="shelf-actions">
              {entry.status === "reading" || entry.status === "want_to_read" ? (
                <button type="button" className="btn" onClick={() => setStatus(key, "finished")}>
                  Marcar como terminado
                </button>
              ) : null}
              {entry.status === "reading" ? (
                <button type="button" className="btn" onClick={() => setAbandoning(true)}>
                  Abandonar
                </button>
              ) : null}
              {entry.status === "abandoned" ? (
                <button type="button" className="btn btn-primary" onClick={() => setStatus(key, "reading")}>
                  Retomar
                </button>
              ) : null}
              {entry.status === "finished" ? (
                <button type="button" className="btn" onClick={() => setStatus(key, "reading")}>
                  Ler de novo
                </button>
              ) : null}
              <button
                type="button"
                className="btn shelf-remove"
                onClick={() => {
                  removeFromShelf(key);
                  onClose();
                }}
              >
                Remover da estante
              </button>
            </div>
          </>
        )}
        {abandoning && key ? <AbandonBookDialog bookKey={key} onClose={() => setAbandoning(false)} /> : null}
      </section>
    </div>
  );
}
