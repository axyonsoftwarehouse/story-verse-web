import { useMemo, useState } from "react";
import type { Ebook } from "../../data/types";
import type { ShelfStatus } from "../../lib/library";
import type { LocalShelfEntry } from "../../lib/libraryStore";
import { BookStatusControl } from "./BookStatusControl";
import { RatingStars } from "./RatingStars";
import { filterShelf, shelfOptions, type ShelfFilter, type ShelfSort } from "./shelfFilters";
import { STATUS_LABEL, useShelfEntries } from "./useShelf";
import "./library.css";

const SORTS: { id: ShelfSort; label: string }[] = [
  { id: "recent", label: "Recentes" },
  { id: "title", label: "Título" },
  { id: "author", label: "Autor" },
  { id: "rating", label: "Nota" },
  { id: "finished", label: "Data de conclusão" },
];

/** "Minha estante": tudo o que a conta leu, está lendo, quer ler ou abandonou. */
export function LibraryPage({
  onClose,
  onOpenBook,
  available,
  bookFor,
}: {
  onClose: () => void;
  onOpenBook: (book: Ebook) => void;
  /** O livro ainda abre nesta conta/aparelho? (importado removido, livro tirado do acervo) */
  available: (bookKey: string) => boolean;
  bookFor: (entry: LocalShelfEntry) => Ebook;
}) {
  const entries = useShelfEntries();
  const [filter, setFilter] = useState<ShelfFilter>({});
  const [sort, setSort] = useState<ShelfSort>("recent");
  const [detail, setDetail] = useState<LocalShelfEntry | null>(null);
  const options = useMemo(() => shelfOptions(entries), [entries]);
  const shown = useMemo(() => filterShelf(entries, filter, sort, available), [entries, filter, sort, available]);
  const set = (patch: ShelfFilter) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <main className="shelf-page">
      <header className="shelf-page-head">
        <button type="button" className="btn" onClick={onClose}>
          Voltar
        </button>
        <div>
          <span className="eyebrow">Sua biblioteca</span>
          <h1>Minha estante</h1>
          <p className="muted">
            {shown.length === 1 ? "1 livro" : `${shown.length} livros`}
            {shown.length !== entries.length ? ` de ${entries.length}` : ""}
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="shelf-empty">Sua estante está vazia. Abra um livro e ele aparece aqui.</p>
      ) : (
        <>
          <div className="shelf-filters">
            <label>
              Status
              <select
                value={filter.status ?? ""}
                onChange={(e) => set({ status: (e.target.value || undefined) as ShelfStatus | undefined })}
              >
                <option value="">Todos</option>
                {(Object.keys(STATUS_LABEL) as ShelfStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {options.authors.length > 1 ? (
              <label>
                Autor
                <select value={filter.author ?? ""} onChange={(e) => set({ author: e.target.value || undefined })}>
                  <option value="">Todos</option>
                  {options.authors.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {options.genres.length > 0 ? (
              <label>
                Gênero
                <select value={filter.genre ?? ""} onChange={(e) => set({ genre: e.target.value || undefined })}>
                  <option value="">Todos</option>
                  {options.genres.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {options.years.length > 0 ? (
              <label>
                Ano
                <select
                  value={filter.year ?? ""}
                  onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Todos</option>
                  {options.years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Nota mínima
              <select
                value={filter.minRating ?? ""}
                onChange={(e) => set({ minRating: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Qualquer</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </label>
            <label>
              Arquivo
              <select
                value={filter.hasFile === undefined ? "" : String(filter.hasFile)}
                onChange={(e) => set({ hasFile: e.target.value === "" ? undefined : e.target.value === "true" })}
              >
                <option value="">Todos</option>
                <option value="true">Abre neste aparelho</option>
                <option value="false">Sem arquivo</option>
              </select>
            </label>
            <label>
              Ordenar
              <select value={sort} onChange={(e) => setSort(e.target.value as ShelfSort)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="shelf-empty">Nenhum livro com esses filtros.</p>
          ) : (
            <ul className="shelf-list">
              {shown.map((entry) => {
                const canOpen = available(entry.bookKey);
                return (
                  <li key={entry.bookKey} className="shelf-card">
                    <button
                      type="button"
                      className="shelf-card-main"
                      aria-label={`Detalhes de ${entry.title}`}
                      onClick={() => setDetail(entry)}
                    >
                      {entry.coverUrl ? (
                        <img className="shelf-cover" src={entry.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="shelf-cover shelf-cover-blank" aria-hidden="true">
                          {entry.title.slice(0, 1)}
                        </span>
                      )}
                      <span className="shelf-card-text">
                        <strong>{entry.title}</strong>
                        {entry.author ? <span>{entry.author}</span> : null}
                        <span className="shelf-status">
                          {STATUS_LABEL[entry.status]}
                          {entry.status === "reading" && entry.progressPercent != null ? ` · ${entry.progressPercent}%` : ""}
                        </span>
                        {entry.rating !== null ? <RatingStars value={entry.rating} readOnly /> : null}
                      </span>
                    </button>
                    {canOpen ? (
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Abrir ${entry.title}`}
                        onClick={() => onOpenBook(bookFor(entry))}
                      >
                        Abrir
                      </button>
                    ) : (
                      <span className="shelf-missing">arquivo removido</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {detail ? <BookStatusControl book={bookFor(detail)} onClose={() => setDetail(null)} /> : null}
    </main>
  );
}
