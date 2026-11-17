import { withoutImageMarkers } from "../../lib/imageMarkers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import type { Ebook } from "../../data/types";
import { castFromNames, forgetCast } from "../../lib/cast";
import { forgetChat } from "../../lib/chatHistory";
import { metadataProblem } from "../../lib/submissionMetadata";
import {
  blobToDataUrl,
  dataUrlToBlob,
  prepareImage,
  uploadBookCover,
} from "../../lib/profileMedia";
import { RIGHTS_OPTIONS, submitBook, type Rights } from "../../lib/community";
import { forgetHighlights } from "../../lib/highlights";
import { splitIntoChapters } from "../../lib/chapters";
import { ACCEPTED_EXTENSIONS, importBookFile, type ImportedBook } from "../../lib/importBook";
import {
  deleteLocalBook,
  listLocalBooks,
  newLocalBookId,
  saveLocalBook,
} from "../../lib/localBooks";
import { removeProgress } from "../../lib/progress";
import { type BookHint } from "../../lib/openLibrary";
import { type SupabaseSession } from "../../lib/auth";
import { displayNameOf } from "../../lib/userMeta";
import { CONTINUE_PREVIEW } from "../../lib/homePreviews";
import { BookCover } from "../../components/BookCover";

/** Livros do próprio leitor (.epub, .pdf, .txt): com conta, vão para os outros aparelhos dela. */
export function MyBooks({
  onOpen,
  onRemoved,
  onRequest,
  request,
  setRequest,
  session,
  onSubmitted,
}: {
  onOpen: (b: Ebook) => void;
  onRemoved: () => void;
  onRequest: () => void;
  /**
   * Formulário aberto (`null` = fechado). Abre pelo topo da página, pelo destaque e pela busca;
   * vindo de um livro "Fora do acervo", já traz título, autor e capa.
   */
  request: BookHint | Record<string, never> | null;
  setRequest: (r: BookHint | Record<string, never> | null) => void;
  /** Logado: pode sugerir o livro para o acervo da comunidade. */
  session?: SupabaseSession | null;
  onSubmitted?: () => void;
}) {
  const open = request !== null;
  const hint = request && "title" in request ? request : null;
  const [books, setBooks] = useState<Ebook[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportedBook | null>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState<"pt" | "en">("pt");
  const [castText, setCastText] = useState("");
  const [showAllBooks, setShowAllBooks] = useState(false);
  /** Capa escolhida pela pessoa (opcional): vale para o livro dela e, se sugerir, para o acervo. */
  const [customCover, setCustomCover] = useState<{ blob: Blob; url: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  useEffect(() => () => void (customCover && URL.revokeObjectURL(customCover.url)), [customCover]);

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    setError(null);
    try {
      const blob = await prepareImage(file, "book");
      setCustomCover({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
    } finally {
      setCoverBusy(false);
    }
  }
  const [share, setShare] = useState(false);
  const [rights, setRights] = useState<Rights | null>(null);
  const [rightsNote, setRightsNote] = useState("");
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    void listLocalBooks().then(setBooks);
  }, []);

  const chapterCount = useMemo(
    () => (parsed ? splitIntoChapters(parsed.text).length : 0),
    [parsed],
  );

  const close = useCallback(() => {
    if (saving) return;
    setRequest(null);
    setParsing(false);
    setError(null);
    setParsed(null);
    setFileName("");
    setTitle("");
    setAuthor("");
    setCastText("");
    setShare(false);
    setCustomCover(null);
    setRights(null);
    setRightsNote("");
    setAgree(false);
  }, [saving, setRequest]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setParsed(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const book = await importBookFile(file);
      setParsed(book);
      // Livro escolhido em "Fora do acervo": vale o título em português do catálogo.
      setTitle(hint?.title ?? book.title);
      setAuthor(hint?.author || book.author);
      setLanguage(book.language);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler este arquivo.");
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || saving) return;
    if (share && !rights) return setError("Escolha por que este livro pode ser compartilhado.");
    if (share && !agree)
      return setError("Confirme a declaração de direitos para enviar ao acervo.");
    // Para o acervo público, título e autor de verdade (U1); na estante pessoal vale qualquer um.
    const shareProblem = share ? metadataProblem(title, author) : null;
    if (shareProblem)
      return setError(`${shareProblem} Ele aparece assim para todo mundo no acervo.`);
    const id = newLocalBookId();
    const bookTitle = title.trim() || "Meu livro";
    const chosenCover = customCover
      ? await blobToDataUrl(customCover.blob).catch(() => null)
      : null;
    const characters = castFromNames(bookTitle, castText);
    const book: Ebook = {
      id: `local-${-id}`,
      gutenbergId: id,
      title: bookTitle,
      author: author.trim() || "Autor não informado",
      genre: "Meu livro",
      // Capa: a escolhida pela pessoa, a do catálogo ("Fora do acervo") ou a que veio no arquivo.
      ...((chosenCover ?? hint?.coverUrl ?? parsed.cover)
        ? { coverUrl: chosenCover ?? hint?.coverUrl ?? parsed.cover }
        : {}),
      textLanguage: language,
      source: "local",
      // Sem nomes digitados, a IA sugere o elenco ao abrir o livro (uma vez só).
      ...(characters.length > 0 ? { characters } : {}),
    };
    setSaving(true);
    try {
      // Envia primeiro: se falhar, nada fica pela metade e dá para tentar de novo.
      if (share && session && rights) {
        // A mesma capa de "Seus livros": a escolhida ou a do arquivo sobem para o Storage.
        const sharedCover = customCover
          ? await uploadBookCover(session, customCover.blob)
          : hint?.coverUrl && !hint.coverUrl.startsWith("data:") && hint.coverUrl.length <= 300
            ? hint.coverUrl
            : parsed.cover
              ? await uploadBookCover(session, await dataUrlToBlob(parsed.cover))
              : null;
        const submission = await submitBook(session, {
          coverUrl: sharedCover,
          title: book.title,
          author: author.trim(),
          language,
          rights,
          rightsNote,
          characters: castText,
          submitterName: displayNameOf(session.user),
          text: withoutImageMarkers(parsed.text),
        });
        book.submissionId = submission.id;
        onSubmitted?.();
      }
      await saveLocalBook(book, parsed.text, parsed.images);
      setBooks((prev) => [book, ...prev]);
      setSaving(false);
      close();
      onOpen(book);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar o livro.");
      setSaving(false);
    }
  }

  async function remove(b: Ebook) {
    const where = session ? "de todos os aparelhos da sua conta" : "deste aparelho";
    if (
      !window.confirm(`Remover “${b.title}” ${where}? O progresso de leitura também será apagado.`)
    ) {
      return;
    }
    await deleteLocalBook(b.gutenbergId).catch(() => undefined);
    removeProgress(b.gutenbergId);
    forgetCast(b.id);
    forgetChat(b.id);
    forgetHighlights(b.id);
    setBooks((prev) => prev.filter((x) => x.gutenbergId !== b.gutenbergId));
    onRemoved();
  }

  return (
    <section className="shelf my-books" id="meus-livros">
      <div className="shelf-head">
        <h2>Seus livros</h2>
        <p>Tem o arquivo de um livro? Importe e converse com os personagens.</p>
      </div>

      <div className="result-grid">
        <button type="button" className="result" onClick={onRequest}>
          <div className="cover import-cover" aria-hidden="true">
            <span className="import-plus">+</span>
            <span className="import-formats">EPUB · PDF · TXT</span>
          </div>
          <strong>Importar meu livro</strong>
          <span>{session ? "Em todos os seus aparelhos" : "Fica só neste aparelho"}</span>
        </button>
        {(showAllBooks ? books : books.slice(0, CONTINUE_PREVIEW)).map((b) => (
          <div key={b.gutenbergId} className="my-book">
            <button type="button" className="result" onClick={() => onOpen(b)}>
              <BookCover book={b} />
              <strong>{b.title}</strong>
              <span>{b.author}</span>
            </button>
            <button
              type="button"
              className="link-btn my-book-remove"
              onClick={() => void remove(b)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      {books.length > CONTINUE_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => setShowAllBooks((v) => !v)}>
            {showAllBooks ? "Mostrar menos" : `Ver todos (${books.length})`}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="import-overlay" onClick={close}>
          <form
            className="import-panel"
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <div className="import-head">
              <h3 id="import-title">{hint ? `Importar “${hint.title}”` : "Importar meu livro"}</h3>
              <button type="button" className="icon-btn" onClick={close} aria-label="Fechar">
                {Icon.close}
              </button>
            </div>

            <label
              className={`file-drop ${parsed ? "is-ready" : ""} ${parsing ? "is-loading" : ""}`}
              aria-busy={parsing}
            >
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={onFile}
                disabled={parsing || saving}
              />
              {parsing ? <span className="spinner file-drop-spinner" aria-hidden="true" /> : null}
              <strong>{parsing ? "Lendo o arquivo…" : fileName || "Escolher arquivo"}</strong>
              <span role="status">
                {parsing
                  ? `${fileName} · livros grandes podem levar alguns segundos`
                  : parsed
                    ? `${chapterCount} ${chapterCount === 1 ? "parte encontrada" : "partes encontradas"} · toque para trocar`
                    : ".epub, .pdf ou .txt"}
              </span>
            </label>

            {parsed ? (
              <>
                <label className="field">
                  <span>Título</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    required
                  />
                </label>
                <label className="field">
                  <span>Autor</span>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="field">
                  <span>Idioma do texto</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "pt" | "en")}
                  >
                    <option value="pt">Português</option>
                    <option value="en">Inglês (dá para traduzir na leitura)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Personagens para conversar (opcional)</span>
                  <textarea
                    value={castText}
                    onChange={(e) => setCastText(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder={
                      "Um por linha, por exemplo:\nBella Swan\nEdward Cullen — vampiro de 104 anos"
                    }
                  />
                  <small>
                    Em branco, a IA escolhe os personagens principais quando você abrir o livro.
                  </small>
                </label>
                <div className="field cover-field">
                  <span>Capa (opcional)</span>
                  <div className="cover-pick">
                    <div className="cover-pick-preview">
                      {customCover || hint?.coverUrl || parsed.cover ? (
                        <img src={customCover?.url ?? hint?.coverUrl ?? parsed.cover} alt="" />
                      ) : (
                        <span>Sem capa</span>
                      )}
                    </div>
                    <div className="cover-pick-actions">
                      <label className={`btn ${coverBusy ? "is-disabled" : ""}`}>
                        {Icon.camera}
                        {coverBusy
                          ? "Preparando…"
                          : customCover
                            ? "Trocar imagem"
                            : "Escolher imagem"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void pickCover(e)}
                          disabled={coverBusy || saving}
                        />
                      </label>
                      {customCover ? (
                        <button
                          type="button"
                          className="inline-link"
                          onClick={() => setCustomCover(null)}
                          disabled={saving}
                        >
                          Tirar a imagem escolhida
                        </button>
                      ) : null}
                      <small>
                        {customCover
                          ? "Esta capa aparece no seu livro e, se você sugerir para o acervo, lá também."
                          : parsed.cover || hint?.coverUrl
                            ? "Usando a capa que veio com o livro. Pode trocar por outra imagem."
                            : "Sem imagem, o app desenha uma capa ou busca uma na Open Library."}
                      </small>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {parsed && session ? (
              <div className={`share-box ${share ? "is-on" : ""}`}>
                <label className="share-toggle">
                  <input
                    type="checkbox"
                    checked={share}
                    onChange={(e) => setShare(e.target.checked)}
                  />
                  <span>
                    <strong>Sugerir para o acervo da comunidade</strong>
                    <small>Se for aprovado, outras pessoas também vão poder ler.</small>
                  </span>
                </label>
                {share ? (
                  <>
                    <div
                      className="share-rights"
                      role="radiogroup"
                      aria-label="Por que pode ser compartilhado"
                    >
                      {RIGHTS_OPTIONS.map((o) => (
                        <label
                          key={o.id}
                          className={`share-right ${rights === o.id ? "is-on" : ""}`}
                        >
                          <input
                            type="radio"
                            name="rights"
                            checked={rights === o.id}
                            onChange={() => setRights(o.id)}
                          />
                          <span>
                            <strong>{o.label}</strong>
                            <small>{o.hint}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                    {rights ? (
                      <label className="field">
                        <span>Como sabemos? (ajuda na análise)</span>
                        <input
                          value={rightsNote}
                          onChange={(e) => setRightsNote(e.target.value)}
                          maxLength={500}
                          placeholder={RIGHTS_OPTIONS.find((o) => o.id === rights)?.placeholder}
                        />
                      </label>
                    ) : null}
                    <label className="share-agree">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                      />
                      <span>
                        Declaro que este livro pode ser compartilhado e entendo que ele será
                        removido se violar direitos autorais. Livros com direitos reservados (ex.:
                        best-sellers atuais) são recusados.
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="import-error" role="alert">
                {error}
              </p>
            ) : null}

            <p className="import-note">
              O arquivo é lido no seu navegador e não é enviado para lugar nenhum. Livros com
              proteção contra cópia (DRM), como os comprados no Kindle, não abrem.
            </p>

            <div className="import-actions">
              <button type="button" className="btn" onClick={close} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!parsed || saving}
                aria-busy={saving}
              >
                {saving ? <span className="spinner btn-spinner" aria-hidden="true" /> : null}
                {saving
                  ? share
                    ? "Enviando…"
                    : "Guardando…"
                  : share
                    ? "Enviar e ler"
                    : "Importar e ler"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
