import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  CATALOG_ACCEPT,
  catalogErrorMessage,
  catalogMetadataProblem as metadataProblem,
  catalogRightsLabel,
  catalogRightsProblem as rightsProblem,
  checkCatalogFile,
  createCatalogBook,
  isDuplicateBookError,
  uploadCatalogOriginal,
  type AdminCatalogBook,
  type CatalogBookInput,
  type CatalogUpload,
} from "../../lib/adminCatalog";
import { MAX_INPUT_BYTES, dataUrlToBlob, prepareImage, uploadBookCover } from "../../lib/profileMedia";
import { importBookFile } from "../../lib/importBook";
import { CatalogMetadataFields, CatalogRightsFields } from "./CatalogFields";
import {
  EMPTY_METADATA,
  type CatalogMetadataValue,
  type CatalogRightsValue,
} from "./catalogFormValues";

type Draft = CatalogMetadataValue &
  CatalogRightsValue & {
    featured: boolean;
    sortOrder: string;
    publishNow: boolean;
  };

const STEPS = ["Arquivo", "Metadados", "Direitos", "Capa e publicação"];
const LAST_STEP = STEPS.length - 1;

const EMPTY_DRAFT: Draft = {
  ...EMPTY_METADATA,
  rights: "public_domain",
  rightsNote: "",
  featured: false,
  sortOrder: "0",
  publishNow: false,
};

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function toInput(draft: Draft, coverUrl: string | null): CatalogBookInput {
  return {
    title: draft.title.trim(),
    author: draft.author.trim() || undefined,
    genre: draft.genre.trim() || undefined,
    language: draft.language,
    series: draft.series.trim() || undefined,
    seriesIndex: draft.seriesIndex.trim() ? Number(draft.seriesIndex) : null,
    description: draft.description.trim() || undefined,
    pageCount: draft.pageCount.trim() ? Number(draft.pageCount) : undefined,
    rights: draft.rights,
    rightsNote: draft.rightsNote.trim() || undefined,
    coverUrl,
    status: draft.publishNow ? "published" : "draft",
    featured: draft.featured,
    sortOrder: draft.sortOrder.trim() ? Number(draft.sortOrder) : 0,
  };
}

export function CatalogBookForm({
  session,
  onClose,
  onCreated,
}: {
  session: SupabaseSession;
  onClose: () => void;
  onCreated: (book: AdminCatalogBook) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<CatalogUpload | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState("");
  const [parsing, setParsing] = useState(false);
  const parseToken = useRef(0);
  const coverTouched = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    try {
      checkCatalogFile(picked);
    } catch (err) {
      setError(catalogErrorMessage(err, "Arquivo inválido."));
      return;
    }
    setFile(picked);
    setUploaded(null);
    setError("");
    setDuplicate("");
    // Reaproveita o leitor do app: lê título, autor, idioma e capa do arquivo.
    const token = ++parseToken.current;
    const ext = picked.name.toLowerCase().split(".").pop();
    if (!["txt", "md", "markdown", "epub", "pdf"].includes(ext ?? "")) return;
    setParsing(true);
    void importBookFile(picked)
      .then(async (parsed) => {
        if (token !== parseToken.current) return;
        setDraft((current) => ({
          ...current,
          title: current.title.trim() ? current.title : parsed.title,
          author: current.author.trim() ? current.author : parsed.author,
          language:
            current.language === EMPTY_METADATA.language ? parsed.language : current.language,
        }));
        if (parsed.cover && !coverTouched.current) {
          const blob = await dataUrlToBlob(parsed.cover);
          if (token !== parseToken.current) return;
          setCoverFile(new File([blob], "capa.jpg", { type: blob.type || "image/jpeg" }));
          setCoverPreview(parsed.cover);
        }
      })
      .catch(() => {
        // Arquivo sem metadados/texto suficiente: os campos continuam para preencher à mão.
      })
      .finally(() => {
        if (token === parseToken.current) setParsing(false);
      });
  }

  function pickCover(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (picked.size > MAX_INPUT_BYTES) {
      setError("Imagem grande demais (máximo de 25 MB).");
      return;
    }
    coverTouched.current = true;
    setCoverFile(picked);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(picked));
    setError("");
  }

  function removeCover() {
    coverTouched.current = false;
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview("");
    setCoverUrl(null);
  }

  function problemAt(index: number): string {
    if (index === 0) return file ? "" : "Escolha o arquivo do livro.";
    if (index === 1) return metadataProblem(draft);
    if (index === 2) return rightsProblem(draft);
    return "";
  }

  function next() {
    const problem = problemAt(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, LAST_STEP));
  }

  function back() {
    setError("");
    setDuplicate("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function save(forceDuplicate: boolean) {
    if (busy || !file) return;
    setBusy(true);
    setError("");
    setDuplicate("");
    try {
      let original = uploaded;
      if (!original) {
        original = await uploadCatalogOriginal(session, file);
        setUploaded(original);
      }
      let cover = coverUrl;
      if (!cover && coverFile) {
        cover = await uploadBookCover(session, await prepareImage(coverFile, "book"));
        setCoverUrl(cover);
      }
      const book = await createCatalogBook(session, toInput(draft, cover), original, {
        allowDuplicate: forceDuplicate,
      });
      onCreated(book);
    } catch (err) {
      if (!forceDuplicate && isDuplicateBookError(err)) {
        setDuplicate(catalogErrorMessage(err, "Já existe um livro com este texto."));
        return;
      }
      setError(catalogErrorMessage(err, "Não foi possível salvar o livro."));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    for (let index = 0; index <= LAST_STEP; index += 1) {
      const problem = problemAt(index);
      if (problem) {
        setStep(index);
        setError(problem);
        return;
      }
    }
    void save(false);
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
        aria-labelledby="catalog-wizard-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Acervo · novo livro</span>
            <h2 id="catalog-wizard-title">{STEPS[step]}</h2>
            <p className="muted">
              Passo {step + 1} de {STEPS.length}
            </p>
          </div>
          <button
            type="button"
            className="auth-close"
            onClick={onClose}
            aria-label="Fechar cadastro"
            disabled={busy}
          >
            ×
          </button>
        </header>

        <ol className="catalog-steps" aria-label="Etapas do cadastro">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? "is-current" : index < step ? "is-done" : ""}
              aria-current={index === step ? "step" : undefined}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <form onSubmit={submit} className="catalog-wizard-form">
          {step === 0 ? (
            <div className="catalog-file">
              <label className="catalog-file-pick">
                <span>Arquivo do livro</span>
                <input type="file" accept={CATALOG_ACCEPT} onChange={pickFile} disabled={busy} />
              </label>
              <p className="muted">
                TXT, MD, EPUB ou PDF, até 50 MB. O app lê título, autor, idioma e capa do arquivo
                quando existirem; o servidor extrai o texto e guarda o original. O layout do
                PDF/EPUB não é preservado.
              </p>
              {file ? (
                <p className="catalog-file-summary">
                  <strong>{file.name}</strong>
                  <span className="muted">{megabytes(file.size)}</span>
                </p>
              ) : null}
              {parsing ? <p className="muted">Lendo metadados do arquivo…</p> : null}
            </div>
          ) : null}

          {step === 1 ? (
            <CatalogMetadataFields
              value={draft}
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              disabled={busy}
            />
          ) : null}

          {step === 2 ? (
            <CatalogRightsFields
              value={draft}
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              disabled={busy}
            />
          ) : null}

          {step === 3 ? (
            <div className="catalog-publish">
              <div className="catalog-cover-row">
                <div className="catalog-cover-preview">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Prévia da capa" />
                  ) : (
                    <span className="muted">Sem capa</span>
                  )}
                </div>
                <div className="catalog-cover-actions">
                  <label className="btn">
                    Escolher capa
                    <input type="file" accept="image/*" onChange={pickCover} disabled={busy} />
                  </label>
                  {coverPreview ? (
                    <button type="button" className="btn" onClick={removeCover} disabled={busy}>
                      Remover capa
                    </button>
                  ) : null}
                  <span className="muted">
                    JPG, PNG ou WebP. A imagem é recortada em 2:3. Sem capa, o site desenha uma.
                  </span>
                </div>
              </div>

              <div className="catalog-publish-options">
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, featured: event.target.checked }))
                    }
                    disabled={busy}
                  />
                  Destacar na home
                </label>

                <label className="catalog-field">
                  Ordem do destaque
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>

                <div className="catalog-field is-wide">
                  Ao salvar
                  <div className="segmented" role="radiogroup" aria-label="Situação ao salvar">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!draft.publishNow}
                      className={!draft.publishNow ? "is-on" : ""}
                      onClick={() => setDraft((current) => ({ ...current, publishNow: false }))}
                      disabled={busy}
                    >
                      Rascunho
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draft.publishNow}
                      className={draft.publishNow ? "is-on" : ""}
                      onClick={() => setDraft((current) => ({ ...current, publishNow: true }))}
                      disabled={busy}
                    >
                      Publicar agora
                    </button>
                  </div>
                </div>
              </div>

              <ul className="catalog-summary">
                <li>
                  <span>Arquivo</span>
                  <strong>{file?.name ?? "—"}</strong>
                </li>
                <li>
                  <span>Título</span>
                  <strong>{draft.title.trim() || "—"}</strong>
                </li>
                <li>
                  <span>Direitos</span>
                  <strong>{catalogRightsLabel(draft.rights)}</strong>
                </li>
                <li>
                  <span>Situação</span>
                  <strong>{draft.publishNow ? "Publicado" : "Rascunho"}</strong>
                </li>
              </ul>
            </div>
          ) : null}

          {duplicate ? (
            <div className="catalog-duplicate" role="alert">
              <p>{duplicate}</p>
              <button
                type="button"
                className="btn"
                onClick={() => void save(true)}
                disabled={busy}
              >
                Criar mesmo assim
              </button>
            </div>
          ) : error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="catalog-wizard-actions">
            {step > 0 ? (
              <button type="button" className="btn" onClick={back} disabled={busy}>
                Voltar
              </button>
            ) : null}
            <span className="catalog-step-count" aria-hidden="true">
              {step + 1}/{STEPS.length}
            </span>
            {step < LAST_STEP ? (
              <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
                Continuar
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : draft.publishNow
                    ? "Publicar livro"
                    : "Salvar rascunho"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
