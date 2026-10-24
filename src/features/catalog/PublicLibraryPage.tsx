import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CATALOG_GENRES } from "../../lib/adminCatalog";
import {
  catalogBookToEbook,
  listCatalogCollections,
  searchCatalog,
  type CatalogBook,
  type CatalogCollection,
  type CatalogSort,
} from "../../lib/catalog";
import { CatalogCover } from "./CatalogCover";
import "./catalog.css";

function CatalogCard({ book }: { book: CatalogBook }) {
  const ebook = catalogBookToEbook(book);
  return (
    <Link className="catalog-card" to={`/biblioteca/${encodeURIComponent(book.book_key)}`}>
      <CatalogCover book={ebook} />
      <strong>{book.title}</strong>
      <span className="catalog-card-author">{book.author || "Autor não informado"}</span>
      <span className="catalog-card-meta">
        {[book.genre, book.language === "en" ? "Inglês" : "Português"].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}

function CardGrid({ books }: { books: CatalogBook[] }) {
  return (
    <div className="catalog-grid">
      {books.map((book) => (
        <CatalogCard key={book.book_key} book={book} />
      ))}
    </div>
  );
}

export function PublicLibraryPage() {
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState<"pt" | "en" | "">("");
  const [collection, setCollection] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<CatalogSort>("new");

  const [items, setItems] = useState<CatalogBook[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [featured, setFeatured] = useState<CatalogBook[]>([]);
  const [latest, setLatest] = useState<CatalogBook[]>([]);
  const [collections, setCollections] = useState<CatalogCollection[]>([]);

  const homeMode =
    !applied && !genre && !language && !collection && !featuredOnly && sort === "new";

  useEffect(() => {
    let alive = true;
    Promise.all([
      searchCatalog({ featured: true, sort: "featured", limit: 6 }),
      searchCatalog({ sort: "new", limit: 8 }),
      listCatalogCollections().catch(() => [] as CatalogCollection[]),
    ])
      .then(([highlighted, newest, groups]) => {
        if (!alive) return;
        setFeatured(highlighted.items);
        setLatest(newest.items);
        setCollections(groups);
      })
      .catch(() => {
        // Sem destaque/novidades a busca e o catálogo continuam funcionando.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (homeMode) {
      setItems(null);
      setLoading(false);
      setError("");
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    searchCatalog({
      q: applied,
      genre,
      language,
      collection,
      featured: featuredOnly || undefined,
      sort,
      limit: 12,
    })
      .then((result) => {
        if (!alive) return;
        setItems(result.items);
        setPage(0);
        setHasMore(result.items.length >= result.limit);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar a biblioteca.");
        setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [applied, genre, language, collection, featuredOnly, sort, homeMode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(term.trim());
  }

  function clearFilters() {
    setTerm("");
    setApplied("");
    setGenre("");
    setLanguage("");
    setCollection("");
    setFeaturedOnly(false);
    setSort("new");
  }

  function loadMore() {
    if (loading) return;
    setLoading(true);
    setError("");
    searchCatalog({
      q: applied,
      genre,
      language,
      collection,
      featured: featuredOnly || undefined,
      sort,
      page: page + 1,
      limit: 12,
    })
      .then((result) => {
        setItems((current) => [...(current ?? []), ...result.items]);
        setPage((current) => current + 1);
        setHasMore(result.items.length >= result.limit);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Não foi possível carregar mais livros."),
      )
      .finally(() => setLoading(false));
  }

  const activeCollection = collections.find((item) => item.slug === collection);

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          ← Início
        </Link>
      </nav>

      <section className="shelf library-hero">
        <div className="shelf-head">
          <span className="eyebrow">Biblioteca pública</span>
          <h1>Leia, converse e guarde na sua estante.</h1>
          <p>
            Clássicos e obras livres escolhidos pela curadoria do Storyverse. Os metadados são
            abertos; para ler e conversar com os personagens, entre na sua conta.
          </p>
        </div>

        <form className="library-search" onSubmit={submit}>
          <label>
            Buscar na biblioteca
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Título, autor ou trecho do resumo"
              autoComplete="off"
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Buscar
          </button>
        </form>

        <div className="library-filters">
          <label>
            Gênero
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
              <option value="">Todos</option>
              {CATALOG_GENRES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Idioma
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "pt" | "en" | "")}
            >
              <option value="">Todos</option>
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </label>
          {collections.length > 0 ? (
            <label>
              Coleção
              <select value={collection} onChange={(event) => setCollection(event.target.value)}>
                <option value="">Todas</option>
                {collections.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Ordenar
            <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}>
              <option value="new">Novidades</option>
              <option value="title">Título</option>
              <option value="author">Autor</option>
              <option value="featured">Destaques</option>
            </select>
          </label>
          <label className="library-check">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(event) => setFeaturedOnly(event.target.checked)}
            />
            Só destaques
          </label>
          {!homeMode ? (
            <button type="button" className="btn" onClick={clearFilters}>
              Limpar
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {homeMode ? (
        <>
          {collections.length > 0 ? (
            <section className="shelf">
              <div className="shelf-head">
                <h2>Coleções</h2>
                <p>Trilhas montadas pela curadoria para começar por um tema.</p>
              </div>
              <div className="collection-cards">
                {collections.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className="profile-card collection-card"
                    onClick={() => setCollection(item.slug)}
                  >
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {item.book_count} {item.book_count === 1 ? "livro" : "livros"}
                    </span>
                    {item.description ? <span>{item.description}</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {featured.length > 0 ? (
            <section className="shelf">
              <div className="shelf-head">
                <h2>Destaques</h2>
                <p>Escolhidos pela curadoria para começar bem.</p>
              </div>
              <CardGrid books={featured} />
            </section>
          ) : null}

          {latest.length > 0 ? (
            <section className="shelf">
              <div className="shelf-head">
                <h2>Novidades</h2>
                <p>O que entrou na biblioteca recentemente.</p>
              </div>
              <CardGrid books={latest} />
            </section>
          ) : null}

          {featured.length === 0 && latest.length === 0 && !loading ? (
            <p className="profile-empty">
              A biblioteca ainda está sendo montada. Em breve há livros aqui.
            </p>
          ) : null}
        </>
      ) : (
        <section className="shelf">
          <div className="shelf-head">
            <h2>
              {applied
                ? `Resultados para “${applied}”`
                : activeCollection
                  ? activeCollection.title
                  : "Catálogo"}
            </h2>
            <p>
              {items === null
                ? "Buscando…"
                : items.length === 0
                  ? "Nenhum livro com esses filtros."
                  : `${items.length} ${items.length === 1 ? "livro" : "livros"} nesta página`}
            </p>
          </div>

          {loading && items === null ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              Carregando…
            </div>
          ) : items && items.length > 0 ? (
            <CardGrid books={items} />
          ) : null}

          {hasMore ? (
            <div className="catalog-pager">
              <button type="button" className="btn" onClick={loadMore} disabled={loading}>
                {loading ? "Carregando…" : "Carregar mais"}
              </button>
            </div>
          ) : null}
        </section>
      )}

      <footer className="home-foot">
        <p>
          Textos em domínio público e obras livres.{" "}
          <Link to="/">Voltar para a home</Link>
        </p>
      </footer>
    </div>
  );
}
