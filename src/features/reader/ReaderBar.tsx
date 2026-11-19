import type { ReadAloudState } from "./useReadAloud";
import type { BookTranslationState } from "./useBookTranslation";
import type { BookSearchState } from "./useBookSearch";
import type { StoryChapter } from "../../lib/chapters";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import type { Ebook } from "../../data/types";
import { BookStatusControl } from "../library/BookStatusControl";
import { type Highlight } from "../../lib/highlights";
import {
  FONT_SIZES,
  NightLight,
  NIGHT_LIGHT_LABELS,
  type ReadingPrefs,
} from "../../lib/readingPrefs";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";

/** Barra do topo do leitor: voltar, título, capítulos, voz, estante, tradução e ajustes. */
export function ReaderBar({
  book,
  chapterIndex,
  chapters,
  currentChapter,
  goalFlash,
  hasNextChapter,
  highlights,
  immersive,
  isFullscreen,
  leaveBook,
  prefs,
  readerSettingsOpen,
  readingHere,
  readingProgressPct,
  ready,
  search,
  setChapterIndex,
  setHighlightsOpen,
  setPrefs,
  setReaderSettingsOpen,
  setShelfPanelOpen,
  shelfOn,
  shelfPanelOpen,
  toggleReadingFullscreen,
  translation,
  voice,
}: {
  book: Ebook;
  chapterIndex: number;
  chapters: StoryChapter[];
  currentChapter: StoryChapter;
  goalFlash: number | null;
  hasNextChapter: boolean;
  highlights: Highlight[];
  immersive: boolean;
  isFullscreen: boolean;
  leaveBook: () => void;
  prefs: ReadingPrefs;
  readerSettingsOpen: boolean;
  readingHere: number | null;
  readingProgressPct: number;
  ready: boolean;
  search: BookSearchState;
  setChapterIndex: Dispatch<SetStateAction<number>>;
  setHighlightsOpen: Dispatch<SetStateAction<boolean>>;
  setPrefs: Dispatch<SetStateAction<ReadingPrefs>>;
  setReaderSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setShelfPanelOpen: Dispatch<SetStateAction<boolean>>;
  shelfOn: boolean;
  shelfPanelOpen: boolean;
  toggleReadingFullscreen: () => Promise<void>;
  translation: BookTranslationState;
  voice: ReadAloudState;
}) {
  const {
    canSpeak,
    speaking,
    voicePanelOpen,
    setVoicePanelOpen,
    speechRate,
    stopSpeaking,
    listenAloud,
  } = voice;
  const { canTranslate, translateOn, toggleTranslation } = translation;
  const { setSearchOpen } = search;

  return (
    <header className="reader-bar">
      {goalFlash !== null ? (
        <div key={goalFlash} className="goal-flash" role="status">
          <span className="goal-flash-line" aria-hidden="true" />
          <span className="goal-flash-sparks" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </span>
          <span className="goal-flash-pill">🎯 Meta do dia cumprida!</span>
        </div>
      ) : null}
      <button
        type="button"
        className="icon-btn"
        onClick={leaveBook}
        aria-label="Voltar para a estante"
      >
        {Icon.back}
      </button>
      <div className="reader-title">
        <strong>{book.title}</strong>
        <span>
          {book.author}
          {currentChapter ? ` · ${currentChapter.label}` : ""}
        </span>
        {readingHere !== null && readingHere > 1 ? (
          <span className="reading-here" role="status">
            <span className="online-dot" aria-hidden="true" />
            você e mais {readingHere - 1} {readingHere - 1 === 1 ? "pessoa lendo" : "pessoas lendo"}{" "}
            agora
          </span>
        ) : null}
      </div>

      {chapters.length > 1 ? (
        <div className="chapter-nav">
          <button
            type="button"
            className="icon-btn"
            disabled={chapterIndex <= 0}
            onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
            aria-label="Capítulo anterior"
          >
            {Icon.back}
          </button>
          <ChapterMenu chapters={chapters} chapterIndex={chapterIndex} setChapterIndex={setChapterIndex} />
          <button
            type="button"
            className="icon-btn"
            disabled={!hasNextChapter}
            onClick={() => setChapterIndex((i) => Math.min(chapters.length - 1, i + 1))}
            aria-label="Próximo capítulo"
          >
            {Icon.next}
          </button>
        </div>
      ) : null}

      <div className="reader-tools">
        {canSpeak && ready ? (
          <>
            {speaking ? (
              <button
                type="button"
                className={`icon-btn text-btn rate-btn ${voicePanelOpen ? "is-active" : ""}`}
                onClick={() => setVoicePanelOpen((v) => !v)}
                aria-expanded={voicePanelOpen}
                aria-label={`Voz e velocidade (${speechRate}x)`}
                title="Voz e velocidade"
              >
                {String(speechRate).replace(".", ",")}x
              </button>
            ) : null}
            <button
              type="button"
              className={`icon-btn ${speaking ? "is-active" : ""}`}
              onClick={() => (speaking ? stopSpeaking() : listenAloud())}
              aria-pressed={speaking}
              aria-label={speaking ? "Parar a leitura em voz alta" : "Ouvir o capítulo em voz alta"}
              title={speaking ? "Parar" : "Ouvir em voz alta"}
            >
              {speaking ? Icon.stop : Icon.speaker}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Buscar no livro"
          title="Buscar no livro"
          disabled={!ready}
        >
          {Icon.search}
        </button>
        {shelfOn ? (
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShelfPanelOpen(true)}
            aria-label="Na estante"
            title="Na estante: status, nota e resenha"
          >
            {Icon.book}
          </button>
        ) : null}
        {shelfOn && shelfPanelOpen ? (
          <BookStatusControl book={book} onClose={() => setShelfPanelOpen(false)} />
        ) : null}
        <button
          type="button"
          className="icon-btn marks-btn"
          onClick={() => setHighlightsOpen(true)}
          aria-label={`Marcações (${highlights.length})`}
          title="Marcações e citações"
        >
          {Icon.bookmark}
          {highlights.length > 0 ? <span className="badge">{highlights.length}</span> : null}
        </button>
        {canTranslate ? (
          <button
            type="button"
            className={`icon-btn text-btn translate-btn ${translateOn ? "is-active" : ""}`}
            onClick={() => void toggleTranslation()}
            aria-pressed={translateOn}
            aria-label={
              translateOn ? "Ver o texto original em inglês" : "Traduzir para o português"
            }
            title={translateOn ? "Ver o original em inglês" : "Traduzir para o português"}
          >
            {translateOn ? "PT" : "EN"}
          </button>
        ) : null}
        <button
          type="button"
          className="icon-btn text-btn"
          disabled={prefs.fontStep <= 0}
          onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep - 1 }))}
          aria-label="Diminuir letra"
        >
          A<small>−</small>
        </button>
        <button
          type="button"
          className="icon-btn text-btn"
          disabled={prefs.fontStep >= FONT_SIZES.length - 1}
          onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep + 1 }))}
          aria-label="Aumentar letra"
        >
          A<small>+</small>
        </button>
        <button
          type="button"
          className="icon-btn reader-theme-btn"
          onClick={() =>
            setPrefs((p) => ({ ...p, theme: p.theme === "night" ? "sepia" : "night" }))
          }
          aria-label={prefs.theme === "night" ? "Mudar para modo sépia" : "Mudar para modo noturno"}
        >
          {prefs.theme === "night" ? Icon.sun : Icon.moon}
        </button>
        <button
          type="button"
          className={`icon-btn night-light-btn ${prefs.nightLight ? "is-on" : ""}`}
          onClick={() =>
            setPrefs((p) => ({ ...p, nightLight: ((p.nightLight + 1) % 3) as NightLight }))
          }
          aria-label={`Luz noturna: ${NIGHT_LIGHT_LABELS[prefs.nightLight]}. Toque para mudar.`}
          title={`Luz noturna: ${NIGHT_LIGHT_LABELS[prefs.nightLight]}`}
        >
          {Icon.nightLight}
          {prefs.nightLight ? (
            <span className="night-light-level" aria-hidden="true">
              {prefs.nightLight}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="icon-btn reader-settings-btn"
          onClick={() => setReaderSettingsOpen((open) => !open)}
          aria-expanded={readerSettingsOpen}
          aria-label="Ajustes de leitura"
          title="Ajustes de leitura"
        >
          Aa
        </button>
      </div>

      {readerSettingsOpen ? (
        <ReaderSettingsPanel
          immersive={immersive}
          isFullscreen={isFullscreen}
          prefs={prefs}
          setPrefs={setPrefs}
          setReaderSettingsOpen={setReaderSettingsOpen}
          toggleReadingFullscreen={toggleReadingFullscreen}
        />
      ) : null}

      <div className="progress" aria-hidden="true">
        <span style={{ width: `${readingProgressPct}%` }} />
      </div>
    </header>
  );
}

function ChapterMenu({
  chapters,
  chapterIndex,
  setChapterIndex,
}: {
  chapters: StoryChapter[];
  chapterIndex: number;
  setChapterIndex: Dispatch<SetStateAction<number>>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (list && current) list.scrollTop = current.offsetTop - list.clientHeight / 2 + current.clientHeight / 2;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="chapter-menu" ref={rootRef}>
      <button
        type="button"
        className="chapter-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Escolher capítulo"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{chapters[chapterIndex]?.label}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="chapter-menu-list" role="listbox" aria-label="Capítulos" ref={listRef}>
          {chapters.map((ch, i) => (
            <button
              key={ch.index}
              type="button"
              role="option"
              aria-selected={i === chapterIndex}
              className={i === chapterIndex ? "is-on" : ""}
              onClick={() => {
                setChapterIndex(i);
                setOpen(false);
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
