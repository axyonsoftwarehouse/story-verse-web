import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DNF_REASONS, type DnfReason } from "../../lib/library";
import { abandonBook } from "../../lib/libraryStore";
import "./library.css";

const NOTE_MAX = 500;

/** Abandonar: motivo obrigatório e uma nota curta opcional. Dá para retomar depois. */
export function AbandonBookDialog({ bookKey, onClose }: { bookKey: string; onClose: () => void }) {
  const [reason, setReason] = useState<DnfReason | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function confirm() {
    if (!reason) return;
    abandonBook(bookKey, reason, note);
    onClose();
  }

  // No body: dentro da barra do leitor (backdrop-filter) o position:fixed ficaria preso a ela.
  return createPortal(
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-card shelf-dialog" role="dialog" aria-modal="true" aria-labelledby="abandon-title">
        <h2 id="abandon-title">Abandonar este livro?</h2>
        <p className="muted">Ele continua na sua estante, e você pode retomar quando quiser.</p>
        <fieldset className="shelf-reasons">
          <legend>Por quê?</legend>
          {DNF_REASONS.map((r) => (
            <label key={r.id}>
              <input type="radio" name="dnf-reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="shelf-field">
          <span>Nota (opcional)</span>
          <textarea value={note} maxLength={NOTE_MAX} rows={2} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="shelf-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!reason} onClick={confirm}>
            Abandonar
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
