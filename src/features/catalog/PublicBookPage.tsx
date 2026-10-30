import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ReaderCount } from "../../components/ReaderCount";
import { hasFeature } from "../../lib/accountFeatures";
import { GROUPS_AVAILABLE } from "../../lib/groups";
import { ApiHttpError } from "../../lib/backend";
import {
  catalogBookToEbook,
  catalogRightsLabel,
  getCatalogBook,
  type CatalogBook,
} from "../../lib/catalog";
import { fetchShelfEntry, putShelfEntry } from "../../lib/library";
import { useAccountFeatures } from "../auth/useAccountFeatures";
import { useStoredSession } from "../auth/useStoredSession";
import { CatalogCover } from "./CatalogCover";
import "./catalog.css";

type ShelfState = "unknown" | "checking" | "off" | "on" | "busy";

export function PublicBookPage() {
  const { bookKey = "" } = useParams<{ bookKey: string }>();
  const { session } = useStoredSession();
  const { capabilities } = useAccountFeatures(session);
  const libraryEnabled = hasFeature(capabilities, "library");
  const groupsEnabled = GROUPS_AVAILABLE && hasFeature(capabilities, "groups");

  const [book, setBook] = useState<CatalogBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shelf, setShelf] = useState<ShelfState>("unknown");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getCatalogBook(bookKey)
      .then((loaded) => {
        if (alive) setBook(loaded);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível abrir o livro.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookKey]);

  useEffect(() => {
    if (!session || !book || !libraryEnabled) {
      setShelf("unknown");
      return;
    }
    let alive = true;
    setShelf("checking");
    // Só vale enquanto ainda está verificando: se a pessoa adicionou antes da resposta chegar,
    // o "não está" atrasado não pode devolver o botão para "Adicionar".
    const settle = (next: ShelfState) => setShelf((current) => (current === "checking" ? next : current));
    fetchShelfEntry(session, book.book_key)
      .then(() => {
        if (alive) settle("on");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiHttpError && err.status === 404) settle("off");
        else settle("unknown");
      });
    return () => {
      alive = false;
    };
  }, [session, book, libraryEnabled]);

  async function addToShelf() {
    if (!session || !book) return;
    setShelf("busy");
    setMessage("");
    try {
      await putShelfEntry(session, book.book_key, {
        source: "catalog",
        status: "want_to_read",
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        genre: book.genre,
        series: book.series,
        seriesIndex: book.series_index,
        language: book.language,
        baseUpdatedAt: null,
      });
      setShelf("on");
      setMessage("Livro adicionado à sua estante.");
    } catch (err: unknown) {
      if (err instanceof ApiHttpError && err.status === 409) {
        setShelf("on");
        setMessage("Este livro já está na sua estante.");
        return;
      }
      setShelf("off");
      setMessage(err instanceof Error ? err.message : "Não foi possível adicionar à estante.");
    }
  }

  function readerHref(chat: boolean): string {
    const params = new URLSearchParams({ abrir: bookKey });
    if (chat) params.set("chat", "1");
    if (!session) params.set("login", "1");
    return `/?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="page-status">
        <span className="spinner" aria-hidden="true" />
        Carregando livro…
      </div>
    );
  }

  if (!book) {
    return (
      <div className="home">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/biblioteca">
            Voltar
          </Link>
        </nav>
        <section className="shelf">
          <p className="auth-error" role="alert">
            {error || "Livro não encontrado."}
          </p>
        </section>
      </div>
    );
  }

  const ebook = catalogBookToEbook(book);
  const rights = catalogRightsLabel(book.rights);
  const meta = [
    book.genre,
    book.language === "en" ? "Inglês" : "Português",
    book.page_count
      ? `${book.page_count} ${book.page_count === 1 ? "página" : "páginas"}`
      : null,
    book.series
      ? `${book.series}${book.series_index != null ? ` #${book.series_index}` : ""}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/biblioteca">
          Voltar
        </Link>
      </nav>

      <section className="shelf catalog-book-detail">
        <div className="catalog-book-layout">
          <div className="catalog-book-cover">
            <CatalogCover book={ebook} />
          </div>

          <div className="catalog-book-info">
            <span className="eyebrow">Biblioteca pública</span>
            <h1>{book.title}</h1>
            <p className="catalog-book-author">{book.author || "Autor não informado"}</p>
            <ReaderCount bookKey={book.book_key} className="is-large" />

            {meta.length > 0 ? (
              <div className="catalog-book-meta">
                {meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}

            {book.description ? <p className="catalog-book-description">{book.description}</p> : null}

            {book.collections?.length ? (
              <p className="catalog-book-rights">
                Coleções: {book.collections.map((item) => item.title).join(", ")}.
              </p>
            ) : null}

            {rights ? <p className="catalog-book-rights">Direitos: {rights}.</p> : null}

            <div className="catalog-book-actions">
              <Link className="btn btn-primary btn-lg" to={readerHref(false)}>
                Ler agora
              </Link>
              <Link className="btn" to={readerHref(true)}>
                Conversar com personagens
              </Link>

              {!session ? (
                <Link className="btn" to={readerHref(false)}>
                  Entrar para guardar na estante
                </Link>
              ) : libraryEnabled ? (
                shelf === "on" ? (
                  <button type="button" className="btn" disabled>
                    Na sua estante
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void addToShelf()}
                    disabled={shelf === "busy" || shelf === "checking"}
                  >
                    {shelf === "busy" ? "Adicionando…" : "Adicionar à estante"}
                  </button>
                )
              ) : null}
              {session && groupsEnabled ? (
                <Link
                  className="btn"
                  to={`/grupos?${new URLSearchParams({ livro: book.book_key, titulo: book.title })}`}
                >
                  Clubes deste livro
                </Link>
              ) : null}
            </div>

            {!session ? (
              <p className="muted catalog-book-note">
                Entre na sua conta para ler, conversar e guardar o livro na estante.
              </p>
            ) : !libraryEnabled ? (
              <p className="muted catalog-book-note">
                A estante está sendo liberada aos poucos. Você já pode ler e conversar.
              </p>
            ) : null}

            {message ? <p className="catalog-book-message">{message}</p> : null}
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
