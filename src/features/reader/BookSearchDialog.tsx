import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import { PrivacyNote } from "../../components/PrivacyNote";
import { type BookSearchHit } from "./bookText";

/** Busca dentro do livro aberto (roda no aparelho). */
export function BookSearchDialog({
  deferredTerm,
  openSearchResult,
  searchResults,
  searchTerm,
  setSearchOpen,
  setSearchTerm,
}: {
  deferredTerm: string;
  openSearchResult: (r: BookSearchHit) => void;
  searchResults: { hits: BookSearchHit[]; total: number };
  searchTerm: string;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className="import-overlay" onClick={() => setSearchOpen(false)}>
      <div
        className="import-panel marks-panel search-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-head">
          <h3 id="search-title">Buscar no livro</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSearchOpen(false)}
            aria-label="Fechar"
          >
            {Icon.close}
          </button>
        </div>
        <label className="search-field">
          {Icon.search}
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Uma palavra ou um nome"
            aria-label="O que buscar no livro"
            autoFocus
          />
        </label>
        {deferredTerm.trim().length < 2 ? (
          <>
            <p className="import-note">
              Digite pelo menos 2 letras. A busca olha o livro inteiro, no texto original.
            </p>
            <PrivacyNote details="O livro já está aberto aqui, então a busca roda no seu aparelho: o que você digita não vai para a internet nem fica salvo.">
              Busca privada: acontece só neste aparelho.
            </PrivacyNote>
          </>
        ) : searchResults.hits.length === 0 ? (
          <p className="import-note">Nada encontrado para “{deferredTerm.trim()}”.</p>
        ) : (
          <>
            <p className="search-count">
              {searchResults.total} {searchResults.total === 1 ? "trecho" : "trechos"}
              {searchResults.total > searchResults.hits.length
                ? ` (mostrando os ${searchResults.hits.length} primeiros)`
                : ""}
            </p>
            <ul className="marks-list search-list">
              {searchResults.hits.map((r) => (
                <li key={`${r.chapterIndex}-${r.paragraph}-${r.start}`}>
                  <button type="button" className="search-hit" onClick={() => openSearchResult(r)}>
                    <span className="marks-chapter">{r.chapterLabel}</span>
                    <span className="search-snippet">
                      {r.before}
                      <mark>{r.match}</mark>
                      {r.after}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
