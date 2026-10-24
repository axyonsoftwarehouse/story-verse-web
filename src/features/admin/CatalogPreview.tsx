import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SupabaseSession } from "../../lib/auth";
import { catalogErrorMessage, fetchCatalogText, type AdminCatalogBook } from "../../lib/adminCatalog";

const PREVIEW_CHARS = 30_000;

/** Prévia do texto do catálogo. Funciona para rascunho, oculto e arquivado (lê pelo storage). */
export function CatalogPreview({
  session,
  book,
  onClose,
}: {
  session: SupabaseSession;
  book: AdminCatalogBook;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setText(null);
    setError("");
    fetchCatalogText(session, book)
      .then((result) => {
        if (alive) setText(result);
      })
      .catch((err) => {
        if (alive) setError(catalogErrorMessage(err, "Não foi possível abrir o texto."));
      });
    return () => {
      alive = false;
    };
  }, [session, book]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="about-dialog submission-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-preview-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">{book.title}</span>
            <h2 id="catalog-preview-title">Prévia do texto</h2>
            <p className="muted">
              {book.char_count
                ? `${book.char_count.toLocaleString("pt-BR")} caracteres`
                : "Texto do catálogo"}
            </p>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar prévia">
            ×
          </button>
        </header>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : text === null ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando…
          </div>
        ) : (
          <>
            <div className="submission-preview-text">{text.slice(0, PREVIEW_CHARS)}</div>
            {text.length > PREVIEW_CHARS ? (
              <p className="muted">
                Mostrando os primeiros {PREVIEW_CHARS.toLocaleString("pt-BR")} de{" "}
                {text.length.toLocaleString("pt-BR")} caracteres.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
