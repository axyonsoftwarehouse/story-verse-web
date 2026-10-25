import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  catalogChars,
  catalogDate,
  catalogErrorMessage,
  catalogMetadataProblem,
  catalogRightsLabel,
  catalogRightsProblem,
  catalogSourceLabel,
  catalogStatusLabel,
  catalogStatusTone,
  deleteCatalogBook,
  getCatalogBook,
  replaceCatalogBookText,
  setCatalogBookStatus,
  updateCatalogBook,
  updateCatalogBookCover,
  uploadCatalogOriginal,
  type AdminCatalogBook,
  type CatalogBookInput,
} from "../../lib/adminCatalog";
import { prepareImage, uploadBookCover } from "../../lib/profileMedia";
import { CatalogMetadataFields, CatalogRightsFields } from "./CatalogFields";
import {
  EMPTY_METADATA,
  type CatalogMetadataValue,
  type CatalogRightsValue,
} from "./catalogFormValues";
import { useConfirm } from "../../components/ConfirmDialog";
import { CatalogPreview } from "./CatalogPreview";
import { isSuperadmin } from "./adminSections";

type Form = CatalogMetadataValue &
  CatalogRightsValue & {
    featured: boolean;
    sortOrder: string;
    coverUrl: string | null;
  };

const EMPTY_FORM: Form = {
  ...EMPTY_METADATA,
  rights: "public_domain",
  rightsNote: "",
  featured: false,
  sortOrder: "0",
  coverUrl: null,
};

function fromBook(book: AdminCatalogBook): Form {
  return {
    title: book.title,
    author: book.author ?? "",
    genre: book.genre ?? "",
    language: book.language,
    series: book.series ?? "",
    seriesIndex: book.series_index == null ? "" : String(book.series_index),
    description: book.description ?? "",
    pageCount: book.page_count == null ? "" : String(book.page_count),
    rights: book.rights,
    rightsNote: book.rights_note ?? "",
    featured: book.featured,
    sortOrder: String(book.sort_order),
    coverUrl: book.cover_url,
  };
}

function toInput(form: Form): CatalogBookInput {
  return {
    title: form.title.trim(),
    author: form.author.trim() || undefined,
    genre: form.genre.trim() || undefined,
    language: form.language,
    series: form.series.trim() || undefined,
    seriesIndex: form.seriesIndex.trim() ? Number(form.seriesIndex) : null,
    description: form.description.trim() || undefined,
    pageCount: form.pageCount.trim() ? Number(form.pageCount) : undefined,
    rights: form.rights,
    rightsNote: form.rightsNote.trim() || undefined,
    coverUrl: form.coverUrl,
    featured: form.featured,
    sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : 0,
  };
}

export function CatalogBookPage({
  session,
  roles,
}: {
  session: SupabaseSession;
  roles: string[];
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<AdminCatalogBook | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Livro não informado.");
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    setMessage("");
    getCatalogBook(session, id)
      .then((loaded) => {
        if (!alive) return;
        setBook(loaded);
        setForm(fromBook(loaded));
      })
      .catch((err) => {
        if (alive) setError(catalogErrorMessage(err, "Não foi possível abrir o livro."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, id]);

  function patch(patchValue: Partial<Form>) {
    setForm((current) => ({ ...current, ...patchValue }));
  }

  async function save() {
    if (!book) return;
    const problem = catalogMetadataProblem(form) || catalogRightsProblem(form);
    if (problem) {
      setError(problem);
      setMessage("");
      return;
    }
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const updated = await updateCatalogBook(session, book.id, toInput(form));
      setBook(updated);
      setForm(fromBook(updated));
      setMessage("Alterações salvas.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível salvar as alterações."));
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(action: "publish" | "hide" | "archive") {
    if (!book) return;
    if (
      action === "publish" &&
      !(await confirm({
        title: "Publicar o livro?",
        message: `“${book.title}” passa a aparecer na biblioteca pública, para qualquer visitante.`,
        confirmLabel: "Publicar livro",
      }))
    ) {
      return;
    }
    if (
      action === "hide" &&
      !(await confirm({
        title: "Ocultar da biblioteca?",
        message: `“${book.title}” sai da biblioteca. Quem já colocou na estante continua lendo.`,
        confirmLabel: "Ocultar livro",
        danger: true,
      }))
    ) {
      return;
    }
    if (
      action === "archive" &&
      !(await confirm({
        title: "Arquivar o livro?",
        message: `“${book.title}” sai da biblioteca, mas o arquivo e a estante de quem leu continuam guardados.`,
        confirmLabel: "Arquivar livro",
        danger: true,
      }))
    ) {
      return;
    }
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const updated = await setCatalogBookStatus(session, book.id, action);
      setBook(updated);
      setMessage(
        action === "publish"
          ? "Livro publicado na biblioteca."
          : action === "hide"
            ? "Livro oculto da biblioteca."
            : "Livro arquivado.",
      );
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível mudar a situação do livro."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!book) return;
    if (
      !(await confirm({
        title: "Apagar definitivamente?",
        message: `“${book.title}” e o arquivo serão apagados; a estante de quem leu perde o livro.`,
        confirmLabel: "Apagar livro",
        danger: true,
      }))
    ) {
      return;
    }
    setBusy("delete");
    setError("");
    try {
      await deleteCatalogBook(session, book.id);
      navigate("/admin/acervo");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível apagar o livro."));
      setBusy(null);
    }
  }

  async function changeCover(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked || !book) return;
    if (!picked.type.startsWith("image/")) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    setBusy("cover");
    setError("");
    setMessage("");
    try {
      const url = await uploadBookCover(session, await prepareImage(picked, "book"));
      const updated = await updateCatalogBookCover(session, book.id, url);
      setBook(updated);
      setForm(fromBook(updated));
      setMessage("Capa atualizada.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível trocar a capa."));
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    if (
      !book ||
      !(await confirm({
        title: "Remover a capa?",
        message: "O livro fica sem capa até você enviar outra.",
        confirmLabel: "Remover capa",
        danger: true,
      }))
    )
      return;
    setBusy("cover");
    setError("");
    setMessage("");
    try {
      const updated = await updateCatalogBookCover(session, book.id, null);
      setBook(updated);
      setForm(fromBook(updated));
      setMessage("Capa removida.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível remover a capa."));
    } finally {
      setBusy(null);
    }
  }

  async function replaceText(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked || !book) return;
    if (
      !(await confirm({
        title: "Substituir o texto?",
        message: "A versão anterior deixa de ser usada.",
        confirmLabel: "Substituir texto",
        danger: true,
      }))
    ) {
      return;
    }
    setBusy("text");
    setError("");
    setMessage("");
    try {
      const original = await uploadCatalogOriginal(session, picked);
      const updated = await replaceCatalogBookText(session, book.id, original);
      setBook(updated);
      setForm(fromBook(updated));
      setMessage("Texto substituído. A prévia já mostra a nova versão.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível substituir o texto."));
    } finally {
      setBusy(null);
    }
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
      <section className="shelf">
        <p className="auth-error" role="alert">
          {error || "Livro não encontrado."}
        </p>
        <Link className="btn" to="/admin/acervo">
          Voltar ao acervo
        </Link>
      </section>
    );
  }

  const disabled = Boolean(busy);
  const superadmin = isSuperadmin(roles);

  return (
    <section className="shelf admin-catalog-detail">
      <div className="catalog-detail-head">
        <Link className="btn" to="/admin/acervo">
          ← Acervo
        </Link>
        <div className="catalog-detail-title">
          <h1>{book.title}</h1>
          <div className="catalog-detail-chips">
            <span className={`status-chip ${catalogStatusTone(book.status)}`}>
              {catalogStatusLabel(book.status)}
            </span>
            <span className="muted">{book.book_key}</span>
            <span className="muted">{catalogSourceLabel(book.source)}</span>
          </div>
        </div>
      </div>

      <div className="catalog-detail-grid">
        <aside className="catalog-detail-cover">
          <div className="catalog-cover-art">
            {book.cover_url ? (
              <img src={book.cover_url} alt="" />
            ) : (
              <span>{book.title}</span>
            )}
          </div>

          <label className={`btn catalog-file-action ${disabled ? "is-disabled" : ""}`}>
            {busy === "cover" ? "Enviando…" : "Trocar capa"}
            <input type="file" accept="image/*" onChange={changeCover} disabled={disabled} />
          </label>
          {book.cover_url ? (
            <button type="button" className="btn" onClick={removeCover} disabled={disabled}>
              Remover capa
            </button>
          ) : null}

          <dl className="catalog-facts">
            <div>
              <dt>Texto</dt>
              <dd>{catalogChars(book.char_count)}</dd>
            </div>
            <div>
              <dt>Páginas</dt>
              <dd>{book.page_count ?? "—"}</dd>
            </div>
            <div>
              <dt>Direitos</dt>
              <dd>{catalogRightsLabel(book.rights)}</dd>
            </div>
            <div>
              <dt>Criado</dt>
              <dd>{catalogDate(book.created_at)}</dd>
            </div>
            <div>
              <dt>Atualizado</dt>
              <dd>{catalogDate(book.updated_at)}</dd>
            </div>
            <div>
              <dt>Publicado</dt>
              <dd>{catalogDate(book.published_at)}</dd>
            </div>
          </dl>
        </aside>

        <div className="catalog-detail-main">
          <div className="profile-card catalog-edit-card">
            <h2>Metadados</h2>
            <CatalogMetadataFields value={form} onChange={patch} disabled={disabled} />
            <CatalogRightsFields value={form} onChange={patch} disabled={disabled} />
            <div className="catalog-publish-options">
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => patch({ featured: event.target.checked })}
                  disabled={disabled}
                />
                Destacar na home
              </label>
              <label className="catalog-field">
                Ordem do destaque
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => patch({ sortOrder: event.target.value })}
                  disabled={disabled}
                />
              </label>
            </div>
          </div>

          <div className="profile-card catalog-actions-card">
            <h2>Situação e ações</h2>
            <p className="muted">
              Publicado aparece na biblioteca; oculto some sem apagar; arquivado sai do catálogo e
              mantém o arquivo para auditoria.
            </p>

            <div className="catalog-actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void save()}
                disabled={disabled}
              >
                {busy === "save" ? "Salvando…" : "Salvar alterações"}
              </button>

              {book.status !== "published" ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void changeStatus("publish")}
                  disabled={disabled}
                >
                  Publicar
                </button>
              ) : null}

              {book.status === "published" ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void changeStatus("hide")}
                  disabled={disabled}
                >
                  Ocultar
                </button>
              ) : null}

              {book.status !== "archived" ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void changeStatus("archive")}
                  disabled={disabled}
                >
                  Arquivar
                </button>
              ) : null}

              <button type="button" className="btn" onClick={() => setPreview(true)}>
                Prévia do texto
              </button>

              <label className={`btn catalog-file-action ${disabled ? "is-disabled" : ""}`}>
                {busy === "text" ? "Enviando…" : "Substituir arquivo"}
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.pdf,.epub,text/plain,text/markdown,application/pdf,application/epub+zip"
                  onChange={replaceText}
                  disabled={disabled}
                />
              </label>

              {superadmin ? (
                <button
                  type="button"
                  className="btn profile-logout"
                  onClick={() => void remove()}
                  disabled={disabled}
                >
                  {busy === "delete" ? "Apagando…" : "Apagar"}
                </button>
              ) : null}
            </div>

            {message ? <p className="catalog-message">{message}</p> : null}
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {preview ? (
        <CatalogPreview session={session} book={book} onClose={() => setPreview(false)} />
      ) : null}
      {dialog}
    </section>
  );
}
