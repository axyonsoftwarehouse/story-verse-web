import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  CATALOG_GENRES,
  catalogChars,
  catalogDate,
  catalogErrorMessage,
  catalogSourceLabel,
  catalogStatusLabel,
  catalogStatusTone,
  listCatalogBooks,
  type AdminCatalogBook,
  type CatalogFilters,
  type CatalogStatus,
} from "../../lib/adminCatalog";
import { CatalogBookForm } from "./CatalogBookForm";

const STATUS_OPTIONS: { value: CatalogStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "hidden", label: "Oculto" },
  { value: "archived", label: "Arquivado" },
];

function hasAnyFilter(filters: CatalogFilters): boolean {
  return Boolean(
    filters.q ||
      filters.status ||
      filters.genre ||
      filters.language ||
      filters.source ||
      filters.featured !== undefined,
  );
}

export function CatalogSection({ session }: { session: SupabaseSession }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [books, setBooks] = useState<AdminCatalogBook[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listCatalogBooks(session, filters, 0)
      .then((result) => {
        if (!alive) return;
        setBooks(result.items);
        setPage(0);
        setHasMore(result.items.length >= result.limit);
      })
      .catch((err) => {
        if (!alive) return;
        setError(catalogErrorMessage(err, "Não foi possível carregar o catálogo."));
        setBooks([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, filters]);

  function loadMore() {
    if (loading) return;
    setLoading(true);
    setError("");
    listCatalogBooks(session, filters, page + 1)
      .then((result) => {
        setBooks((current) => [...(current ?? []), ...result.items]);
        setPage((current) => current + 1);
        setHasMore(result.items.length >= result.limit);
      })
      .catch((err) => setError(catalogErrorMessage(err, "Não foi possível carregar mais livros.")))
      .finally(() => setLoading(false));
  }

  function clearFilters() {
    setTerm("");
    setFilters({});
  }

  const filtered = hasAnyFilter(filters);

  return (
    <section className="shelf admin-catalog">
      <div className="shelf-head">
        <div>
          <h2>Catálogo</h2>
          <p>
            O acervo público curado. Rascunhos, ocultos e arquivados só aparecem aqui no painel.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          Adicionar livro
        </button>
      </div>

      <form
        className="admin-search"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, q: term.trim() }));
        }}
      >
        <label>
          Buscar no catálogo
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Título, autor ou chave (cat:, cm:)"
            autoComplete="off"
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          Buscar
        </button>
        {filtered ? (
          <button type="button" className="btn" onClick={clearFilters}>
            Limpar
          </button>
        ) : null}
      </form>

      <div className="admin-filters">
        <label>
          Situação
          <select
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as CatalogStatus | "",
              }))
            }
          >
            <option value="">Todas</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Gênero
          <select
            value={filters.genre ?? ""}
            onChange={(event) =>
              setFilters((current) => ({ ...current, genre: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {CATALOG_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Idioma
          <select
            value={filters.language ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                language: event.target.value as "pt" | "en" | "",
              }))
            }
          >
            <option value="">Todos</option>
            <option value="pt">Português</option>
            <option value="en">Inglês</option>
          </select>
        </label>

        <label>
          Origem
          <select
            value={filters.source ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                source: event.target.value as CatalogFilters["source"],
              }))
            }
          >
            <option value="">Todas</option>
            <option value="admin">Admin</option>
            <option value="community">Comunidade</option>
            <option value="import">Importação</option>
          </select>
        </label>

        <label>
          Destaque
          <select
            value={filters.featured === undefined ? "" : String(filters.featured)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                featured: event.target.value === "" ? undefined : event.target.value === "true",
              }))
            }
          >
            <option value="">Todos</option>
            <option value="true">Só destaques</option>
            <option value="false">Sem destaque</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {books === null && loading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando catálogo…
        </div>
      ) : books && books.length === 0 ? (
        <p className="profile-empty">
          {filtered
            ? "Nenhum livro com esses filtros."
            : "O catálogo está vazio. Adicione o primeiro livro para começar."}
        </p>
      ) : (
        <ul className="catalog-list">
          {books?.map((book) => (
            <li key={book.id} className="profile-card catalog-row">
              <div className="catalog-thumb">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" loading="lazy" />
                ) : (
                  <span>{book.title}</span>
                )}
              </div>

              <div className="catalog-main">
                <div className="catalog-title">
                  <strong>{book.title}</strong>
                  <span className={`status-chip ${catalogStatusTone(book.status)}`}>
                    {catalogStatusLabel(book.status)}
                  </span>
                  {book.featured ? <span className="status-chip is-approved">Destaque</span> : null}
                </div>
                <span className="muted">
                  {book.author || "Autor não informado"} · {book.genre || "sem gênero"} ·{" "}
                  {book.language === "pt" ? "Português" : "Inglês"}
                </span>
                <span className="muted">
                  {catalogSourceLabel(book.source)} · atualizado em {catalogDate(book.updated_at)}
                </span>
                {book.description ? <p className="catalog-description">{book.description}</p> : null}
                <span className="catalog-key">
                  {book.book_key} · {catalogChars(book.char_count)}
                </span>
              </div>

              <div className="catalog-row-actions">
                <Link className="btn" to={`/admin/acervo/${book.id}`}>
                  Abrir
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="catalog-pager">
          <button type="button" className="btn" onClick={loadMore} disabled={loading}>
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}

      {creating ? (
        <CatalogBookForm
          session={session}
          onClose={() => setCreating(false)}
          onCreated={(book) => {
            setCreating(false);
            navigate(`/admin/acervo/${book.id}`);
          }}
        />
      ) : null}
    </section>
  );
}
