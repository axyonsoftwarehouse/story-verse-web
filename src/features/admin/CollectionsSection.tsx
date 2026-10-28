import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { SupabaseSession } from "../../lib/auth";
import { useConfirm } from "../../components/ConfirmDialog";
import {
  catalogStatusLabel,
  collectionStatusLabel,
  collectionStatusTone,
  createCatalogCollection,
  deleteCatalogCollection,
  getCatalogCollection,
  listCatalogBooks,
  listCatalogCollections,
  setCatalogCollectionBooks,
  updateCatalogCollection,
  type AdminCatalogBook,
  type AdminCatalogCollection,
  type CatalogCollectionBook,
  type CatalogCollectionInput,
  type CatalogCollectionStatus,
} from "../../lib/adminCatalog";

type CollectionFormValue = CatalogCollectionInput;

const EMPTY_FORM: CollectionFormValue = {
  slug: "",
  title: "",
  description: "",
  status: "draft",
  sortOrder: 0,
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CollectionForm({
  session,
  collection,
  onClose,
  onSaved,
}: {
  session: SupabaseSession;
  collection: AdminCatalogCollection | null;
  onClose: () => void;
  onSaved: (collection: AdminCatalogCollection) => void;
}) {
  const [form, setForm] = useState<CollectionFormValue>(() =>
    collection
      ? {
          slug: collection.slug,
          title: collection.title,
          description: collection.description ?? "",
          status: collection.status,
          sortOrder: collection.sort_order,
        }
      : EMPTY_FORM,
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(collection));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(value: Partial<CollectionFormValue>) {
    setForm((current) => ({ ...current, ...value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
      setError("Endereço inválido: use letras minúsculas, números e hífen (2 a 80).");
      return;
    }
    if (form.title.trim().length < 2) {
      setError("Informe o título da coleção.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = collection
        ? await updateCatalogCollection(session, collection.id, { ...form, slug })
        : await createCatalogCollection(session, { ...form, slug });
      onSaved(saved);
    } catch (err) {
      setError(message(err, "Não foi possível salvar a coleção."));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section
        className="about-dialog catalog-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-form-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Acervo · coleções</span>
            <h2 id="collection-form-title">
              {collection ? "Editar coleção" : "Nova coleção"}
            </h2>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar" disabled={busy}>
            ×
          </button>
        </header>

        <form className="catalog-wizard-form" onSubmit={save}>
          <div className="catalog-form-grid">
            <label className="catalog-field is-wide">
              Título *
              <input
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
                }}
                maxLength={120}
                required
                disabled={busy}
              />
            </label>
            <label className="catalog-field is-wide">
              Endereço (slug) *
              <input
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  patch({ slug: event.target.value });
                }}
                maxLength={80}
                required
                disabled={busy}
                placeholder="classicos"
              />
            </label>
            <label className="catalog-field is-wide">
              Descrição
              <textarea
                value={form.description ?? ""}
                onChange={(event) => patch({ description: event.target.value })}
                rows={3}
                maxLength={1000}
                disabled={busy}
              />
            </label>
            <label className="catalog-field">
              Situação
              <select
                value={form.status}
                onChange={(event) =>
                  patch({ status: event.target.value as CatalogCollectionStatus })
                }
                disabled={busy}
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicada</option>
                <option value="hidden">Oculta</option>
              </select>
            </label>
            <label className="catalog-field">
              Ordem
              <input
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(event) => patch({ sortOrder: Number(event.target.value) })}
                disabled={busy}
              />
            </label>
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="catalog-wizard-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar coleção"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function CollectionBooks({
  session,
  collection,
  onClose,
  onSaved,
}: {
  session: SupabaseSession;
  collection: AdminCatalogCollection;
  onClose: () => void;
  onSaved: (collection: AdminCatalogCollection) => void;
}) {
  const [selected, setSelected] = useState<CatalogCollectionBook[]>(collection.books ?? []);
  const [loaded, setLoaded] = useState(Boolean(collection.books));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminCatalogBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loaded) return;
    let alive = true;
    getCatalogCollection(session, collection.id)
      .then((detail) => {
        if (alive) {
          setSelected(detail.books ?? []);
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(message(err, "Não foi possível abrir os livros da coleção."));
      });
    return () => {
      alive = false;
    };
  }, [session, collection.id, loaded]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError("");
    try {
      const page = await listCatalogBooks(session, { q: query }, 0, 50);
      setResults(page.items);
    } catch (err) {
      setError(message(err, "Não foi possível buscar os livros."));
    } finally {
      setSearching(false);
    }
  }

  const selectedIds = new Set(selected.map((book) => book.id));

  function toggle(book: Pick<AdminCatalogBook, "id" | "book_key" | "title" | "author" | "status" | "source">) {
    if (selectedIds.has(book.id)) {
      setSelected((current) => current.filter((item) => item.id !== book.id));
      return;
    }
    setSelected((current) => [
      ...current,
      {
        id: book.id,
        book_key: book.book_key,
        title: book.title,
        author: book.author,
        status: book.status,
        source: book.source,
      },
    ]);
  }

  function move(index: number, direction: -1 | 1) {
    setSelected((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function save() {
    if (!loaded) return;
    setBusy(true);
    setError("");
    try {
      const saved = await setCatalogCollectionBooks(
        session,
        collection.id,
        selected.map((book) => book.id),
      );
      onSaved(saved);
    } catch (err) {
      setError(message(err, "Não foi possível salvar os livros da coleção."));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section
        className="about-dialog catalog-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-books-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Coleção</span>
            <h2 id="collection-books-title">{collection.title}</h2>
            <p className="muted">A ordem abaixo é a ordem exibida na biblioteca.</p>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar" disabled={busy}>
            ×
          </button>
        </header>

        <div className="catalog-wizard-form">
          <form className="admin-search" onSubmit={search}>
            <label>
              Buscar livro
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, autor ou chave"
                autoComplete="off"
              />
            </label>
            <button className="btn" type="submit" disabled={searching}>
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </form>

          <div className="collection-books-grid">
            <div>
              <h3>Livros da coleção ({selected.length})</h3>
              {!loaded ? (
                <div className="page-status">
                  <span className="spinner" aria-hidden="true" />
                  Carregando…
                </div>
              ) : selected.length === 0 ? (
                <p className="muted">Nenhum livro ainda. Busque ao lado e marque.</p>
              ) : (
                <ol className="collection-selected">
                  {selected.map((book, index) => (
                    <li key={book.id} className="profile-card collection-book-row">
                      <span>
                        <strong>{book.title}</strong>
                        <span className="muted">{book.author || "Autor não informado"}</span>
                      </span>
                      <span className="catalog-actions-bar">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || busy}
                          aria-label={`Subir ${book.title}`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => move(index, 1)}
                          disabled={index === selected.length - 1 || busy}
                          aria-label={`Descer ${book.title}`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn profile-logout"
                          onClick={() => toggle(book)}
                          disabled={busy}
                        >
                          Remover
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <h3>Resultados da busca</h3>
              {results.length === 0 ? (
                <p className="muted">Busque um livro para incluir na coleção.</p>
              ) : (
                <ul className="admin-user-list">
                  {results.map((book) => (
                    <li key={book.id}>
                      <label className="collection-result">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(book.id)}
                          onChange={() => toggle(book)}
                          disabled={busy}
                        />
                        <span>
                          <strong>{book.title}</strong>
                          <span className="muted">
                            {book.author || "Autor não informado"} ·{" "}
                            {catalogStatusLabel(book.status)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="catalog-wizard-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={busy || !loaded}
            >
              {busy ? "Salvando…" : "Salvar livros"}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function CollectionsSection({ session }: { session: SupabaseSession }) {
  const [collections, setCollections] = useState<AdminCatalogCollection[] | null>(null);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<AdminCatalogCollection | "new" | null>(null);
  const [managing, setManaging] = useState<AdminCatalogCollection | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    listCatalogCollections(session)
      .then((list) => {
        if (alive) setCollections(list);
      })
      .catch((err: unknown) => {
        if (alive) setError(message(err, "Não foi possível carregar as coleções."));
      });
    return () => {
      alive = false;
    };
  }, [session, version]);

  function changed(saved: AdminCatalogCollection) {
    setCollections((current) => {
      if (!current) return current;
      const exists = current.some((item) => item.id === saved.id);
      return exists
        ? current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item))
        : [...current, saved].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    });
    setEditing(null);
    setManaging(null);
    setVersion((n) => n + 1);
  }

  async function remove(collection: AdminCatalogCollection) {
    if (
      !(await confirm({
        title: "Apagar a coleção?",
        message: `“${collection.title}” some, mas os livros continuam no catálogo.`,
        confirmLabel: "Apagar coleção",
        danger: true,
      }))
    ) {
      return;
    }
    setError("");
    try {
      await deleteCatalogCollection(session, collection.id);
      setCollections((current) => current?.filter((item) => item.id !== collection.id) ?? current);
    } catch (err) {
      setError(message(err, "Não foi possível apagar a coleção."));
    }
  }

  return (
    <section className="shelf admin-catalog">
      <div className="shelf-head">
        <div>
          <h2>Coleções</h2>
          <p className="muted">Agrupe livros e defina a ordem na biblioteca.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          Nova coleção
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {collections === null ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando coleções…
        </div>
      ) : collections.length === 0 ? (
        <p className="profile-empty">
          Nenhuma coleção ainda. Crie “Clássicos” ou “Para começar” para organizar o acervo.
        </p>
      ) : (
        <ul className="admin-user-list">
          {collections.map((collection) => (
            <li key={collection.id}>
              <div className="admin-user-row">
                <span>
                  <strong>{collection.title}</strong>
                  <span className="muted">
                    /{collection.slug} · {collection.book_count ?? 0}{" "}
                    {(collection.book_count ?? 0) === 1 ? "livro" : "livros"} · ordem{" "}
                    {collection.sort_order}
                  </span>
                </span>
                <span className="admin-user-flags">
                  <span className={`status-chip ${collectionStatusTone(collection.status)}`}>
                    {collectionStatusLabel(collection.status)}
                  </span>
                  <button type="button" className="btn" onClick={() => setManaging(collection)}>
                    Livros
                  </button>
                  <button type="button" className="btn" onClick={() => setEditing(collection)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn profile-logout"
                    onClick={() => void remove(collection)}
                  >
                    Apagar
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <CollectionForm
          session={session}
          collection={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={changed}
        />
      ) : null}

      {managing ? (
        <CollectionBooks
          session={session}
          collection={managing}
          onClose={() => setManaging(null)}
          onSaved={changed}
        />
      ) : null}
      {dialog}
    </section>
  );
}
