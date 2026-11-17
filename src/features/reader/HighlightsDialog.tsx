import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import { type Highlight } from "../../lib/highlights";

/** Lista dos trechos destacados no livro. */
export function HighlightsDialog({
  highlightGroups,
  openHighlight,
  removeHighlight,
  setHighlightsOpen,
  shareQuote,
}: {
  highlightGroups: { first: Highlight; text: string }[];
  openHighlight: (h: Highlight) => void;
  removeHighlight: (h: Highlight) => void;
  setHighlightsOpen: Dispatch<SetStateAction<boolean>>;
  shareQuote: (text: string, chapterLabel?: string) => void;
}) {
  return (
    <div className="import-overlay" onClick={() => setHighlightsOpen(false)}>
      <div
        className="import-panel marks-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marks-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-head">
          <h3 id="marks-title">Marcações</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setHighlightsOpen(false)}
            aria-label="Fechar"
          >
            {Icon.close}
          </button>
        </div>
        {highlightGroups.length === 0 ? (
          <p className="import-note">
            Selecione um trecho do livro e toque em <strong>Marcar</strong> para guardar suas
            citações favoritas aqui.
          </p>
        ) : (
          <ul className="marks-list">
            {highlightGroups.map(({ first, text }) => (
              <li key={first.group ?? first.id}>
                <span className="marks-chapter">{first.chapterLabel}</span>
                <blockquote>{text}</blockquote>
                <div className="marks-actions">
                  <button type="button" className="link-btn" onClick={() => openHighlight(first)}>
                    Ir para o trecho
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => shareQuote(text, first.chapterLabel)}
                  >
                    Compartilhar
                  </button>
                  <button
                    type="button"
                    className="link-btn marks-remove"
                    onClick={() => removeHighlight(first)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
