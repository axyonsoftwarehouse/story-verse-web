import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SupabaseSession } from "../../lib/auth";
import { fetchCommunityText, type Submission } from "../../lib/community";

const PREVIEW_CHARS = 30_000;

export function SubmissionPreview({
  session,
  submission,
  onClose,
}: {
  session: SupabaseSession;
  submission: Submission;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setText(null);
    setError("");
    fetchCommunityText(session, submission.text_path)
      .then((result) => {
        if (alive) setText(result);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível abrir o texto.");
      });
    return () => {
      alive = false;
    };
  }, [session, submission.text_path]);

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
        aria-labelledby="submission-preview-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">{submission.title}</span>
            <h2 id="submission-preview-title">Prévia do envio</h2>
            <p className="muted">
              {submission.char_count
                ? `${submission.char_count.toLocaleString("pt-BR")} caracteres`
                : "Texto do envio"}
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
