import type { BookTranslationState } from "./useBookTranslation";
import type { ReadAloudState } from "./useReadAloud";
import type { StoryChapter } from "../../lib/chapters";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import type { Ebook } from "../../data/types";
import { splitByHighlights, type Highlight } from "../../lib/highlights";
import { isLocalBook } from "../../lib/localBooks";
import { type SupabaseSession } from "../../lib/auth";
import { warmUpLocalTranslator } from "../../lib/translate";
import { withItalics, type Block } from "./bookText";

/** Texto do capítulo aberto, com destaques, tradução e navegação. */
export function ChapterText({
  authSession,
  blocks,
  book,
  bookImages,
  chapterDirRef,
  chapterDone,
  chapterIndex,
  chapterKey,
  chapters,
  currentChapter,
  dropCapIndex,
  handleSelection,
  hasNextChapter,
  highlights,
  lastActivityRef,
  setChapterIndex,
  translation,
  visibleChunk,
  voice,
}: {
  authSession: SupabaseSession | null;
  blocks: Block[];
  book: Ebook;
  bookImages: Record<string, string>;
  chapterDirRef: RefObject<"next" | "prev">;
  chapterDone: { key: string; label: string; done: number; total: number } | null;
  chapterIndex: number;
  chapterKey: string;
  chapters: StoryChapter[];
  currentChapter: StoryChapter;
  dropCapIndex: number;
  handleSelection: () => void;
  hasNextChapter: boolean;
  highlights: Highlight[];
  lastActivityRef: RefObject<number>;
  setChapterIndex: Dispatch<SetStateAction<number>>;
  translation: BookTranslationState;
  visibleChunk: { key: string; chunk: number } | null;
  voice: ReadAloudState;
}) {
  const {
    translateOn,
    failedChunks,
    engine,
    setFailedChunks,
    translatingChunk,
    translations,
    chunkOfBlock,
    shownTexts,
  } = translation;
  const { speakingBlock } = voice;

  return (
    <article
      key={chapterIndex}
      className={`prose from-${chapterDirRef.current}`}
      aria-label="Texto do capítulo"
      onMouseUp={handleSelection}
      onTouchEnd={handleSelection}
      onKeyUp={handleSelection}
      onPointerDown={() => (lastActivityRef.current = Date.now())}
    >
      <header className="chapter-head">
        <span>
          {chapterIndex + 1} de {chapters.length}
        </span>
        <h1>{currentChapter.label}</h1>
        <span className="chapter-ornament" aria-hidden="true">
          ✦
        </span>
      </header>

      {translateOn ? (
        <div className="translate-note" role="status">
          {failedChunks.length > 0 ? (
            <>
              Parte deste capítulo não pôde ser traduzida agora.{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  if (engine === "local") warmUpLocalTranslator();
                  setFailedChunks([]);
                }}
              >
                Tentar de novo
              </button>
            </>
          ) : translatingChunk !== null && !translations[visibleChunk?.chunk ?? 0] ? (
            "Traduzindo este trecho…"
          ) : (
            "Tradução automática. Pode conter imprecisões."
          )}
        </div>
      ) : null}

      {blocks.map((b, i) => {
        const c = chunkOfBlock[i];
        if (b.kind === "image") {
          const src = bookImages[b.text];
          return src ? (
            <figure key={i} className="prose-figure" data-chunk={c} data-block={i}>
              <img src={src} alt="Ilustração do livro" loading="lazy" />
            </figure>
          ) : null;
        }
        const pending = translateOn && !translations[c];
        const here = highlights.filter((h) => h.chapterIndex === chapterIndex && h.paragraph === i);
        const marks = here.map((h) => h.text);
        // Acabou de marcar: o trecho é pintado como caneta passando (só esse, só agora).
        const fresh = new Set(
          here.filter((h) => Date.now() - h.createdAt < 4000).map((h) => h.text),
        );
        // Com destaque, o itálico (_assim_) sai: o trecho marcado precisa bater com o texto.
        const text =
          marks.length > 0
            ? splitByHighlights(shownTexts[i].replace(/_/g, ""), marks).map((piece, k) =>
                piece.marked ? (
                  <mark key={k} className={fresh.has(piece.text) ? "is-new" : undefined}>
                    {piece.text}
                  </mark>
                ) : (
                  piece.text
                ),
              )
            : withItalics(shownTexts[i]);
        const className =
          [
            i === dropCapIndex ? "dropcap" : "",
            pending ? "is-translating" : "",
            speakingBlock === i ? "is-speaking" : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined;
        return b.kind === "heading" ? (
          <h2 key={i} data-chunk={c} data-block={i} className={className}>
            {text}
          </h2>
        ) : (
          <p key={i} data-chunk={c} data-block={i} className={className}>
            {text}
          </p>
        );
      })}

      <footer className="chapter-end">
        {chapterDone?.key === chapterKey ? (
          <div className="chapter-done" role="status">
            <svg className="chapter-done-check" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="23" />
              <path d="M15 27 l7.5 7.5 L37.5 19" />
            </svg>
            <strong>{chapterDone.label} concluído</strong>
            <div className="chapter-done-bar" aria-hidden="true">
              <span style={{ width: `${(chapterDone.done / chapterDone.total) * 100}%` }} />
            </div>
            <small>
              {chapterDone.done} de {chapterDone.total} capítulos ·{" "}
              {chapterDone.total - chapterDone.done === 1
                ? "falta 1"
                : `faltam ${chapterDone.total - chapterDone.done}`}
            </small>
          </div>
        ) : null}
        {hasNextChapter ? (
          <button
            type="button"
            className={`btn btn-primary btn-lg ${chapterDone?.key === chapterKey ? "is-ready" : ""}`}
            onClick={() => setChapterIndex((i) => i + 1)}
          >
            Próximo capítulo {Icon.next}
          </button>
        ) : (
          <p className="the-end">Fim — mas a conversa continua ao lado.</p>
        )}
        {isLocalBook(book) ? (
          <span className="source-link">
            Livro importado · {authSession ? "guardado na sua conta" : "guardado só neste aparelho"}
          </span>
        ) : book.source === "community" ? (
          <span className="source-link">
            Livro da comunidade · enviado por um leitor e aprovado pela curadoria
          </span>
        ) : book.source === "catalog" && book.catalogKey ? (
          <Link className="source-link" to={`/biblioteca/${encodeURIComponent(book.catalogKey)}`}>
            Livro da biblioteca pública · ver a ficha do livro
          </Link>
        ) : (
          <a
            className="source-link"
            href={`https://www.gutenberg.org/ebooks/${book.gutenbergId}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver esta obra no Project Gutenberg ↗
          </a>
        )}
      </footer>
    </article>
  );
}
