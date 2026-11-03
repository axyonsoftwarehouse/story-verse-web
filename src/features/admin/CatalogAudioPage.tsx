import { useEffect, useState, type ChangeEvent } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  AUDIO_ACCEPT,
  audioEditionStatusLabel,
  audioEditionStatusTone,
  audioSourceLabel,
  chapterTitleFromFile,
  checkAudioFile,
  createAudioEdition,
  deleteAudioEdition,
  formatAudioClock,
  formatAudioDuration,
  listAudioEditions,
  parseAudioClock,
  probeAudioDuration,
  registerAudioChapter,
  requestAudioUpload,
  setAudioEditionStatus,
  updateAudioChapter,
  updateAudioEdition,
  uploadAudioFile,
  type AdminAudioChapter,
  type AdminAudioEdition,
  type AudioChapterPatch,
  type AudioEditionInput,
  type AudioSource,
  type AudioTextMapping,
} from "../../lib/adminAudiobooks";
import {
  catalogErrorMessage,
  catalogRightsLabel,
  fetchCatalogText,
  getCatalogBook,
  type AdminCatalogBook,
  type CatalogRights,
} from "../../lib/adminCatalog";
import { splitIntoChapters, type StoryChapter } from "../../lib/chapters";
import { useConfirm } from "../../components/ConfirmDialog";
import { isSuperadmin } from "./adminSections";

type EditionForm = {
  language: "pt" | "en";
  narrator: string;
  source: AudioSource;
  sourceUrl: string;
  rights: CatalogRights;
  rightsNote: string;
  licenseNote: string;
  textMapping: AudioTextMapping;
};

const SOURCE_OPTIONS: AudioSource[] = ["librivox", "admin", "partner"];
const RIGHTS_OPTIONS: CatalogRights[] = ["public_domain", "own_work", "free_license"];
const TEXT_MAPPING_OPTIONS: { value: AudioTextMapping; label: string }[] = [
  { value: "pending", label: "Pendente (não publica)" },
  { value: "mapped", label: "Mapeado para o texto" },
  { value: "none", label: "Sem texto (sem chat contextual)" },
];

function emptyForm(book: AdminCatalogBook | null): EditionForm {
  return {
    language: book?.language ?? "pt",
    narrator: "",
    source: "librivox",
    sourceUrl: "",
    rights: book?.rights ?? "public_domain",
    rightsNote: book?.rights_note ?? "",
    licenseNote: "LibriVox · domínio público",
    textMapping: "pending",
  };
}

function fromEdition(edition: AdminAudioEdition): EditionForm {
  return {
    language: edition.language,
    narrator: edition.narrator ?? "",
    source: edition.source,
    sourceUrl: edition.source_url ?? "",
    rights: edition.rights,
    rightsNote: edition.rights_note ?? "",
    licenseNote: edition.license_note ?? "",
    textMapping: edition.text_mapping ?? "pending",
  };
}

function toInput(form: EditionForm): AudioEditionInput {
  return {
    language: form.language,
    narrator: form.narrator.trim() || undefined,
    source: form.source,
    sourceUrl: form.sourceUrl.trim() || undefined,
    rights: form.rights,
    rightsNote: form.rightsNote.trim() || undefined,
    licenseNote: form.licenseNote.trim() || undefined,
    textMapping: form.textMapping,
  };
}

function chapterEnd(chapter: AdminAudioChapter): number {
  return chapter.end_seconds ?? chapter.start_seconds + chapter.duration_seconds;
}

function textChapterLabel(chapters: StoryChapter[] | null, index: number | null): string {
  if (index == null || !chapters) return "Sem texto";
  const chapter = chapters[index - 1];
  return chapter ? `${index}. ${chapter.label}` : `${index}.`;
}

export function CatalogAudioPage({
  session,
  roles,
}: {
  session: SupabaseSession;
  roles: string[];
}) {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<AdminCatalogBook | null>(null);
  const [editions, setEditions] = useState<AdminAudioEdition[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EditionForm>(emptyForm(null));
  const [textChapters, setTextChapters] = useState<StoryChapter[] | null>(null);
  const [textError, setTextError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [newChapter, setNewChapter] = useState({ title: "", start: "", end: "" });
  const [timeEditIndex, setTimeEditIndex] = useState<number | null>(null);
  const [timeDraft, setTimeDraft] = useState({ title: "", start: "", end: "" });
  const { confirm, dialog } = useConfirm();

  const selected = editions?.find((edition) => edition.id === selectedId) ?? null;
  const chapters = selected
    ? [...selected.chapters].sort((a, b) => a.chapter_index - b.chapter_index)
    : [];
  const sameAudioPath = new Set(chapters.map((chapter) => chapter.audio_path)).size === 1;
  const disabled = Boolean(busy) || Boolean(uploading);
  const superadmin = isSuperadmin(roles);
  const textMappingReady =
    selected?.text_mapping === "none" ||
    (selected?.text_mapping === "mapped" &&
      chapters.some((chapter) => chapter.text_chapter_index !== null));

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
    setTextChapters(null);
    setTextError("");
    Promise.allSettled([getCatalogBook(session, id), listAudioEditions(session, id)])
      .then(([bookResult, audioResult]) => {
        if (!alive) return;
        if (bookResult.status === "fulfilled") {
          setBook(bookResult.value);
          setForm(emptyForm(bookResult.value));
        } else {
          setError(catalogErrorMessage(bookResult.reason, "Não foi possível abrir o livro."));
        }
        if (audioResult.status === "fulfilled") {
          setEditions(audioResult.value);
          const first = audioResult.value[0] ?? null;
          setSelectedId(first?.id ?? null);
          if (first) setForm(fromEdition(first));
        } else {
          setEditions([]);
          setError((current) =>
            current ||
            catalogErrorMessage(audioResult.reason, "Não foi possível carregar as edições de áudio."),
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, id]);

  useEffect(() => {
    if (!book) return;
    let alive = true;
    fetchCatalogText(session, book)
      .then((text) => {
        if (alive) setTextChapters(splitIntoChapters(text));
      })
      .catch((err) => {
        if (alive) setTextError(catalogErrorMessage(err, "Não foi possível carregar os capítulos do texto."));
      });
    return () => {
      alive = false;
    };
  }, [session, book]);

  function selectEdition(edition: AdminAudioEdition) {
    setSelectedId(edition.id);
    setForm(fromEdition(edition));
    setError("");
    setMessage("");
  }

  function startNewEdition() {
    setSelectedId(null);
    setForm(emptyForm(book));
    setError("");
    setMessage("");
  }

  async function refresh(preferredId?: string) {
    if (!id) return;
    const next = await listAudioEditions(session, id);
    setEditions(next);
    const chosen = next.find((edition) => edition.id === (preferredId ?? selectedId)) ?? next[0] ?? null;
    setSelectedId(chosen?.id ?? null);
    setForm(chosen ? fromEdition(chosen) : emptyForm(book));
  }

  async function saveEdition() {
    if (!book) return;
    if (form.rights !== "public_domain" && form.rightsNote.trim().length < 3) {
      setError("Explique por que este áudio pode ser publicado.");
      setMessage("");
      return;
    }
    setBusy("edition");
    setError("");
    setMessage("");
    try {
      const saved = selected
        ? await updateAudioEdition(session, selected.id, toInput(form))
        : await createAudioEdition(session, book.id, toInput(form));
      await refresh(saved.id);
      setMessage(selected ? "Edição salva." : "Edição de áudio criada.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível salvar a edição de áudio."));
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(action: "publish" | "hide") {
    if (!selected) return;
    if (
      action === "publish" &&
      !(await confirm({
        title: "Publicar o audiolivro?",
        message: "O capítulo 1 fica aberto e os demais exigem assinatura. Confira o mapeamento antes.",
        confirmLabel: "Publicar áudio",
      }))
    ) {
      return;
    }
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await setAudioEditionStatus(session, selected.id, action);
      await refresh(selected.id);
      setMessage(action === "publish" ? "Audiolivro publicado." : "Audiolivro oculto.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível mudar a situação do audiolivro."));
    } finally {
      setBusy(null);
    }
  }

  async function removeEdition() {
    if (
      !selected ||
      !(await confirm({
        title: "Remover a edição de áudio?",
        message: `A edição “${selected.narrator || "sem narrador"}” e os capítulos saem do ar.`,
        confirmLabel: "Remover áudio",
        danger: true,
      }))
    ) {
      return;
    }
    setBusy("delete");
    setError("");
    setMessage("");
    try {
      await deleteAudioEdition(session, selected.id);
      await refresh();
      setMessage("Edição de áudio removida.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível remover a edição de áudio."));
    } finally {
      setBusy(null);
    }
  }

  async function uploadChapters(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected || files.length === 0) return;
    try {
      files.forEach(checkAudioFile);
    } catch (err) {
      setError(catalogErrorMessage(err, "Arquivo de áudio inválido."));
      return;
    }
    const audioId = selected.id;
    setBusy("upload");
    setError("");
    setMessage("");
    setUploading({ done: 0, total: files.length });
    try {
      let nextIndex = Math.max(0, ...selected.chapters.map((chapter) => chapter.chapter_index)) + 1;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const kind = checkAudioFile(file);
        const duration = await probeAudioDuration(file);
        const target = await requestAudioUpload(session, audioId, file.name, kind.contentType, file.size);
        await uploadAudioFile(target.uploadUrl, file, kind.contentType);
        await registerAudioChapter(session, audioId, {
          path: target.path,
          chapterIndex: nextIndex,
          title: chapterTitleFromFile(file.name),
          durationSeconds: duration,
          startSeconds: 0,
          endSeconds: duration,
          sizeBytes: file.size,
        });
        nextIndex++;
        setUploading({ done: i + 1, total: files.length });
      }
      await refresh(audioId);
      setMessage(files.length === 1 ? "Capítulo enviado." : `${files.length} capítulos enviados.`);
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível enviar os capítulos."));
    } finally {
      setBusy(null);
      setUploading(null);
    }
  }

  async function addChapter() {
    if (!selected || chapters.length === 0) {
      setError("Envie primeiro o arquivo de áudio.");
      return;
    }
    const start = parseAudioClock(newChapter.start);
    const end = parseAudioClock(newChapter.end);
    if (start === null || end === null || end <= start) {
      setError("Informe início e fim válidos (o fim precisa ser maior que o início).");
      return;
    }
    const index = Math.max(...chapters.map((chapter) => chapter.chapter_index)) + 1;
    setBusy("chapter");
    setError("");
    setMessage("");
    try {
      await registerAudioChapter(session, selected.id, {
        path: chapters[0].audio_path,
        chapterIndex: index,
        title: newChapter.title.trim() || `Capítulo ${index}`,
        durationSeconds: end - start,
        startSeconds: start,
        endSeconds: end,
      });
      await refresh(selected.id);
      setNewChapter({ title: "", start: "", end: "" });
      setMessage("Capítulo adicionado ao arquivo.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível adicionar o capítulo."));
    } finally {
      setBusy(null);
    }
  }

  function startEditTimes(chapter: AdminAudioChapter) {
    setTimeEditIndex(chapter.chapter_index);
    setTimeDraft({
      title: chapter.title ?? "",
      start: formatAudioClock(chapter.start_seconds),
      end: formatAudioClock(chapterEnd(chapter)),
    });
    setError("");
    setMessage("");
  }

  function cancelEditTimes() {
    setTimeEditIndex(null);
  }

  async function saveTimes(chapter: AdminAudioChapter) {
    if (!selected) return;
    const start = parseAudioClock(timeDraft.start);
    const end = parseAudioClock(timeDraft.end);
    if (start === null || end === null || end <= start) {
      setError("Informe início e fim válidos (o fim precisa ser maior que o início).");
      return;
    }
    setBusy(`times-${chapter.chapter_index}`);
    setError("");
    setMessage("");
    try {
      await updateAudioChapter(session, selected.id, chapter.chapter_index, {
        title: timeDraft.title.trim() || undefined,
        startSeconds: start,
        endSeconds: end,
      });
      await refresh(selected.id);
      setTimeEditIndex(null);
      setMessage("Tempos do capítulo atualizados.");
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível salvar os tempos do capítulo."));
    } finally {
      setBusy(null);
    }
  }

  async function autoMap() {
    if (!selected || !textChapters || chapters.length === 0) return;
    if (textChapters.length === 0) {
      setError("O texto ainda não tem capítulos para mapear.");
      return;
    }
    const count = Math.min(chapters.length, textChapters.length);
    setBusy("map");
    setError("");
    setMessage("");
    try {
      for (let i = 0; i < count; i++) {
        await updateAudioChapter(session, selected.id, chapters[i].chapter_index, {
          textChapterIndex: i + 1,
          textChapterEndIndex: i + 1,
        });
      }
      await updateAudioEdition(session, selected.id, {
        ...toInput({ ...fromEdition(selected), textMapping: "mapped" }),
      });
      await refresh(selected.id);
      setMessage(
        count === chapters.length
          ? `${count} capítulo(s) mapeados pela ordem.`
          : `${count} de ${chapters.length} capítulos mapeados; o restante precisa de revisão.`,
      );
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível mapear os capítulos."));
    } finally {
      setBusy(null);
    }
  }

  async function changeMapping(
    chapter: AdminAudioChapter,
    field: "start" | "end",
    value: string,
  ) {
    if (!selected) return;
    const parsed = value ? Number(value) : null;
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) return;
    const patch: AudioChapterPatch =
      field === "start"
        ? { textChapterIndex: parsed }
        : { textChapterEndIndex: parsed };
    if (field === "start" && parsed === null) patch.textChapterEndIndex = null;
    if (field === "end" && parsed !== null && chapter.text_chapter_index === null) {
      patch.textChapterIndex = parsed;
    }
    if (
      field === "end" &&
      parsed !== null &&
      chapter.text_chapter_index !== null &&
      parsed < chapter.text_chapter_index
    ) {
      setError("O fim do mapeamento não pode ser antes do início.");
      return;
    }
    setBusy(`map-${chapter.chapter_index}`);
    setError("");
    setMessage("");
    try {
      const updated = await updateAudioChapter(session, selected.id, chapter.chapter_index, patch);
      setEditions((current) =>
        current?.map((edition) =>
          edition.id === selected.id
            ? {
                ...edition,
                chapters: edition.chapters.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }
            : edition,
        ) ?? current,
      );
    } catch (err) {
      setError(catalogErrorMessage(err, "Não foi possível salvar o mapeamento."));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="page-status">
        <span className="spinner" aria-hidden="true" />
        Carregando audiolivro…
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

  return (
    <section className="shelf admin-catalog-detail audio-admin">
      <nav className="segmented acervo-tabs" aria-label="Seções do livro">
        <NavLink
          to={`/admin/acervo/${book.id}`}
          end
          className={({ isActive }) => (isActive ? "is-on" : "")}
        >
          Detalhes
        </NavLink>
        <NavLink
          to={`/admin/acervo/${book.id}/audio`}
          className={({ isActive }) => (isActive ? "is-on" : "")}
        >
          Áudio
        </NavLink>
      </nav>

      <div className="catalog-detail-head">
        <Link className="btn" to={`/admin/acervo/${book.id}`}>
          Voltar ao livro
        </Link>
        <div className="catalog-detail-title">
          <h1>Audiolivro</h1>
          <p className="muted">
            {book.title}
            {book.author ? ` · ${book.author}` : ""}
          </p>
          <div className="catalog-detail-chips">
            <span className="muted">{book.book_key}</span>
            <span className="muted">
              {editions?.length ?? 0} edição(ões) de áudio
            </span>
            <span className="muted">
              {textChapters ? `${textChapters.length} capítulo(s) no texto` : "Carregando texto…"}
            </span>
          </div>
        </div>
      </div>

      {message ? <p className="catalog-message">{message}</p> : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="audio-layout">
        <aside className="profile-card audio-editions-panel">
          <div className="audio-panel-head">
            <h2>Edições</h2>
            <button type="button" className="btn" onClick={startNewEdition} disabled={disabled}>
              Nova
            </button>
          </div>

          {editions && editions.length > 0 ? (
            <div className="audio-editions-list">
              {editions.map((edition) => (
                <button
                  key={edition.id}
                  type="button"
                  className={`audio-edition ${edition.id === selectedId ? "is-on" : ""}`}
                  onClick={() => selectEdition(edition)}
                  disabled={disabled}
                >
                  <span className="audio-edition-title">
                    {edition.narrator || "Sem narrador"}
                  </span>
                  <span className="audio-edition-meta">
                    {edition.language.toUpperCase()} · {audioSourceLabel(edition.source)} ·{" "}
                    {edition.chapters.length} cap.
                  </span>
                  <span className={`status-chip ${audioEditionStatusTone(edition.status)}`}>
                    {audioEditionStatusLabel(edition.status)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhuma edição de áudio ainda.</p>
          )}

          <p className="muted audio-editions-help">
            Primeiro envie o texto do livro pelo catálogo; depois cadastre o áudio e mapeie os
            capítulos.
          </p>
        </aside>

        <div className="audio-workspace">
          <div className="profile-card catalog-edit-card">
            <h2>{selected ? "Metadados da edição" : "Nova edição de áudio"}</h2>
            <div className="catalog-form-grid">
              <label className="catalog-field">
                Idioma
                <select
                  value={form.language}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      language: event.target.value === "en" ? "en" : "pt",
                    }))
                  }
                  disabled={disabled}
                >
                  <option value="pt">Português</option>
                  <option value="en">Inglês</option>
                </select>
              </label>

              <label className="catalog-field">
                Fonte
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source: event.target.value as AudioSource,
                    }))
                  }
                  disabled={disabled}
                >
                  {SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {audioSourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="catalog-field">
                Narrador
                <input
                  value={form.narrator}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, narrator: event.target.value }))
                  }
                  maxLength={200}
                  disabled={disabled}
                  placeholder="Ex.: Karen Savage"
                />
              </label>

              <label className="catalog-field">
                Direitos
                <select
                  value={form.rights}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rights: event.target.value as CatalogRights,
                    }))
                  }
                  disabled={disabled}
                >
                  {RIGHTS_OPTIONS.map((rights) => (
                    <option key={rights} value={rights}>
                      {catalogRightsLabel(rights)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="catalog-field is-wide">
                URL da fonte
                <input
                  value={form.sourceUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sourceUrl: event.target.value }))
                  }
                  maxLength={500}
                  disabled={disabled}
                  placeholder="https://librivox.org/..."
                  autoComplete="off"
                />
              </label>

              <label className="catalog-field is-wide">
                Justificativa dos direitos
                <textarea
                  value={form.rightsNote}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, rightsNote: event.target.value }))
                  }
                  rows={2}
                  maxLength={500}
                  disabled={disabled}
                  placeholder="Ex.: gravação da LibriVox em domínio público"
                />
              </label>

              <label className="catalog-field is-wide">
                Licença e atribuição
                <textarea
                  value={form.licenseNote}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, licenseNote: event.target.value }))
                  }
                  rows={2}
                  maxLength={500}
                  disabled={disabled}
                  placeholder="Narração: [narrador] · LibriVox · domínio público"
                />
              </label>

              <label className="catalog-field is-wide">
                Mapeamento do texto
                <select
                  value={form.textMapping}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      textMapping: event.target.value as AudioTextMapping,
                    }))
                  }
                  disabled={disabled}
                >
                  {TEXT_MAPPING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="catalog-actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveEdition()}
                disabled={disabled}
              >
                {busy === "edition" ? "Salvando…" : selected ? "Salvar edição" : "Criar edição"}
              </button>
              {selected ? (
                <button type="button" className="btn" onClick={startNewEdition} disabled={disabled}>
                  Limpar
                </button>
              ) : null}
            </div>
          </div>

          {selected ? (
            <div className="profile-card catalog-edit-card audio-chapters-card">
              <div className="audio-chapters-head">
                <div>
                  <h2>Capítulos</h2>
                  <p className="muted">
                    {chapters.length} capítulo(s) · {formatAudioDuration(selected.total_duration_seconds)}
                  </p>
                </div>
                <div className="catalog-actions-bar">
                  <label
                    className={`btn btn-primary catalog-file-action ${disabled ? "is-disabled" : ""}`}
                  >
                    {uploading ? `Enviando ${uploading.done}/${uploading.total}…` : "Enviar capítulos"}
                    <input
                      type="file"
                      accept={AUDIO_ACCEPT}
                      multiple
                      onChange={uploadChapters}
                      disabled={disabled}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void autoMap()}
                    disabled={disabled || chapters.length === 0 || !textChapters?.length}
                  >
                    {busy === "map" ? "Mapeando…" : "Mapear pela ordem"}
                  </button>
                </div>
              </div>

              {textError ? (
                <p className="auth-error" role="alert">
                  {textError}
                </p>
              ) : null}

              {textChapters && chapters.length !== textChapters.length ? (
                <p className="audio-warning" role="status">
                  O áudio tem {chapters.length} capítulo(s) e o texto tem{" "}
                  {textChapters.length}. Revise o mapeamento antes de publicar.
                </p>
              ) : null}

              {selected.text_mapping === "pending" ? (
                <p className="audio-warning" role="status">
                  Defina o mapeamento do texto na edição antes de publicar.
                </p>
              ) : selected.text_mapping === "mapped" && !textMappingReady ? (
                <p className="audio-warning" role="status">
                  Nenhum capítulo está ligado ao texto. Mapeie pela ordem ou escolha “Sem texto”.
                </p>
              ) : null}

              {chapters.length === 0 ? (
                <p className="muted">
                  Nenhum capítulo ainda. Envie um arquivo por capítulo ou um MP3 único para começar.
                </p>
              ) : (
                <div className="audio-table-wrap">
                  <table className="audio-chapter-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Capítulo</th>
                        <th>Tempo</th>
                        <th>Texto</th>
                        <th>Até</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.map((chapter) => (
                        <tr key={chapter.id}>
                          <td>{chapter.chapter_index}</td>
                          <td>
                            <strong>{chapter.title || `Capítulo ${chapter.chapter_index}`}</strong>
                            <small>{formatAudioClock(chapter.duration_seconds)}</small>
                          </td>
                          <td>
                            {timeEditIndex === chapter.chapter_index ? (
                              <div className="audio-time-editor">
                                <input
                                  aria-label={`Título do capítulo ${chapter.chapter_index}`}
                                  value={timeDraft.title}
                                  onChange={(event) =>
                                    setTimeDraft((current) => ({
                                      ...current,
                                      title: event.target.value,
                                    }))
                                  }
                                  maxLength={200}
                                  placeholder="Título"
                                  disabled={disabled}
                                />
                                <div className="audio-time-row">
                                  <input
                                    aria-label={`Início do capítulo ${chapter.chapter_index}`}
                                    value={timeDraft.start}
                                    onChange={(event) =>
                                      setTimeDraft((current) => ({
                                        ...current,
                                        start: event.target.value,
                                      }))
                                    }
                                    placeholder="00:00"
                                    inputMode="numeric"
                                    disabled={disabled}
                                  />
                                  <span>–</span>
                                  <input
                                    aria-label={`Fim do capítulo ${chapter.chapter_index}`}
                                    value={timeDraft.end}
                                    onChange={(event) =>
                                      setTimeDraft((current) => ({
                                        ...current,
                                        end: event.target.value,
                                      }))
                                    }
                                    placeholder="12:34"
                                    inputMode="numeric"
                                    disabled={disabled}
                                  />
                                </div>
                                <div className="audio-time-actions">
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => void saveTimes(chapter)}
                                    disabled={disabled}
                                  >
                                    {busy === `times-${chapter.chapter_index}` ? "Salvando…" : "Salvar"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={cancelEditTimes}
                                    disabled={disabled}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="inline-link"
                                onClick={() => startEditTimes(chapter)}
                                disabled={disabled}
                                aria-label={`Editar tempos do capítulo ${chapter.chapter_index}`}
                                title="Editar título, início e fim"
                              >
                                {formatAudioClock(chapter.start_seconds)} –{" "}
                                {formatAudioClock(chapterEnd(chapter))}
                              </button>
                            )}
                          </td>
                          <td>
                            <select
                              aria-label={`Capítulo do texto do áudio ${chapter.chapter_index}`}
                              value={chapter.text_chapter_index ?? ""}
                              onChange={(event) =>
                                void changeMapping(chapter, "start", event.target.value)
                              }
                              disabled={disabled || !textChapters?.length}
                            >
                              <option value="">Sem texto</option>
                              {(textChapters ?? []).map((_text, index) => (
                                <option key={`${chapter.id}-start-${index}`} value={index + 1}>
                                  {textChapterLabel(textChapters, index + 1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Fim do texto do áudio ${chapter.chapter_index}`}
                              value={chapter.text_chapter_end_index ?? ""}
                              onChange={(event) =>
                                void changeMapping(chapter, "end", event.target.value)
                              }
                              disabled={disabled || !textChapters?.length || chapter.text_chapter_index === null}
                            >
                              <option value="">Mesmo capítulo</option>
                              {(textChapters ?? []).map((_text, index) => (
                                <option key={`${chapter.id}-end-${index}`} value={index + 1}>
                                  {textChapterLabel(textChapters, index + 1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className={`status-chip ${chapter.status === "ready" ? "is-approved" : "is-pending"}`}>
                              {chapter.status === "ready"
                                ? "Pronto"
                                : chapter.status === "processing"
                                  ? "Processando"
                                  : "Falhou"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sameAudioPath && chapters.length > 0 ? (
                <div className="audio-single-file">
                  <h3>Adicionar capítulo do mesmo arquivo</h3>
                  <p className="muted">
                    Para dividir um M4A/MP3 único, clique nos tempos do capítulo 1 e ajuste o fim;
                    depois adicione os próximos com início e fim. Em arquivos por capítulo, envie um
                    arquivo para cada um.
                  </p>
                  <div className="catalog-form-grid">
                    <label className="catalog-field">
                      Título
                      <input
                        value={newChapter.title}
                        onChange={(event) =>
                          setNewChapter((current) => ({ ...current, title: event.target.value }))
                        }
                        maxLength={200}
                        disabled={disabled}
                        placeholder={`Capítulo ${chapters.length + 1}`}
                      />
                    </label>
                    <label className="catalog-field">
                      Início
                      <input
                        value={newChapter.start}
                        onChange={(event) =>
                          setNewChapter((current) => ({ ...current, start: event.target.value }))
                        }
                        disabled={disabled}
                        placeholder="00:00"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="catalog-field">
                      Fim
                      <input
                        value={newChapter.end}
                        onChange={(event) =>
                          setNewChapter((current) => ({ ...current, end: event.target.value }))
                        }
                        disabled={disabled}
                        placeholder="12:34"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void addChapter()}
                    disabled={disabled}
                  >
                    {busy === "chapter" ? "Adicionando…" : "Adicionar capítulo"}
                  </button>
                </div>
              ) : null}

              <div className="catalog-actions-bar audio-chapter-actions">
                {selected.status === "published" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void changeStatus("hide")}
                    disabled={disabled}
                  >
                    Ocultar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void changeStatus("publish")}
                    disabled={disabled || chapters.length === 0 || !textMappingReady}
                  >
                    Publicar audiolivro
                  </button>
                )}
                {superadmin ? (
                  <button
                    type="button"
                    className="btn profile-logout"
                    onClick={() => void removeEdition()}
                    disabled={disabled}
                  >
                    {busy === "delete" ? "Removendo…" : "Remover edição"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {dialog}
    </section>
  );
}
