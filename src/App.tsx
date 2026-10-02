import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AVATARS, AvatarArt, findAvatar } from "./avatars";
import { featuredBooks, suggestedBooks } from "./data/ebooks";
import type { Ebook, StoryCharacter } from "./data/types";
import {
  characterReply,
  detectProvider,
  providerDisplayLabel,
  USER_MESSAGE_MAX_CHARS,
  type ChatTurn,
} from "./lib/ai";
import { castFromNames, forgetCast, loadCast } from "./lib/cast";
import { forgetChat, loadChat, saveChat } from "./lib/chatHistory";
import { activateDataOwner } from "./lib/dataOwner";
import { pullAndMerge, pushIfChanged, resetSync, startAutoPush } from "./lib/cloudSync";
import { findOpenLibraryCover, forgetCover, knownCover, lookupPublication, type PublicationInfo } from "./lib/bookCovers";
import { finishedBooks, markBookFinished } from "./lib/finished";
import { watchPresence } from "./lib/presence";
import { pushLayer, removeLayer } from "./lib/backStack";
import { blobToDataUrl, dataUrlToBlob, prepareImage, removeProfileImage, uploadBookCover, uploadProfileImage, type MediaKind } from "./lib/profileMedia";
import {
  approvedCommunityBooks,
  checkIsAdmin,
  deleteSubmission,
  fetchCommunityText,
  isNewCommunityBook,
  listSubmissions,
  matchesCommunitySearch,
  newBookLabel,
  normalizeText,
  reviewSubmission,
  changeSubmissionCover,
  rightsLabel,
  RIGHTS_OPTIONS,
  submissionToEbook,
  submitBook,
  syncSubmissionCovers,
  type Rights,
  type Submission,
} from "./lib/community";
import { lookupWord, normalizeWord, type WordInfo } from "./lib/dictionary";
import {
  allHighlights,
  forgetHighlights,
  loadHighlights,
  MAX_HIGHLIGHT_CHARS,
  saveHighlights,
  splitByHighlights,
  type Highlight,
} from "./lib/highlights";
import { splitIntoChapters } from "./lib/chapters";
import { fetchBookText, searchBooks, type SearchLanguage } from "./lib/gutenberg";
import { ACCEPTED_EXTENSIONS, importBookFile, type ImportedBook } from "./lib/importBook";
import {
  deleteLocalBook,
  isLocalBook,
  listLocalBooks,
  loadLocalBookImages,
  loadLocalBookText,
  newLocalBookId,
  saveLocalBook,
} from "./lib/localBooks";
import {
  loadProgress,
  progressPct,
  recentProgress,
  removeProgress,
  restoreProgress,
  saveProgress,
  type ReadingProgress,
} from "./lib/progress";
import { chapterTransitionMessage, midChapterReadingHint, missYouMessage } from "./lib/readingAmbient";
import { searchOutsideCatalog, type BookHint } from "./lib/openLibrary";
import { cachedPortrait, requestPortrait } from "./lib/portraits";
import { excerptNearScrollRatio } from "./lib/readingContext";
import {
  addReadingSeconds,
  GOAL_OPTIONS,
  hasAnyReading,
  lastReadDay,
  readingSummary,
  readingTotals,
  reconcileStreak,
  setReadingGoalMinutes,
  takeShieldNotice,
  readingDays,
  SHIELD_RULES,
  type ReadingDay,
  type ReadingEvents,
  type ReadingSummary,
  type ReadingTotals,
} from "./lib/readingStats";
import {
  disableDailyNotifications,
  downloadIcs,
  enableDailyNotifications,
  googleCalendarUrl,
  lastCharacter,
  loadReminderPrefs,
  notificationSupport,
  rememberCharacter,
  reminderText,
  saveReminderPrefs,
  sendTestNotification,
  syncEngagementState,
} from "./lib/reminders";
import { useInstallPrompt, useUpdateReady } from "./lib/pwa";
import { renderShareCard, shareOrDownload, type ShareCardInput } from "./lib/shareCard";
import {
  listVoices,
  RATE_OPTIONS,
  saveRate,
  savedRate,
  savedVoiceUri,
  saveVoiceUri,
  speakParagraphs,
  speakSample,
  speechSupported,
  type SpeechSession,
  type VoiceOption,
} from "./lib/speech";
import { countMessage, DAILY_MESSAGE_LIMIT, messagesLeftToday } from "./lib/usageLimit";
import {
  AuthNetworkError,
  authEnabled,
  clearLegacyCredentials,
  loginRequired,
  consumeAuthRedirect,
  EMAIL_OTP_ENABLED,
  refreshAuthSession,
  storedAuthSession,
  resendSignupCode,
  requestPasswordReset,
  updateProfileData,
  updatePassword,
  restoreAuthSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type SupabaseSession,
  type SupabaseUser,
  verifySignupCode,
} from "./lib/auth";
import {
  cachedTranslation,
  chunkRanges,
  detectTranslationEngine,
  storeTranslation,
  translateParagraphs,
  warmUpLocalTranslator,
  type TranslationEngine,
} from "./lib/translate";
import "./App.css";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const EMPTY_THREAD: Msg[] = [];

type LoadState = "idle" | "loading" | "ready" | "error";

type ReadingTheme = "night" | "sepia";
const FONT_SIZES = [0.95, 1.05, 1.17, 1.3];
const PREFS_KEY = "storyverse:reading-prefs";
/** Luz noturna: 0 desligada, 1 suave, 2 forte (filtro âmbar que corta a luz azul). */
type NightLight = 0 | 1 | 2;
const NIGHT_LIGHT_LABELS = ["desligada", "suave", "forte"] as const;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialThreadsFor(cast: StoryCharacter[]): Record<string, Msg[]> {
  const initial: Record<string, Msg[]> = {};
  for (const c of cast) {
    initial[c.id] = [
      {
        id: uid(),
        role: "assistant",
        text:
          c.greeting ??
          `Olá! Eu sou ${c.name}. Vamos ler juntos? Pode me perguntar o que quiser sobre a história.`,
      },
    ];
  }
  return initial;
}

function loadPrefs(): { theme: ReadingTheme; fontStep: number; translate: boolean; nightLight: NightLight } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { theme?: string; fontStep?: number; translate?: boolean; nightLight?: number };
      return {
        theme: p.theme === "sepia" ? "sepia" : "night",
        translate: p.translate === true,
        nightLight: p.nightLight === 1 || p.nightLight === 2 ? p.nightLight : 0,
        fontStep:
          typeof p.fontStep === "number" && p.fontStep >= 0 && p.fontStep < FONT_SIZES.length
            ? p.fontStep
            : 1,
      };
    }
  } catch {
    // Sem armazenamento disponível: usa o padrão.
  }
  return { theme: "night", fontStep: 1, translate: false, nightLight: 0 };
}

/** Toque (celular): o menu da seleção vai abaixo do trecho, longe do menu nativo do sistema. */
function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

function shortNameOf(c: StoryCharacter): string {
  return c.shortName ?? c.name;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function suggestionsFor(c: StoryCharacter): string[] {
  return [
    `Quem é você de verdade, ${shortNameOf(c)}?`,
    "O que está sentindo agora?",
    "O que acha do que acabou de acontecer?",
  ];
}

type Block = { kind: "heading" | "p" | "image"; text: string };

/** Marcador de ilustração no texto de livros importados: "[[img:3]]" (a imagem fica no aparelho). */
const IMAGE_MARKER = /^\[\[img:([\w-]+)\]\]$/;
const IMAGE_MARKERS = /\[\[img:[\w-]+\]\]/g;

/** Termina como frase (ponto, interrogação, aspas de fecho…): o parágrafo não continua no próximo. */
const ENDS_SENTENCE = /[.!?…:;"»”)\]]$/;
/** Títulos de seção de verdade: "Capítulo 3", "PARTE II", "Prólogo", numeral romano sozinho. */
const SECTION_WORD =
  /^(cap[ií]tulo|chapter|parte|part|livro|book|pr[oó]logo|prologue|ep[ií]logo|epilogue|pref[aá]cio|preface|introdu[cç][aã]o|introduction|ato|act|cena|scene)\b/i;
const ROMAN_ALONE = /^[IVXLC]{1,9}\.?$/;

function isHeading(p: string, next: string | undefined): boolean {
  if (p.startsWith("—") || p.startsWith("-") || p.length > 90) return false;
  if (SECTION_WORD.test(p) || ROMAN_ALONE.test(p)) return true;
  // Todo em maiúsculas ("O RETRATO", "A SCANDAL IN BOHEMIA").
  const letters = p.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && p === p.toUpperCase() && !/[!?]$/.test(p)) return true;
  // Linha curta com cara de título: começa em maiúscula, poucas palavras, sem pontuação final,
  // e o parágrafo seguinte começa de novo (não é continuação da mesma frase).
  const words = p.split(/\s+/).length;
  return (
    p.length <= 50 &&
    words <= 8 &&
    /^[\p{Lu}\d"“«]/u.test(p) &&
    !/[,.!?…:;"»”)\-—]$/.test(p) &&
    (next === undefined || /^[\p{Lu}\d"“«—-]/u.test(next))
  );
}

/**
 * Os .txt do Gutenberg quebram as linhas a cada ~70 caracteres e separam parágrafos por
 * linha em branco: cada bloco vira um parágrafo. PDFs e EPUBs às vezes quebram uma frase no meio
 * ("…encontrei no trem da" + "Central um rapaz…"): esses pedaços voltam a ser um parágrafo só.
 * Só vira subtítulo (em destaque) o que é mesmo título de seção.
 */
function toBlocks(text: string, skipHeadline?: string): Block[] {
  // Ignora o "(1/2)" que o app acrescenta quando divide um capítulo longo em partes.
  const norm = (s: string) =>
    s.toUpperCase().replace(/\s*\(\d+\/\d+\)$/, "").replace(/\s+/g, " ").replace(/[\].\s]+$/, "");
  const raw = text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // O título do capítulo já aparece no topo: não repete ("Capítulo I" + "I" logo abaixo).
  if (skipHeadline && raw[0]) {
    const label = norm(skipHeadline);
    const first = norm(raw[0]);
    if (first === label || (ROMAN_ALONE.test(raw[0]) && label.endsWith(` ${first}`))) raw.shift();
  }

  // Junta pedaços de frase: sem pontuação no fim e o próximo começando em minúscula.
  const paras: string[] = [];
  for (const p of raw) {
    const prev = paras[paras.length - 1];
    if (prev && !IMAGE_MARKER.test(prev) && !IMAGE_MARKER.test(p) && !ENDS_SENTENCE.test(prev) && /^\p{Ll}/u.test(p)) {
      paras[paras.length - 1] = `${prev.replace(/-$/, "")}${prev.endsWith("-") ? "" : " "}${p}`;
    } else {
      paras.push(p);
    }
  }

  return paras.map((p, i) => {
    const img = p.match(IMAGE_MARKER);
    if (img) return { kind: "image", text: img[1] };
    return { kind: isHeading(p, paras[i + 1]) ? "heading" : "p", text: p };
  });
}

/** Texto sem os marcadores de ilustração (para a IA, a voz e a tradução). */
function withoutImageMarkers(text: string): string {
  return text.replace(IMAGE_MARKERS, "");
}

/** O Gutenberg marca itálico como _assim_. */
function withItalics(text: string): React.ReactNode {
  const parts = text.split(/_([^_]+)_/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p));
}

/**
 * Avatar do personagem: a inicial do nome e, por cima, o retrato (ilustração livre ou gerada),
 * quando houver. `generate` pede o retrato se ainda não existir (no leitor); sem ele, só mostra
 * retratos já guardados neste aparelho (página inicial, para não disparar dezenas de pedidos).
 */
function Avatar({
  character,
  size = "md",
  bookTitle,
  generate = false,
}: {
  character: StoryCharacter;
  size?: "sm" | "md" | "lg";
  bookTitle?: string;
  generate?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(() => (bookTitle ? cachedPortrait(character, bookTitle) : null));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!bookTitle) return;
    const cached = cachedPortrait(character, bookTitle);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(null);
    setLoaded(false);
    if (!generate) return;
    let alive = true;
    void requestPortrait(character, bookTitle).then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
    // O objeto do personagem muda a cada render; nome e id bastam.
  }, [character.id, character.name, bookTitle, generate]);

  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ "--c": character.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {shortNameOf(character).replace(/^(O|A|Mr\.|Mrs\.|Dr\.)\s+/i, "").charAt(0).toUpperCase()}
      {src ? (
        <img
          className={`avatar-photo ${loaded ? "is-loaded" : ""}`}
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setSrc(null)}
        />
      ) : null}
    </span>
  );
}

/** Capa real do Gutenberg; se não houver (ou falhar), desenha uma capa tipográfica. */
/**
 * Capa do livro: a própria (Gutenberg ou do arquivo importado); sem ela, ou se não carregar, a da
 * Open Library pelo título e autor (buscada só quando o livro aparece na tela); por último, a
 * capa tipográfica desenhada pelo app.
 */
function BookCover({ book }: { book: Ebook }) {
  // Outro livro ou outra capa: começa do zero (a key recria o estado já no primeiro desenho).
  // Zerar num useEffect falhava no refresh do celular: a imagem do cache carregava antes do efeito
  // rodar, o efeito voltava para "carregando" e a capa ficava invisível.
  return <BookCoverImage key={`${book.gutenbergId}|${book.coverUrl ?? ""}|${book.title}|${book.author}`} book={book} />;
}

function BookCoverImage({ book }: { book: Ebook }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [useCoverMirror, setUseCoverMirror] = useState(false);
  const [olUrl, setOlUrl] = useState<string | null | undefined>(() => knownCover(book.title, book.author));
  const [olStatus, setOlStatus] = useState<"loading" | "loaded" | "failed">("loading");
  /** Nova tentativa depois de uma falha (rede móvel instável): 1,5 s e depois 4 s. */
  const [retry, setRetry] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const retryTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(retryTimer.current), []);
  /** Falhou: tenta de novo (até 2 vezes, pulando o cache) antes de ficar com a capa desenhada. */
  const retryOr = (giveUp: () => void) => {
    if (retry >= 2) return giveUp();
    window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => setRetry((n) => n + 1), retry === 0 ? 1500 : 4000);
  };
  // Imagem guardada no próprio endereço (data:/blob:) não aceita "?tentativa" no fim.
  const withRetry = (src: string | undefined) =>
    src && retry > 0 && !/^(data|blob):/.test(src) ? `${src}${src.includes("?") ? "&" : "?"}tentativa=${retry}` : src;

  const needsFallback = !book.coverUrl || status === "failed";
  useEffect(() => {
    if (!needsFallback || olUrl !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let tries = 0;
    let again: number | undefined;
    const lookup = () =>
      void findOpenLibraryCover(book.title, book.author, book.textLanguage).then((url) => {
        if (!alive) return;
        if (url !== undefined) return setOlUrl(url);
        // Falhou agora (rede, demora): tenta de novo sozinho em vez de ficar com a genérica.
        if (++tries <= 2) again = window.setTimeout(lookup, tries === 1 ? 4000 : 12000);
      });
    if (typeof IntersectionObserver === "undefined") {
      lookup();
      return () => {
        alive = false;
        window.clearTimeout(again);
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          lookup();
        }
      },
      // Folga lateral: nas fileiras que rolam para o lado, já busca os próximos livros.
      { rootMargin: "300px 900px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      window.clearTimeout(again);
      io.disconnect();
    };
  }, [needsFallback, olUrl, book.title, book.author, book.textLanguage]);

  const coverSrc =
    useCoverMirror && book.coverUrl?.startsWith("/gutenberg/")
      ? book.coverUrl.replace(/^\/gutenberg\//, "/gutenberg-mirror/")
      : book.coverUrl;

  return (
    <div className="cover" ref={ref}>
      {book.coverUrl && status !== "failed" ? (
        <img
          className={`cover-photo ${status === "loaded" ? "is-loaded" : ""}`}
          src={withRetry(coverSrc)}
          alt=""
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => {
            if (!useCoverMirror && book.coverUrl?.startsWith("/gutenberg/")) {
              setUseCoverMirror(true);
              setStatus("loading");
              return;
            }
            retryOr(() => setStatus("failed"));
          }}
        />
      ) : needsFallback && olUrl && olStatus !== "failed" ? (
        <img
          className={`cover-photo ${olStatus === "loaded" ? "is-loaded" : ""}`}
          src={withRetry(olUrl)}
          alt=""
          loading="lazy"
          onLoad={(e) => {
            // A Open Library devolve uma imagem de 1 px quando a capa não existe.
            if (e.currentTarget.naturalWidth < 10) {
              forgetCover(book.title, book.author);
              setOlStatus("failed");
            } else setOlStatus("loaded");
          }}
          // Falha de rede: só esta vez fica a capa desenhada (sem esquecer a capa: no próximo
          // carregamento tenta de novo). Esquecer é só para a imagem vazia acima.
          onError={() => retryOr(() => setOlStatus("failed"))}
        />
      ) : null}
      <div className="cover-frame">
        {book.genre ? <span className="cover-genre">{book.genre}</span> : null}
        <span className="cover-title">{book.title}</span>
        <span className="cover-ornament" aria-hidden="true">
          ✦
        </span>
        <span className="cover-author">{book.author}</span>
      </div>
    </div>
  );
}

function LangBadge({ book }: { book: Ebook }) {
  return (
    <span className={`lang-badge lang-${book.textLanguage}`}>
      {book.textLanguage === "pt" ? "Em português" : "Texto em inglês"}
    </span>
  );
}

const Icon = {
  back: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  ),
  nightLight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      <path d="M16 3.5v3M14.5 5h3" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  speaker: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  bookmark: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4M12 2v13" />
    </svg>
  ),
  highlight: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l-6 6v3h3l6-6M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
};

const SHELVES: { id: NonNullable<Ebook["shelf"]>; title: string; subtitle: string }[] = [
  { id: "pt", title: "Em português", subtitle: "Romances e paixões proibidas, direto no nosso idioma." },
  { id: "terror", title: "Terror e vampiros", subtitle: "Os clássicos do medo. Texto em inglês, conversa em português." },
  { id: "classicos", title: "Mais clássicos", subtitle: "Mistério, romance e fantasia. Texto em inglês, conversa em português." },
];

const LANGUAGE_FILTERS: { id: SearchLanguage; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
];

/** Busca no acervo inteiro do Project Gutenberg; sem busca, mostra sugestões prontas. */
function Explore({
  onOpen,
  onImport,
  communityBooks = [],
}: {
  /** Aprovados do acervo da comunidade: entram na busca e têm filtro próprio. */
  communityBooks?: Ebook[];
  onOpen: (b: Ebook) => void;
  /** Abre o formulário de importação; com `hint`, já preenchido com o livro escolhido. */
  onImport: (hint?: BookHint) => void;
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<SearchLanguage>("pt");
  /** "community": só os livros enviados pela comunidade. */
  const [origin, setOrigin] = useState<"all" | "community">("all");
  const [books, setBooks] = useState<Ebook[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [slow, setSlow] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const term = query.trim();
  const searching = term.length >= 2;

  /** Livros famosos fora do acervo (Open Library), buscados junto com o Gutenberg. */
  const [outside, setOutside] = useState<BookHint[]>([]);
  useEffect(() => {
    setOutside([]);
    if (!searching) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchOutsideCatalog(term)
        .then((hints) => !cancelled && setOutside(hints))
        .catch(() => undefined); // Sem a Open Library, a busca do acervo continua normal.
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, searching]);

  useEffect(() => {
    if (!searching) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setSlow(false);
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), 5000);
    const t = setTimeout(() => {
      searchBooks(term, language)
        .then((page) => {
          if (cancelled) return;
          setBooks(page.books);
          setTotal(page.total);
          setNext(page.next);
          setStatus("ready");
        })
        .catch(() => !cancelled && setStatus("error"))
        .finally(() => clearTimeout(slowTimer));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(slowTimer);
    };
  }, [term, searching, language]);

  const loadMore = () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    searchBooks(term, language, next)
      .then((page) => {
        setBooks((prev) => [...prev, ...page.books]);
        setNext(page.next);
      })
      .catch(() => setNext(null))
      .finally(() => setLoadingMore(false));
  };

  const communityTitles = new Set(communityBooks.map((b) => normalizeText(b.title)));
  const shown = searching
    ? books
    : suggestedBooks.filter(
        (b) => (language === "all" || b.textLanguage === language) && !communityTitles.has(normalizeText(b.title)),
      );

  const communityShown = communityBooks.filter(
    (b) => (language === "all" || b.textLanguage === language) && (!searching || matchesCommunitySearch(b, term)),
  );
  const onlyCommunity = origin === "community";
  const communityGrid = (list: Ebook[]) => (
    <div className="result-grid">
      {list.map((b) => (
        <button key={b.id} type="button" className="result" onClick={() => onOpen(b)}>
          {isNewCommunityBook(b) ? <span className="new-badge">{newBookLabel(b)}</span> : null}
          <BookCover book={b} />
          <strong>{b.title}</strong>
          <span>
            {b.author}
            {b.textLanguage === "pt" ? " · PT" : ""}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <section className="explore" id="acervo">
      <div className="shelf-head">
        <h2>Explorar o acervo</h2>
        <p>Mais de 70 mil livros em domínio público, direto do Project Gutenberg.</p>
      </div>

      <div className="explore-controls">
        <label className="search-box">
          {Icon.search}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque por título ou autor, como Verne, Poe ou Austen"
            aria-label="Buscar livros"
          />
        </label>
        <div className="filter-pills" role="group" aria-label="Idioma do texto">
          {LANGUAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-pill ${language === f.id ? "active" : ""}`}
              onClick={() => setLanguage(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {communityBooks.length > 0 ? (
          <div className="filter-pills" role="group" aria-label="Origem dos livros">
            <button type="button" className={`filter-pill ${origin === "all" ? "active" : ""}`} onClick={() => setOrigin("all")}>
              Todo o acervo
            </button>
            <button
              type="button"
              className={`filter-pill ${origin === "community" ? "active" : ""}`}
              onClick={() => setOrigin("community")}
            >
              Da comunidade
            </button>
          </div>
        ) : null}
      </div>

      {onlyCommunity ? (
        <>
          <p className="explore-note">
            {communityShown.length === 0
              ? searching
                ? `Nenhum livro da comunidade para “${term}”.`
                : "Nenhum livro da comunidade neste idioma ainda."
              : searching
                ? `${communityShown.length} ${communityShown.length === 1 ? "livro" : "livros"} da comunidade para “${term}”`
                : "Livros enviados por leitores e aprovados pela curadoria."}
          </p>
          {communityShown.length > 0 ? communityGrid(communityShown) : null}
        </>
      ) : null}

      {/* Em "Todo o acervo" os livros da comunidade vêm em destaque no topo, com ou sem busca. */}
      {!onlyCommunity && communityShown.length > 0 ? (
        <div className="explore-community">
          <div className="explore-community-head">
            <h3>Da comunidade</h3>
            <p>Enviados por leitores e aprovados pela curadoria.</p>
          </div>
          {communityGrid(communityShown)}
        </div>
      ) : null}

      {onlyCommunity ? null : !searching ? (
        <p className="explore-note">Sugestões para começar. Os personagens aparecem quando você abre o livro.</p>
      ) : status === "error" ? (
        <p className="explore-note">Não foi possível buscar livros agora. Tente de novo em instantes.</p>
      ) : status === "loading" ? (
        <p className="explore-note">
          {slow ? "O acervo está demorando mais que o normal… quase lá." : "Procurando no acervo…"}
        </p>
      ) : status === "ready" && books.length === 0 ? (
        <p className="explore-note">
          Nenhum livro encontrado para “{term}”. O acervo só tem livros em domínio público; se você
          tem o arquivo do livro,{" "}
          <button type="button" className="inline-link" onClick={() => onImport()}>
            importe o seu
          </button>
          .
        </p>
      ) : (
        <p className="explore-note">
          {total === null
            ? `Livros para “${term}”`
            : `${total.toLocaleString("pt-BR")} ${total === 1 ? "livro" : "livros"} para “${term}”`}
        </p>
      )}

      {status !== "error" && !onlyCommunity ? (
        <div className="result-grid">
          {searching && status === "loading"
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="result result-skeleton" aria-hidden="true">
                  <div className="cover" />
                  <span />
                  <span />
                </div>
              ))
            : shown.map((b) => (
                <button key={b.id} type="button" className="result" onClick={() => onOpen(b)}>
                  <BookCover book={b} />
                  <strong>{b.title}</strong>
                  <span>
                    {b.author}
                    {b.textLanguage === "pt" ? " · PT" : ""}
                  </span>
                </button>
              ))}
        </div>
      ) : null}

      {searching && outside.length > 0 && !onlyCommunity ? (
        <div className="outside">
          <div className="outside-head">
            <h3>Fora do acervo</h3>
            <p>
              Estes livros ainda têm direitos autorais, então não estão no acervo. Tem o arquivo? Importe e
              leia aqui, com os personagens.
            </p>
          </div>
          <div className="result-grid">
            {outside.map((h) => (
              <div key={`${h.title}|${h.author}`} className="result outside-book">
                <div className="cover">
                  <img className="cover-photo is-loaded" src={h.coverUrl} alt="" loading="lazy" />
                </div>
                <strong>{h.title}</strong>
                <span>
                  {h.author}
                  {h.year ? ` · ${h.year}` : ""}
                </span>
                <button
                  type="button"
                  className="btn outside-import"
                  onClick={() => onImport(h)}
                  aria-label={`Importar o meu arquivo de ${h.title}`}
                >
                  {Icon.upload}
                  Importar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {searching && status === "ready" && next && !onlyCommunity ? (
        <div className="explore-more">
          <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Livros do próprio leitor (.epub, .pdf, .txt): lidos e guardados só neste aparelho. */
function MyBooks({
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

  const chapterCount = useMemo(() => (parsed ? splitIntoChapters(parsed.text).length : 0), [parsed]);

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
    if (share && !agree) return setError("Confirme a declaração de direitos para enviar ao acervo.");
    const id = newLocalBookId();
    const bookTitle = title.trim() || "Meu livro";
    const chosenCover = customCover ? await blobToDataUrl(customCover.blob).catch(() => null) : null;
    const characters = castFromNames(bookTitle, castText);
    const book: Ebook = {
      id: `local-${-id}`,
      gutenbergId: id,
      title: bookTitle,
      author: author.trim() || "Autor não informado",
      genre: "Meu livro",
      // Capa: a escolhida pela pessoa, a do catálogo ("Fora do acervo") ou a que veio no arquivo.
      ...((chosenCover ?? hint?.coverUrl ?? parsed.cover) ? { coverUrl: chosenCover ?? hint?.coverUrl ?? parsed.cover } : {}),
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
    if (!window.confirm(`Remover “${b.title}” deste aparelho? O progresso de leitura também será apagado.`)) {
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
          <span>Fica só neste aparelho</span>
        </button>
        {(showAllBooks ? books : books.slice(0, CONTINUE_PREVIEW)).map((b) => (
          <div key={b.gutenbergId} className="my-book">
            <button type="button" className="result" onClick={() => onOpen(b)}>
              <BookCover book={b} />
              <strong>{b.title}</strong>
              <span>{b.author}</span>
            </button>
            <button type="button" className="link-btn my-book-remove" onClick={() => void remove(b)}>
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

            <label className={`file-drop ${parsed ? "is-ready" : ""}`}>
              <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={onFile} disabled={parsing || saving} />
              <strong>
                {parsing ? "Lendo o arquivo…" : fileName || "Escolher arquivo"}
              </strong>
              <span>
                {parsed
                  ? `${chapterCount} ${chapterCount === 1 ? "parte encontrada" : "partes encontradas"} · toque para trocar`
                  : ".epub, .pdf ou .txt"}
              </span>
            </label>

            {parsed ? (
              <>
                <label className="field">
                  <span>Título</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
                </label>
                <label className="field">
                  <span>Autor</span>
                  <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
                </label>
                <label className="field">
                  <span>Idioma do texto</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as "pt" | "en")}>
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
                    placeholder={"Um por linha, por exemplo:\nBella Swan\nEdward Cullen — vampiro de 104 anos"}
                  />
                  <small>Em branco, a IA escolhe os personagens principais quando você abrir o livro.</small>
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
                        {coverBusy ? "Preparando…" : customCover ? "Trocar imagem" : "Escolher imagem"}
                        <input type="file" accept="image/*" onChange={(e) => void pickCover(e)} disabled={coverBusy || saving} />
                      </label>
                      {customCover ? (
                        <button type="button" className="inline-link" onClick={() => setCustomCover(null)} disabled={saving}>
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
                  <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
                  <span>
                    <strong>Sugerir para o acervo da comunidade</strong>
                    <small>Se for aprovado, outras pessoas também vão poder ler.</small>
                  </span>
                </label>
                {share ? (
                  <>
                    <div className="share-rights" role="radiogroup" aria-label="Por que pode ser compartilhado">
                      {RIGHTS_OPTIONS.map((o) => (
                        <label key={o.id} className={`share-right ${rights === o.id ? "is-on" : ""}`}>
                          <input type="radio" name="rights" checked={rights === o.id} onChange={() => setRights(o.id)} />
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
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                      <span>
                        Declaro que este livro pode ser compartilhado e entendo que ele será removido se violar
                        direitos autorais. Livros com direitos reservados (ex.: best-sellers atuais) são recusados.
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="import-error" role="alert">{error}</p> : null}

            <p className="import-note">
              O arquivo é lido no seu navegador e não é enviado para lugar nenhum. Livros com proteção
              contra cópia (DRM), como os comprados no Kindle, não abrem.
            </p>

            <div className="import-actions">
              <button type="button" className="btn" onClick={close} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!parsed || saving}>
                {saving ? (share ? "Enviando…" : "Guardando…") : share ? "Enviar e ler" : "Importar e ler"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

type LastBook = { title: string; chapterLabel?: string; character?: string };

/** Lembrete diário: calendário (qualquer aparelho) e notificação (Android com o app instalado). */
function ReminderSetup({
  lastBook,
  time,
  onTimeChange,
}: {
  lastBook?: LastBook;
  /** No perfil o horário é rascunho: quem salva é o botão "Salvar alterações". */
  time?: string;
  onTimeChange?: (time: string) => void;
}) {
  const [savedPrefs, setPrefs] = useState(loadReminderPrefs);
  const prefs = time ? { ...savedPrefs, time } : savedPrefs;
  const [status, setStatus] = useState<string | null>(null);
  const support = notificationSupport();
  const text = reminderText(lastBook);

  const update = (p: typeof prefs) => {
    if (onTimeChange && p.time !== savedPrefs.time) {
      onTimeChange(p.time);
      p = { ...p, time: savedPrefs.time };
    }
    setPrefs(p);
    saveReminderPrefs(p);
  };

  async function toggleNotifications() {
    if (prefs.notifications) {
      await disableDailyNotifications();
      update({ ...prefs, notifications: false });
      setStatus("Notificações desligadas.");
      return;
    }
    const result = await enableDailyNotifications();
    if (result === "enabled") {
      update({ ...prefs, notifications: true });
      setStatus("Pronto! Veja um exemplo de como o lembrete vai chegar.");
      void sendTestNotification();
    } else if (result === "denied") {
      setStatus("As notificações foram bloqueadas. Libere nas configurações do navegador para este site.");
    } else {
      setStatus("Este aparelho não permite lembretes automáticos. Use o calendário acima.");
    }
  }

  return (
    <div className="reminder">
      <div className="reminder-when">
        <span className="reminder-label">Lembrete diário</span>
        <label className="reminder-time">
          <span className="sr-only">Horário do lembrete</span>
          <input
            type="time"
            value={prefs.time}
            onChange={(e) => e.target.value && update({ ...prefs, time: e.target.value })}
          />
        </label>
        <p className="reminder-note">
          Você vai receber: <em>“{text.details}”</em>
        </p>
      </div>

      <div className="reminder-how">
        <span className="reminder-label">Como avisar</span>
        <div className="reminder-options">
          <a className="reminder-option" href={googleCalendarUrl(prefs.time, text)} target="_blank" rel="noreferrer">
            <span className="reminder-option-icon" aria-hidden="true">{Icon.calendar}</span>
            <strong>Google Agenda</strong>
            <span>Android e computador</span>
          </a>
          <button type="button" className="reminder-option" onClick={() => downloadIcs(prefs.time, text)}>
            <span className="reminder-option-icon" aria-hidden="true">{Icon.download}</span>
            <strong>Outro calendário</strong>
            <span>iPhone, Outlook e Apple</span>
          </button>
          {support === "supported" ? (
            <button
              type="button"
              className={`reminder-option ${prefs.notifications ? "is-on" : ""}`}
              onClick={() => void toggleNotifications()}
              aria-pressed={prefs.notifications}
            >
              <span className="reminder-option-icon" aria-hidden="true">{Icon.bell}</span>
              <strong>{prefs.notifications ? "Notificações ligadas" : "Notificação do app"}</strong>
              <span>{prefs.notifications ? "Toque para desligar" : "Avisa só se você esquecer"}</span>
            </button>
          ) : support === "install-first" ? (
            <div className="reminder-option is-disabled">
              <span className="reminder-option-icon" aria-hidden="true">{Icon.bell}</span>
              <strong>Notificação do app</strong>
              <span>Instale o app para ativar</span>
            </div>
          ) : null}
        </div>
        {status ? <p className="reminder-status" role="status">{status}</p> : null}
      </div>
    </div>
  );
}

/** Nome mostrado no perfil: o do cadastro ou, sem ele, o começo do e-mail. */
function displayNameOf(user: SupabaseUser): string {
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  return name || user.email.split("@")[0];
}

const PROFILE_COLORS = ["#e4b86a", "#9bc4b5", "#d7a0b4", "#a8b8e0", "#c9a27e", "#b7c98a"];
function profileColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROFILE_COLORS[h % PROFILE_COLORS.length];
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Avatar escolhido (dos prontos) ou a inicial do nome sobre a cor da conta. */
function metaString(user: SupabaseUser, key: string): string | null {
  const v = user.user_metadata?.[key];
  return typeof v === "string" && v ? v : null;
}

/** Foto enviada, senão o avatar pronto, senão a inicial do nome sobre a cor da conta. */
function UserAvatar({ user, className }: { user: SupabaseUser; className: string }) {
  const photo = metaString(user, "photo");
  const avatar = findAvatar(user.user_metadata?.avatar);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);
  if (photo && !broken) {
    return (
      <span className={`${className} has-photo`} aria-hidden="true">
        <img src={photo} alt="" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span
      className={`${className} ${avatar ? "has-art" : ""}`}
      style={{ "--c": avatar?.color ?? profileColor(user.id) } as React.CSSProperties}
      aria-hidden="true"
    >
      {avatar ? <AvatarArt avatar={avatar} /> : displayNameOf(user).charAt(0).toUpperCase()}
    </span>
  );
}

/** Rascunho de uma imagem do perfil: a salva, uma nova (ainda não enviada) ou removida. */
type ImageDraft = { url: string | null; blob: Blob | null };

/** Janela "Editar perfil": capa, foto, nome e avatar, com prévia e salvar na própria janela. */
function EditProfileModal({
  session,
  onSaved,
  onClose,
}: {
  session: SupabaseSession;
  onSaved: (session: SupabaseSession) => void;
  onClose: () => void;
}) {
  const savedName = displayNameOf(session.user);
  const savedAvatar = findAvatar(session.user.user_metadata?.avatar)?.id ?? null;
  const savedPhoto = metaString(session.user, "photo");
  const savedCover = metaString(session.user, "cover");
  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState<string | null>(savedAvatar);
  const [photo, setPhoto] = useState<ImageDraft>({ url: savedPhoto, blob: null });
  const [cover, setCover] = useState<ImageDraft>({ url: savedCover, blob: null });
  const [preparing, setPreparing] = useState<MediaKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim().slice(0, 60);
  const changed =
    trimmed !== savedName ||
    avatar !== savedAvatar ||
    photo.blob !== null ||
    photo.url !== savedPhoto ||
    cover.blob !== null ||
    cover.url !== savedCover;
  const busy = saving || preparing !== null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  // Prévias locais (blob:) liberadas ao trocar ou fechar.
  useEffect(() => () => void (photo.blob && photo.url && URL.revokeObjectURL(photo.url)), [photo]);
  useEffect(() => () => void (cover.blob && cover.url && URL.revokeObjectURL(cover.url)), [cover]);

  async function pick(kind: MediaKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setPreparing(kind);
    try {
      const blob = await prepareImage(file, kind);
      const draft = { url: URL.createObjectURL(blob), blob };
      if (kind === "avatar") setPhoto(draft);
      else setCover(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
    } finally {
      setPreparing(null);
    }
  }

  /** Escolher avatar pronto (ou a inicial) tira a foto: a foto sempre tem prioridade. */
  function chooseAvatar(id: string | null) {
    setAvatar(id);
    setPhoto({ url: null, blob: null });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return setError("Informe um nome.");
    if (!changed) return onClose();
    setSaving(true);
    setError("");
    try {
      const imageUrl = async (kind: MediaKind, draft: ImageDraft, saved: string | null) => {
        if (draft.blob) return uploadProfileImage(session, kind, draft.blob);
        if (!draft.url && saved) await removeProfileImage(session, kind);
        return draft.url;
      };
      const photoUrl = await imageUrl("avatar", photo, savedPhoto);
      const coverUrl = await imageUrl("cover", cover, savedCover);
      onSaved(await updateProfileData(session, { name: trimmed, avatar, photo: photoUrl, cover: coverUrl }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  }

  const preview: SupabaseUser = {
    ...session.user,
    user_metadata: { ...session.user.user_metadata, name: trimmed || savedName, avatar, photo: photo.url },
  };
  const initialUser = { ...preview, user_metadata: { ...preview.user_metadata, avatar: null, photo: null } };
  const coverStyle = cover.url ? ({ backgroundImage: `url("${cover.url}")` } as React.CSSProperties) : undefined;
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form className="auth-card edit-profile" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" onSubmit={save}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar" disabled={saving}>
          {Icon.close}
        </button>
        <h2 id="edit-profile-title">Editar perfil</h2>

        <div className={`edit-cover ${cover.url ? "has-cover" : ""}`} style={coverStyle}>
          <div className="edit-cover-actions">
            <label className={`btn edit-media-btn ${busy ? "is-disabled" : ""}`}>
              {Icon.camera}
              {preparing === "cover" ? "Preparando…" : cover.url ? "Trocar capa" : "Adicionar capa"}
              <input type="file" accept="image/*" onChange={(e) => void pick("cover", e)} disabled={busy} />
            </label>
            {cover.url ? (
              <button type="button" className="btn edit-media-btn" onClick={() => setCover({ url: null, blob: null })} disabled={busy}>
                Remover
              </button>
            ) : null}
          </div>
          <div className="edit-profile-preview">
            <UserAvatar user={preview} className="profile-avatar" />
            <label className={`edit-photo-btn ${busy ? "is-disabled" : ""}`} title="Enviar foto de perfil">
              {preparing === "avatar" ? <span className="spinner" aria-hidden="true" /> : Icon.camera}
              <span className="sr-only">Enviar foto de perfil</span>
              <input type="file" accept="image/*" onChange={(e) => void pick("avatar", e)} disabled={busy} />
            </label>
          </div>
        </div>
        <div className="edit-photo-row">
          {photo.url ? (
            <button type="button" className="inline-link" onClick={() => setPhoto({ url: null, blob: null })} disabled={busy}>
              Remover foto de perfil
            </button>
          ) : (
            <span>Toque na câmera para enviar uma foto, ou escolha um avatar abaixo.</span>
          )}
        </div>

        <label className="edit-profile-name">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" disabled={saving} />
        </label>

        <span className="edit-profile-label">Avatar</span>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatares">
          <button
            type="button"
            role="radio"
            aria-checked={!photo.url && avatar === null}
            className={`avatar-choice ${!photo.url && avatar === null ? "is-on" : ""}`}
            onClick={() => chooseAvatar(null)}
            disabled={busy}
          >
            <UserAvatar user={initialUser} className="avatar-choice-art" />
            <span>Inicial</span>
          </button>
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={!photo.url && avatar === a.id}
              className={`avatar-choice ${!photo.url && avatar === a.id ? "is-on" : ""}`}
              onClick={() => chooseAvatar(a.id)}
              disabled={busy}
            >
              <span className="avatar-choice-art has-art" style={{ "--c": a.color } as React.CSSProperties} aria-hidden="true">
                <AvatarArt avatar={a} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div className="edit-profile-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !changed}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Quem pediu menos movimento no sistema vê tudo parado. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Número que sobe de 0 até `value` ao aparecer (≈0,9 s, desacelerando no fim). */
function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function CountUp({ value, format = (n: number) => String(n) }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}

/** Nível do dia pela meta: 0 sem leitura, 1 pouco, 2 perto da meta, 3 meta cumprida. */
function dayLevel(minutes: number, goal: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) return 0;
  if (minutes >= goal) return 3;
  return minutes >= goal / 2 ? 2 : 1;
}
const LEVEL_LABELS = ["Sem leitura", "Pouco", "Perto da meta", "Meta cumprida"] as const;
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dayTitle(d: ReadingDay, goal?: number): string {
  const date = d.date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  if (d.state === "frozen") return `${date}: salvo por escudo`;
  const met = goal !== undefined && d.minutes >= goal;
  return `${date}: ${d.minutes} min${met ? " · meta cumprida ✓" : ""}`;
}

/**
 * Chama animada da sequência: camadas (vermelho → laranja → amarelo → miolo claro) tremulando em
 * ritmos diferentes, brilho pulsando e faíscas subindo. Apagada (cinza e parada) sem leitura hoje.
 */
function StreakFlame({ lit }: { lit: boolean }) {
  return (
    <span className={`streak-flame-anim ${lit ? "is-lit" : ""}`} aria-hidden="true">
      <span className="flame-glow" />
      <svg viewBox="0 0 64 84">
        <defs>
          <linearGradient id="flame-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#d9481c" />
            <stop offset="1" stopColor="#f07a2a" />
          </linearGradient>
          <linearGradient id="flame-mid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#f4902c" />
            <stop offset="1" stopColor="#ffc24a" />
          </linearGradient>
          <linearGradient id="flame-core" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#fff7dc" />
          </linearGradient>
        </defs>
        <path
          className="flame-layer flame-outer"
          fill="url(#flame-outer)"
          d="M32 3c5 13 19 21 19 42 0 19-9 34-19 34S13 64 13 45c0-10 5-17 9-24 1 6 4 10 8 11-2-10-1-19 2-29z"
        />
        <path
          className="flame-layer flame-mid"
          fill="url(#flame-mid)"
          d="M33 24c4 9 12 15 12 29 0 13-6 23-13 23s-13-10-13-23c0-7 3-12 6-16 1 4 3 7 6 7-1-7 0-14 2-20z"
        />
        <path
          className="flame-layer flame-core"
          fill="url(#flame-core)"
          d="M32 46c3 5 7 9 7 17 0 7-3 12-7 12s-7-5-7-12c0-5 3-9 7-17z"
        />
      </svg>
      <span className="flame-spark s1" />
      <span className="flame-spark s2" />
      <span className="flame-spark s3" />
    </span>
  );
}

/** Anel da meta de hoje (medidor: trilho e preenchimento do mesmo tom). */
function GoalRing({ minutes, goal }: { minutes: number; goal: number }) {
  const pct = Math.min(1, goal > 0 ? minutes / goal : 0);
  const r = 52;
  const len = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(prefersReducedMotion() ? pct : 0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  const done = minutes >= goal;
  return (
    <div className={`goal-ring ${done ? "is-done" : ""}`} role="img" aria-label={`Meta de hoje: ${minutes} de ${goal} minutos`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="goal-ring-track" cx="60" cy="60" r={r} />
        <circle
          className="goal-ring-fill"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={len}
          strokeDashoffset={len * (1 - drawn)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="goal-ring-center">
        <strong>
          <CountUp value={minutes} />
        </strong>
        <span>de {goal} min</span>
      </div>
    </div>
  );
}

/**
 * Dia escolhido num gráfico: ao passar o mouse ou tocar, o detalhe aparece no topo do cartão
 * (sem caixinha flutuando por cima das barras). Tocar de novo no mesmo dia solta.
 */
function useDayPick() {
  const [picked, setPicked] = useState<string | null>(null);
  const lastPointer = useRef("mouse");
  const bind = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    // Mouse: passar por cima já mostra; clicar só confirma.
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setPicked(key),
    // Toque: um toque mostra, outro toque no mesmo dia solta.
    onClick: () => (lastPointer.current === "mouse" ? setPicked(key) : setPicked((k) => (k === key ? null : key))),
    // Teclado (Tab): o foco mostra o dia. Foco vindo do toque não conta (senão o toque desfazia).
    onFocus: (e: React.FocusEvent) => e.currentTarget.matches(":focus-visible") && setPicked(key),
  });
  return { picked, bind, clear: () => setPicked(null) };
}

function DayDetail({ day, goal }: { day: ReadingDay; goal: number }) {
  const date = day.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  return (
    <span className="day-detail" role="status">
      <strong>{date}</strong>
      {day.state === "frozen" ? " · salvo por escudo 🛡️" : ` · ${day.minutes} min`}
      {day.state !== "frozen" && day.minutes >= goal ? <span className="day-detail-met"> · meta ✓</span> : null}
    </span>
  );
}

/** Barras dos últimos 7 dias; hoje em destaque e linha tracejada da meta. */
function WeekBars({ days, goal, total }: { days: ReadingDay[]; goal: number; total: string }) {
  const { picked, bind, clear } = useDayPick();
  const pickedDay = days.find((d) => d.key === picked);
  const top = Math.max(...days.map((d) => d.minutes));
  // Folga acima da meta e da maior barra (o número dela fica por cima, dentro do gráfico).
  const max = Math.max(goal * 1.25, top * 1.18, 1);
  const pct = (m: number) => `${(m / max) * 100}%`;
  return (
    <>
      <div className="dash-card-head">
        <span className="dash-label">Últimos 7 dias</span>
        {pickedDay ? <DayDetail day={pickedDay} goal={goal} /> : <span className="dash-sub">{total} no total</span>}
      </div>
      <div className="week-bars-wrap">
        <div className="week-plot" onPointerLeave={(e) => e.pointerType === "mouse" && clear()}>
          <div className="week-goal-line" style={{ bottom: pct(goal) }} aria-hidden="true" />
          {days.map((d, i) => {
            const today = i === days.length - 1;
            const label = today || (d.minutes === top && top > 0);
            return (
              <button
                type="button"
                key={d.key}
                className={`week-bar ${today ? "is-today" : ""} ${d.state === "frozen" ? "is-frozen" : ""} ${picked === d.key ? "is-picked" : ""}`}
                aria-label={dayTitle(d, goal)}
                aria-pressed={picked === d.key}
                {...bind(d.key)}
              >
                <span
                  className={`week-bar-fill ${d.minutes >= goal ? "is-met" : ""}`}
                  style={{ height: d.minutes > 0 ? `max(4px, ${pct(d.minutes)})` : 0, animationDelay: `${i * 60}ms` }}
                >
                  {label && d.minutes > 0 ? <span className="week-bar-value">{d.minutes}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="week-days" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.key} className={i === days.length - 1 ? "is-today" : picked === d.key ? "is-picked" : ""}>
              {i === days.length - 1 ? "hoje" : WEEKDAY_SHORT[d.date.getDay()]}
            </span>
          ))}
        </div>
        {/* Legenda fora do gráfico: o texto na linha passava por cima das barras. */}
        <div className="week-legend">
          <span className="week-legend-line" aria-hidden="true" />
          meta de {goal} min por dia
        </div>
      </div>
    </>
  );
}

/** Calendário de constância: semanas em colunas, meses em cima e dias da semana ao lado. */
const HEAT_CELL = 14;
const HEAT_GAP = 4;
const HEAT_LABEL_W = 30;
const HEAT_WEEKDAYS = ["", "seg", "", "qua", "", "sex", ""];

function ReadingHeatmap({ days: allDays, goal }: { days: ReadingDay[]; goal: number }) {
  const { picked, bind, clear } = useDayPick();
  // Quantas semanas cabem na largura (quadrados de tamanho fixo): ~1 ano no computador.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(16);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () =>
      setWeeks(Math.max(8, Math.min(53, Math.floor((el.clientWidth - HEAT_LABEL_W + HEAT_GAP) / (HEAT_CELL + HEAT_GAP)))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Colunas = semanas começando no domingo; a última termina hoje.
  const today = allDays[allDays.length - 1];
  const days = allDays.slice(-((weeks - 1) * 7 + today.date.getDay() + 1));
  const pickedDay = days.find((d) => d.key === picked);
  const readCount = days.filter((d) => d.minutes > 0).length;
  const metCount = days.filter((d) => d.minutes >= goal).length;

  // Nome do mês em cima da primeira semana em que ele aparece.
  const months: { col: number; label: string }[] = [];
  for (let col = 0; col * 7 < days.length; col++) {
    const first = days[col * 7].date;
    const prev = col > 0 ? days[(col - 1) * 7].date : null;
    if (!prev || prev.getMonth() !== first.getMonth()) {
      // Mês que começou no meio da primeira coluna: o nome vai na seguinte (não fica cortado).
      if (col === 0 && first.getDate() > 7) continue;
      months.push({ col, label: first.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
    }
  }

  return (
    <>
      <div className="dash-card-head heat-head">
        <span className="dash-label">Constância</span>
        {pickedDay ? (
          <DayDetail day={pickedDay} goal={goal} />
        ) : (
          <span className="heat-summary">
            <span>
              <strong>{readCount}</strong> {readCount === 1 ? "dia lido" : "dias lidos"}
            </span>
            <span>
              <strong>{metCount}</strong> {metCount === 1 ? "meta cumprida" : "metas cumpridas"} ✓
            </span>
            <span className="heat-summary-range">últimas {weeks} semanas</span>
          </span>
        )}
      </div>
      <div className="heatmap-wrap" ref={wrapRef} onPointerLeave={(e) => e.pointerType === "mouse" && clear()}>
        <div className="heat-months" aria-hidden="true" style={{ marginLeft: HEAT_LABEL_W }}>
          {months.map((m) => (
            <span key={m.col} style={{ left: m.col * (HEAT_CELL + HEAT_GAP) }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="heat-body">
          <div className="heat-weekdays" aria-hidden="true">
            {HEAT_WEEKDAYS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="heatmap">
            {days.map((d, i) => (
              <button
                type="button"
                key={d.key}
                className={`heat-cell lv-${d.state === "frozen" ? "frozen" : dayLevel(d.minutes, goal)} ${
                  d.key === today.key ? "is-today" : ""
                } ${picked === d.key ? "is-picked" : ""}`}
                style={{ animationDelay: `${Math.floor(i / 7) * 25}ms` }}
                aria-label={dayTitle(d, goal)}
                aria-pressed={picked === d.key}
                tabIndex={-1}
                {...bind(d.key)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-foot">
        <span className="heat-tip">Toque num dia (ou passe o mouse) para ver quanto leu.</span>
        <span className="heat-legend" aria-hidden="true">
          <span>
            <i className="heat-cell lv-0" />
            Sem leitura
          </span>
          {([1, 2, 3] as const).map((lv) => (
            <span key={lv}>
              <i className={`heat-cell lv-${lv}`} />
              {lv === 3 ? "Meta cumprida" : LEVEL_LABELS[lv]}
            </span>
          ))}
        </span>
      </div>
      {/* Mesmo dado em tabela, para leitores de tela. */}
      <table className="sr-only">
        <caption>Minutos lidos por dia</caption>
        <tbody>
          {days
            .filter((d) => d.minutes > 0 || d.state === "frozen")
            .map((d) => (
              <tr key={d.key}>
                <th>{d.date.toLocaleDateString("pt-BR")}</th>
                <td>{d.state === "frozen" ? "salvo por escudo" : `${d.minutes} min`}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}

/** Painel "Sua leitura" do perfil: meta de hoje, sequência, semana, constância e totais. */
function ReadingDashboard({
  summary,
  totals,
  finishedCount,
  markCount,
}: {
  summary: ReadingSummary;
  totals: ReadingTotals;
  finishedCount: number;
  markCount: number;
}) {
  const week = useMemo(() => readingDays(7), []);
  const history = useMemo(() => readingDays(53 * 7), []);
  const tiles = [
    { label: "Tempo lendo", value: totals.totalMinutes, format: formatMinutes },
    { label: "Nesta semana", value: totals.weekMinutes, format: formatMinutes },
    { label: "Livros terminados", value: finishedCount },
    { label: "Trechos marcados", value: markCount },
  ];
  return (
    <section className="dashboard" aria-label="Sua leitura">
      <div className="dash-card dash-goal">
        <span className="dash-label">Meta de hoje</span>
        <GoalRing minutes={summary.todayMinutes} goal={summary.goalMinutes} />
        {summary.todayMinutes >= summary.goalMinutes ? (
          <span className="goal-caption is-done">
            <span className="goal-ring-check">{Icon.check}</span>
            Meta cumprida!
          </span>
        ) : (
          <span className="goal-caption">
            faltam {summary.goalMinutes - summary.todayMinutes} min
          </span>
        )}
      </div>

      <div className={`dash-card dash-streak ${summary.readToday ? "is-lit" : ""}`}>
        <StreakFlame lit={summary.readToday} />
        <div className="dash-streak-info">
          <span className="dash-label">Sequência</span>
          <strong className="dash-hero">
            <CountUp value={summary.streak} />
            <small>{summary.streak === 1 ? "dia" : "dias"}</small>
          </strong>
          <span className="dash-sub">
            {summary.readToday
              ? "Você já leu hoje. O fogo está aceso!"
              : summary.streak > 0
                ? "Leia hoje para não apagar o fogo."
                : "Leia um pouco hoje para acender o fogo."}
          </span>
          <span className="dash-record">🏆 Recorde: {totals.bestStreak} {totals.bestStreak === 1 ? "dia" : "dias"}</span>
          {(() => {
            const { daysPerShield, maxShields } = SHIELD_RULES;
            if (summary.shields >= maxShields) {
              return <span className="dash-shield">🛡️ {summary.shields} escudos protegendo a sequência</span>;
            }
            const into = summary.streak % daysPerShield;
            return (
              <div className="dash-shield-progress" title="A cada 7 dias seguidos você ganha um escudo, que salva a sequência se um dia passar sem leitura.">
                <span>
                  🛡️ {summary.shields > 0 ? `${summary.shields} ${summary.shields === 1 ? "escudo" : "escudos"} · ` : ""}
                  faltam {daysPerShield - into} {daysPerShield - into === 1 ? "dia" : "dias"} para o próximo
                </span>
                <span className="dash-shield-bar">
                  <span style={{ width: `${(into / daysPerShield) * 100}%` }} />
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="dash-card dash-week">
        <WeekBars days={week} goal={summary.goalMinutes} total={formatMinutes(totals.weekMinutes)} />
      </div>

      <div className="dash-card dash-heat">
        <ReadingHeatmap days={history} goal={summary.goalMinutes} />
      </div>

      <div className="dash-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="dash-card dash-tile">
            <strong>
              <CountUp value={t.value} format={t.format} />
            </strong>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type ReadingPrefs = ReturnType<typeof loadPrefs>;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Tamanho aproximado em páginas (≈1.800 caracteres por página impressa). */
function pagesOf(chars: number | null): string {
  if (!chars) return "";
  const n = Math.max(1, Math.round(chars / 1800));
  return `~${n} ${n === 1 ? "página" : "páginas"}`;
}

const STATUS_LABELS: Record<Submission["status"], string> = {
  pending: "Em análise",
  approved: "Publicado",
  rejected: "Recusado",
};

/** Envios do próprio leitor, com o andamento de cada um (no perfil). */
function MySubmissions({ session }: { session: SupabaseSession }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  useEffect(() => {
    void listSubmissions(session, "mine").then(setItems).catch(() => setItems([]));
  }, [session]);

  async function withdraw(s: Submission) {
    if (!window.confirm(`Desistir de enviar “${s.title}”?`)) return;
    try {
      await deleteSubmission(session, s);
      setItems((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Não foi possível desistir agora.");
    }
  }

  if (!items || items.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>Seus envios</h2>
        <p>Livros que você sugeriu para o acervo da comunidade.</p>
      </div>
      <ul className="submission-list">
        {items.map((s) => (
          <li key={s.id} className="profile-card submission">
            <div className="submission-main">
              <strong>{s.title}</strong>
              <span>
                {s.author || "Autor não informado"} · enviado em {formatDate(s.created_at)}
              </span>
              {s.status === "rejected" && s.review_note ? <p className="submission-note">Motivo: {s.review_note}</p> : null}
            </div>
            <span className={`status-chip is-${s.status}`}>{STATUS_LABELS[s.status]}</span>
            {s.status === "pending" ? (
              <button type="button" className="link-btn" onClick={() => void withdraw(s)}>
                Desistir
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ano a partir do qual a obra quase certamente ainda tem direitos autorais (autor vivo ou morto há < 70 anos). */
const LIKELY_PROTECTED_AFTER = 1955;

/** Alerta da moderação: obra publicada recentemente (pela Open Library) provavelmente é protegida. */
function RightsAlert({ title, author, onProtected }: { title: string; author?: string | null; onProtected?: (flag: boolean) => void }) {
  const [info, setInfo] = useState<PublicationInfo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void lookupPublication(title, author ?? "").then((r) => {
      if (!alive) return;
      setInfo(r);
      onProtected?.(Boolean(r && r.year > LIKELY_PROTECTED_AFTER));
    });
    return () => {
      alive = false;
    };
  }, [title, author]);
  if (info === undefined) return <p className="rights-alert is-checking">Conferindo a obra na Open Library…</p>;
  if (!info) return <p className="rights-alert is-unknown">Não encontramos esta obra na Open Library. Confira os direitos antes de aprovar.</p>;
  const by = info.authors.slice(0, 2).join(", ");
  if (info.year > LIKELY_PROTECTED_AFTER) {
    return (
      <p className="rights-alert is-danger" role="alert">
        ⚠️ <strong>Possível obra protegida:</strong> “{info.title}”{by ? `, de ${by},` : ""} foi publicada em {info.year}. Obras
        recentes quase sempre têm direitos autorais — só aprove com autorização do autor ou da editora.
      </p>
    );
  }
  return (
    <p className="rights-alert is-ok">
      “{info.title}”{by ? `, de ${by},` : ""} foi publicada em {info.year}: pode ser domínio público (confira a data de
      morte do autor: mais de 70 anos).
    </p>
  );
}

/** Moderação (só admin): aprovar ou recusar envios e tirar livros do acervo. */
function ModerationPage({
  session,
  onClose,
  onRead,
}: {
  session: SupabaseSession;
  onClose: () => void;
  onRead: (book: Ebook) => void;
}) {
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [pending, setPending] = useState<Submission[] | null>(null);
  const [approved, setApproved] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    Promise.all([listSubmissions(session, "pending"), listSubmissions(session, "approved")])
      .then(([p, a]) => {
        setPending(p);
        setApproved(a);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível carregar os envios."));
  }, [session]);

  /** Envios que a Open Library indica como obra recente (provavelmente protegida). */
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  /** Autorização confirmada pelo admin para aprovar mesmo assim. */
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({});

  async function approve(s: Submission) {
    if (flagged[s.id] && !authorized[s.id]) {
      return setError("Obra provavelmente protegida: confirme que tem autorização do autor ou da editora antes de aprovar.");
    }
    setBusyId(s.id);
    setError("");
    try {
      // Capa encontrada agora fica gravada no livro (não precisa buscar ao mostrar).
      const cover = s.cover_url ?? (await findOpenLibraryCover(s.title, s.author ?? "", s.language).catch(() => undefined));
      const updated = await reviewSubmission(session, s.id, "approved", undefined, cover ?? null);
      setPending((list) => list?.filter((x) => x.id !== s.id) ?? null);
      setApproved((list) => [updated, ...(list ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(s: Submission, note: string) {
    if (!note.trim()) return setError("Escreva o motivo da recusa: quem enviou vai ver.");
    setBusyId(s.id);
    setError("");
    try {
      await reviewSubmission(session, s.id, "rejected", note);
      setPending((list) => list?.filter((x) => x.id !== s.id) ?? null);
      setRejecting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível recusar.");
    } finally {
      setBusyId(null);
    }
  }

  /** Troca a capa por uma imagem do aparelho (mesmo recorte 400×600 da importação). */
  async function changeCover(s: Submission, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusyId(s.id);
    setError("");
    try {
      const updated = await changeSubmissionCover(session, s, await prepareImage(file, "book"));
      const swap = (list: Submission[] | null) => list?.map((x) => (x.id === s.id ? updated : x)) ?? null;
      setPending(swap);
      setApproved(swap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a capa.");
    } finally {
      setCoverBusyId(null);
    }
  }

  async function remove(s: Submission) {
    if (!window.confirm(`Tirar “${s.title}” do acervo? O arquivo também será apagado.`)) return;
    setBusyId(s.id);
    setError("");
    try {
      await deleteSubmission(session, s);
      setApproved((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
  }

  const list = tab === "pending" ? pending : approved;
  return (
    <div className="home profile moderation">
      <nav className="home-nav profile-nav">
        <button type="button" className="btn" onClick={onClose}>
          {Icon.back} Voltar
        </button>
      </nav>
      <header className="moderation-head">
        <span className="eyebrow">Admin</span>
        <h1>Moderação do acervo</h1>
        <p>
          Aprove só o que pode ser distribuído: domínio público, obra do próprio autor ou licença livre. Na dúvida,
          recuse.
        </p>
      </header>

      <div className="segmented moderation-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "pending"} className={tab === "pending" ? "is-on" : ""} onClick={() => setTab("pending")}>
          Em análise{pending ? ` (${pending.length})` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "approved"} className={tab === "approved" ? "is-on" : ""} onClick={() => setTab("approved")}>
          Publicados{approved ? ` (${approved.length})` : ""}
        </button>
      </div>

      {error ? <p className="auth-error moderation-error" role="alert">{error}</p> : null}

      {list === null && !error ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando envios…
        </div>
      ) : list && list.length === 0 ? (
        <p className="profile-empty moderation-empty">
          {tab === "pending" ? "Nenhum envio esperando análise. 🎉" : "Nenhum livro publicado ainda."}
        </p>
      ) : (
        <ul className="submission-list">
          {list?.map((s) => (
            <li key={s.id} className="profile-card moderation-item">
              <div className="moderation-body">
                <div className="moderation-cover">
                  <BookCover book={submissionToEbook(s)} />
                  <label className={`btn moderation-cover-btn ${coverBusyId === s.id ? "is-disabled" : ""}`}>
                    {Icon.camera}
                    {coverBusyId === s.id ? "Enviando…" : "Trocar capa"}
                    <input type="file" accept="image/*" onChange={(e) => void changeCover(s, e)} disabled={coverBusyId === s.id} />
                  </label>
                </div>
                <div className="submission-main">
                  <strong>{s.title}</strong>
                  <span>
                    {s.author || "Autor não informado"} · {s.language === "en" ? "Inglês" : "Português"}
                    {s.char_count ? ` · ${pagesOf(s.char_count)}` : ""}
                  </span>
                  <span>
                    Enviado por {s.submitter_name || "leitor"} em {formatDate(s.created_at)}
                    {s.reviewed_at && tab === "approved" ? ` · publicado em ${formatDate(s.reviewed_at)}` : ""}
                  </span>
                  <p className="moderation-rights">
                    <strong>{rightsLabel(s.rights)}</strong>
                    {s.rights_note ? ` — ${s.rights_note}` : " — sem justificativa"}
                  </p>
                  <RightsAlert title={s.title} author={s.author} onProtected={(flag) => setFlagged((m) => ({ ...m, [s.id]: flag }))} />
                  {tab === "pending" && flagged[s.id] ? (
                    <label className="rights-confirm">
                      <input
                        type="checkbox"
                        checked={Boolean(authorized[s.id])}
                        onChange={(e) => setAuthorized((m) => ({ ...m, [s.id]: e.target.checked }))}
                      />
                      <span>
                        Tenho autorização por escrito do autor ou da editora para distribuir esta obra no Storyverse.
                      </span>
                    </label>
                  ) : null}
                  {s.characters ? <p className="submission-note">Personagens: {s.characters.split("\n").filter(Boolean).join(", ")}</p> : null}
                </div>
              </div>

              {rejecting?.id === s.id ? (
                <div className="moderation-reject">
                  <textarea
                    value={rejecting.note}
                    onChange={(e) => setRejecting({ id: s.id, note: e.target.value })}
                    rows={2}
                    maxLength={500}
                    placeholder="Motivo (quem enviou vai ver). Ex.: obra ainda tem direitos autorais."
                    autoFocus
                  />
                  <div className="moderation-actions">
                    <button type="button" className="btn" onClick={() => setRejecting(null)} disabled={busyId === s.id}>
                      Cancelar
                    </button>
                    <button type="button" className="btn profile-logout" onClick={() => void reject(s, rejecting.note)} disabled={busyId === s.id}>
                      {busyId === s.id ? "Recusando…" : "Recusar envio"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="moderation-actions">
                  <button type="button" className="btn" onClick={() => onRead(submissionToEbook(s))}>
                    {Icon.book} Ler
                  </button>
                  {tab === "pending" ? (
                    <>
                      <button type="button" className="btn profile-logout" onClick={() => setRejecting({ id: s.id, note: "" })} disabled={busyId === s.id}>
                        Recusar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void approve(s)}
                        disabled={busyId === s.id || (flagged[s.id] && !authorized[s.id])}
                        title={flagged[s.id] && !authorized[s.id] ? "Confirme a autorização para aprovar" : undefined}
                      >
                        {busyId === s.id ? "Aprovando…" : "Aprovar"}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn profile-logout" onClick={() => void remove(s)} disabled={busyId === s.id}>
                      {busyId === s.id ? "Removendo…" : "Tirar do acervo"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Enquanto `open`, o botão voltar do celular fecha esta tela/janela (chama `close`) em vez de
 * sair do app. Fechada pelo próprio app, o passo sai do histórico sozinho.
 */
function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    let closedByBack = false;
    const id = pushLayer(() => {
      closedByBack = true;
      closeRef.current();
    });
    return () => {
      if (!closedByBack) removeLayer(id);
    };
  }, [open]);
}

/** Quantas pessoas estão na sala agora (null enquanto conecta ou sem Realtime). */
function usePresenceCount(room: string | null, who: string | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(null);
    if (!room) return;
    return watchPresence(room, who, setCount);
  }, [room, who]);
  return count;
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio do aparelho. */
function greetingNow(d = new Date()): string {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Estante em destaque para quem já está lendo: fileira que rola para o lado, com cartões
 * compactos (capa, título, autor, personagens). A sinopse aparece ao passar o mouse.
 */
function FeaturedRow({
  id,
  title,
  subtitle,
  books,
  progressById,
  onOpen,
}: {
  id?: string;
  title: string;
  subtitle: string;
  books: Ebook[];
  progressById: Map<number, ReadingProgress>;
  onOpen: (b: Ebook) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges]);
  const scroll = (dir: 1 | -1) => {
    const el = rowRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="shelf featured-row" id={id}>
      <div className="shelf-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="row-nav" aria-hidden="true">
          <button type="button" className="icon-btn" onClick={() => scroll(-1)} disabled={edges.start} tabIndex={-1}>
            {Icon.back}
          </button>
          <button type="button" className="icon-btn" onClick={() => scroll(1)} disabled={edges.end} tabIndex={-1}>
            {Icon.next}
          </button>
        </div>
      </div>
      <div className="shelf-row" ref={rowRef} onScroll={updateEdges}>
        {books.map((b) => {
          const progress = progressById.get(b.gutenbergId);
          const pct = progress ? Math.round(progressPct(progress)) : null;
          return (
            <button key={b.id} type="button" className="row-card" onClick={() => onOpen(b)} title={b.blurb}>
              <BookCover book={b} />
              {pct !== null ? (
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
              ) : null}
              <strong>{b.title}</strong>
              <span className="row-card-author">{b.author}</span>
              {b.characters?.length ? (
                <span className="row-card-cast">
                  <span className="avatar-stack">
                    {b.characters.slice(0, 3).map((c) => (
                      <Avatar key={c.id} character={c} size="sm" bookTitle={b.title} />
                    ))}
                  </span>
                  {pct !== null ? `${pct}% lido` : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Estante do perfil: mostra 4 e o resto em "Ver todos", como em Continue lendo. */
function ProfileShelf({
  title,
  subtitle,
  eyebrow,
  className,
  items,
  empty,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
  items: { book: Ebook; sub: string; pct?: number; badge?: string }[];
  empty?: string;
  onOpen: (book: Ebook) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0 && !empty) return null;
  const shown = showAll ? items : items.slice(0, CONTINUE_PREVIEW);
  return (
    <section className={`shelf ${className ?? ""}`}>
      <div className="shelf-head">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="profile-empty">{empty}</p>
      ) : (
        <div className="result-grid">
          {shown.map(({ book, sub, pct, badge }) => (
            <button key={book.id} type="button" className="result" onClick={() => onOpen(book)}>
              {badge ? <span className="new-badge">{badge}</span> : null}
              <BookCover book={book} />
              {pct !== undefined ? (
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
              ) : null}
              <strong>{book.title}</strong>
              <span>{sub}</span>
            </button>
          ))}
        </div>
      )}
      {items.length > CONTINUE_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Perfil: quem é o leitor, números da leitura, estante, marcações, preferências e conta.
 * Nome, avatar e preferências são um rascunho até tocar em "Salvar alterações".
 */
function ProfilePage({
  session,
  onSessionChange,
  onClose,
  onLogout,
  loggingOut,
  onOpenBook,
  onOpenHighlight,
  prefs,
  setPrefs,
  lastBook,
  isAdmin,
  onOpenModeration,
}: {
  session: SupabaseSession;
  onSessionChange: (session: SupabaseSession) => void;
  onClose: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  onOpenBook: (book: Ebook) => void;
  onOpenHighlight: (book: Ebook, h: Highlight) => void;
  prefs: ReadingPrefs;
  setPrefs: React.Dispatch<React.SetStateAction<ReadingPrefs>>;
  lastBook?: LastBook;
  isAdmin?: boolean;
  onOpenModeration?: () => void;
}) {
  const user = session.user;
  const name = displayNameOf(user);
  const since = memberSince(user.created_at);

  const [summary, setSummary] = useState(readingSummary);
  const totals = useMemo(readingTotals, []);
  const reading = useMemo(recentProgress, []);
  const finished = useMemo(finishedBooks, []);
  const [imported, setImported] = useState<Ebook[]>([]);
  useEffect(() => {
    void listLocalBooks().then(setImported).catch(() => {});
  }, []);

  // ---- Rascunho das preferências (só vale depois de salvar) ----
  const [goal, setGoal] = useState(summary.goalMinutes);
  const [theme, setTheme] = useState(prefs.theme);
  const [nightLight, setNightLight] = useState<NightLight>(prefs.nightLight);
  const [reminderTime, setReminderTime] = useState(() => loadReminderPrefs().time);
  const [editOpen, setEditOpen] = useState(false);
  useBackClose(editOpen, () => setEditOpen(false));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty =
    goal !== summary.goalMinutes ||
    theme !== prefs.theme ||
    nightLight !== prefs.nightLight ||
    reminderTime !== loadReminderPrefs().time;

  function discard() {
    setGoal(summary.goalMinutes);
    setTheme(prefs.theme);
    setNightLight(prefs.nightLight);
    setReminderTime(loadReminderPrefs().time);
    setSaveError("");
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      setReadingGoalMinutes(goal);
      setSummary(readingSummary());
      setPrefs((p) => ({ ...p, theme, nightLight }));
      saveReminderPrefs({ ...loadReminderPrefs(), time: reminderTime });
      setSavedFlash(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(false), 2600);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

  function leave() {
    if (dirty && !window.confirm("Sair sem salvar as alterações?")) return;
    onClose();
  }

  // Livro de cada marcação: dos começados, terminados, importados ou da estante.
  const bookById = useMemo(() => {
    const map = new Map<string, Ebook>();
    for (const b of featuredBooks) map.set(b.id, b);
    for (const b of imported) map.set(b.id, b);
    for (const f of finished) map.set(f.book.id, f.book);
    for (const p of reading) map.set(p.book.id, p.book);
    return map;
  }, [imported, finished, reading]);

  const marks = useMemo(
    () =>
      allHighlights()
        .map(({ bookId, highlights }) => {
          const groups = new Map<string, { first: Highlight; text: string }>();
          for (const h of [...highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.paragraph - b.paragraph)) {
            const key = h.group ?? h.id;
            const g = groups.get(key);
            if (g) g.text = `${g.text} ${h.text}`;
            else groups.set(key, { first: h, text: h.text });
          }
          return { book: bookById.get(bookId), items: [...groups.values()] };
        })
        .filter((m): m is { book: Ebook; items: { first: Highlight; text: string }[] } => Boolean(m.book)),
    [bookById],
  );
  const markCount = marks.reduce((n, m) => n + m.items.length, 0);
  const lendo = reading.filter((p) => !finished.some((f) => f.book.id === p.book.id));

  // ---- Senha (ação direta, com o próprio botão) ----
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwState, setPwState] = useState<{ loading?: boolean; error?: string; ok?: string }>({});
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setPwState({ error: "A senha precisa ter pelo menos 6 caracteres." });
    if (pw !== pwConfirm) return setPwState({ error: "As duas senhas não são iguais." });
    setPwState({ loading: true });
    try {
      await updatePassword(session, pw);
      setPw("");
      setPwConfirm("");
      setPwOpen(false);
      setPwState({ ok: "Senha trocada." });
    } catch (err) {
      setPwState({ error: err instanceof Error ? err.message : "Não foi possível trocar a senha." });
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // Fechar a aba ou recarregar com alterações pendentes: o navegador pergunta antes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const chosenAvatar = findAvatar(user.user_metadata?.avatar);


  return (
    <div className={`home profile ${dirty ? "has-savebar" : ""}`}>
      {editOpen ? <EditProfileModal session={session} onSaved={onSessionChange} onClose={() => setEditOpen(false)} /> : null}
      <nav className="home-nav profile-nav">
        <button type="button" className="btn" onClick={leave}>
          {Icon.back} Voltar
        </button>
      </nav>

      <header
        className={`profile-hero ${metaString(user, "cover") ? "has-cover" : ""}`}
      >
        {/* Capa: faixa dentro do cartão (fora da borda), que se dissolve no fundo. */}
        {metaString(user, "cover") ? (
          <div
            className="profile-cover"
            style={{ backgroundImage: `url("${metaString(user, "cover")}")` } as React.CSSProperties}
            aria-hidden="true"
          />
        ) : null}
        <div className="profile-hero-glow" style={{ "--c": chosenAvatar?.color ?? profileColor(user.id) } as React.CSSProperties} aria-hidden="true" />
        <button type="button" className="profile-avatar-btn" onClick={() => setEditOpen(true)} aria-label="Editar perfil">
          <UserAvatar user={user} className="profile-avatar" />
          <span className="profile-avatar-edit" aria-hidden="true">{Icon.pencil}</span>
        </button>
        <div className="profile-id">
          <h1>{name}</h1>
          <p>
            {user.email}
            {since ? ` · lendo no Storyverse desde ${since}` : ""}
          </p>
        </div>
      </header>

      <ReadingDashboard summary={summary} totals={totals} finishedCount={finished.length} markCount={markCount} />
      <p className="profile-device-note">Os números e as marcações são deste aparelho.</p>

      <ProfileShelf
        title="Lendo agora"
        empty="Nenhum livro começado ainda."
        onOpen={onOpenBook}
        items={lendo.map((p) => {
          const pct = Math.round(progressPct(p));
          return { book: p.book, sub: `${p.chapterLabel} · ${pct}%`, pct };
        })}
      />
      <ProfileShelf
        title="Terminados"
        onOpen={onOpenBook}
        items={finished.map((f) => ({
          book: f.book,
          sub: `Terminado em ${new Date(f.finishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
        }))}
      />
      <ProfileShelf title="Seus livros importados" onOpen={onOpenBook} items={imported.map((b) => ({ book: b, sub: b.author }))} />

      <MySubmissions session={session} />

      <section className="shelf">
        <div className="shelf-head">
          <h2>Marcações</h2>
          <p>Os trechos que você destacou, de todos os livros.</p>
        </div>
        {marks.length === 0 ? (
          <p className="profile-empty">
            Selecione um trecho durante a leitura e toque em <strong>Marcar</strong> para guardar aqui.
          </p>
        ) : (
          <div className="profile-marks">
            {marks.map(({ book, items }) => (
              <div key={book.id} className="profile-card profile-mark-book">
                <h3>{book.title}</h3>
                <ul className="marks-list">
                  {items.map(({ first, text }) => (
                    <li key={first.group ?? first.id}>
                      <span className="marks-chapter">{first.chapterLabel}</span>
                      <blockquote>{text}</blockquote>
                      <div className="marks-actions">
                        <button type="button" className="link-btn" onClick={() => onOpenHighlight(book, first)}>
                          Abrir no trecho
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="shelf">
        <div className="shelf-head">
          <h2>Preferências</h2>
        </div>
        <div className="profile-card profile-prefs">
          <div className="profile-pref">
            <span>Meta diária</span>
            <div className="segmented" role="radiogroup" aria-label="Meta diária">
              {GOAL_OPTIONS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={goal === m} className={goal === m ? "is-on" : ""} onClick={() => setGoal(m)}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div className="profile-pref">
            <span>Tema de leitura</span>
            <div className="segmented" role="radiogroup" aria-label="Tema de leitura">
              {(["night", "sepia"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? "is-on" : ""} onClick={() => setTheme(t)}>
                  {t === "night" ? "Noturno" : "Sépia"}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-pref">
            <span>Luz noturna</span>
            <div className="segmented" role="radiogroup" aria-label="Luz noturna">
              {([0, 1, 2] as const).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={nightLight === n} className={nightLight === n ? "is-on" : ""} onClick={() => setNightLight(n)}>
                  {NIGHT_LIGHT_LABELS[n].charAt(0).toUpperCase() + NIGHT_LIGHT_LABELS[n].slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ReminderSetup lastBook={lastBook} time={reminderTime} onTimeChange={setReminderTime} />
        </div>
      </section>

      {isAdmin ? (
        <section className="shelf">
          <div className="shelf-head">
            <h2>Admin</h2>
          </div>
          <div className="profile-card profile-admin">
            <div>
              <strong>Moderação do acervo</strong>
              <span>Aprove ou recuse os livros que os leitores sugeriram.</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={onOpenModeration}>
              Abrir moderação
            </button>
          </div>
        </section>
      ) : null}

      <section className="shelf">
        <div className="shelf-head">
          <h2>Conta</h2>
        </div>
        <div className="profile-card profile-account">
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">E-mail</span>
              <strong>{user.email}</strong>
            </div>
          </div>
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Senha</span>
              <strong>••••••••</strong>
            </div>
            {!pwOpen ? (
              <button type="button" className="btn" onClick={() => { setPwOpen(true); setPwState({}); }}>
                Trocar senha
              </button>
            ) : null}
          </div>
          {pwOpen ? (
            <form className="auth-form profile-pw-form" onSubmit={savePassword}>
              <label>
                Senha nova
                <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={6} required disabled={pwState.loading} />
              </label>
              <label>
                Repita a senha
                <PasswordInput value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" minLength={6} required disabled={pwState.loading} />
              </label>
              {pwState.error ? <p className="auth-error" role="alert">{pwState.error}</p> : null}
              <div className="profile-pw-actions">
                <button type="button" className="btn" onClick={() => { setPwOpen(false); setPwState({}); }} disabled={pwState.loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={pwState.loading}>
                  {pwState.loading ? "Salvando…" : "Salvar senha"}
                </button>
              </div>
            </form>
          ) : null}
          {pwState.ok ? <p className="auth-success" role="status">{pwState.ok}</p> : null}
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Sessão</span>
              <strong>Conectado neste aparelho</strong>
            </div>
            <button type="button" className="btn profile-logout" onClick={onLogout} disabled={loggingOut}>
              {loggingOut ? "Saindo…" : "Sair da conta"}
            </button>
          </div>
        </div>
      </section>

      {dirty ? (
        <div className="profile-savebar" role="region" aria-label="Alterações não salvas">
          <span>{saveError || "Você tem alterações não salvas."}</span>
          <div>
            <button type="button" className="btn" onClick={discard} disabled={saving}>
              Descartar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      ) : savedFlash ? (
        <div className="profile-savebar is-saved" role="status">
          <span>✓ Alterações salvas</span>
        </div>
      ) : null}
    </div>
  );
}

/** Sequência de dias lendo, semana, escudos, meta diária de minutos e lembrete. */
function ReadingStreak({ lastBook }: { lastBook?: LastBook }) {
  const [summary, setSummary] = useState(readingSummary);
  const [reminderOpen, setReminderOpen] = useState(false);
  const pct = Math.min(100, (summary.todayMinutes / summary.goalMinutes) * 100);
  const goalDone = summary.todayMinutes >= summary.goalMinutes;
  return (
    <section className="streak" aria-label="Sua leitura">
      <div className="streak-main">
        <span className={`streak-flame ${summary.readToday ? "is-lit" : ""}`} aria-hidden="true">
          🔥
        </span>
        <div>
          <strong>
            {summary.streak} {summary.streak === 1 ? "dia seguido" : "dias seguidos"}
          </strong>
          <span>
            {summary.readToday
              ? "Você já leu hoje. Continue assim!"
              : summary.streak > 0
                ? "Leia hoje para não perder a sequência."
                : "Leia um pouco hoje para começar uma sequência."}
          </span>
          <span
            className="streak-shields"
            title="A cada 7 dias seguidos você ganha um escudo (até 2). Se um dia passar sem leitura, ele salva a sua sequência."
          >
            {summary.shields > 0
              ? `🛡️ ${summary.shields} ${summary.shields === 1 ? "escudo" : "escudos"} protegendo a sequência`
              : "🛡️ Ganhe um escudo a cada 7 dias seguidos"}
          </span>
        </div>
      </div>

      <ol className="streak-week" aria-label="Últimos 7 dias">
        {summary.week.map((d, i) => (
          <li
            key={i}
            className={[`is-${d.state}`, d.today ? "is-today" : ""].filter(Boolean).join(" ")}
            aria-label={`${d.today ? "Hoje" : d.label}: ${d.state === "read" ? "leu" : d.state === "frozen" ? "salvo por escudo" : "não leu"}`}
          >
            {d.state === "frozen" ? "🛡️" : d.label}
          </li>
        ))}
      </ol>

      <div className="streak-goal">
        <div className="streak-goal-text">
          <span>Meta de hoje</span>
          <strong>
            {goalDone ? "Meta cumprida! " : ""}
            {summary.todayMinutes} de {summary.goalMinutes} min
          </strong>
        </div>
        <div className={`streak-bar ${goalDone ? "is-done" : ""}`} aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="streak-goal-foot">
          <button
            type="button"
            className="inline-link"
            onClick={() => setReminderOpen((v) => !v)}
            aria-expanded={reminderOpen}
          >
            🔔 Lembrete diário
          </button>
          <label className="streak-select">
            Meta diária
            <select
              value={summary.goalMinutes}
              onChange={(e) => {
                setReadingGoalMinutes(Number(e.target.value));
                setSummary(readingSummary());
              }}
            >
              {GOAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {reminderOpen ? <ReminderSetup lastBook={lastBook} /> : null}
    </section>
  );
}

/** Comemoração no centro da tela (meta do dia, sequência, livro terminado). */
type Celebration = { emoji: string; title: string; text?: string };

/** Quantos livros "Continue lendo" mostra antes de "Ver todos". */
const CONTINUE_PREVIEW = 4;

/** Livros começados, para retomar do ponto onde o leitor parou: os 4 mais recentes e "Ver todos". */
function ContinueReading({
  items,
  onOpen,
  onRemove,
  undo,
  onUndo,
}: {
  items: ReadingProgress[];
  onOpen: (b: Ebook) => void;
  /** Tira o livro da lista (o leitor não quer mais continuar). */
  onRemove: (p: ReadingProgress) => void;
  /** Livro que acabou de sair da lista, enquanto ainda dá para desfazer. */
  undo: ReadingProgress | null;
  onUndo: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, CONTINUE_PREVIEW);

  return (
    <section className="shelf continue">
      <div className="shelf-head">
        <h2>Continue lendo</h2>
        <p>Volte exatamente de onde parou.</p>
      </div>
      {undo ? (
        <div className="continue-undo" role="status">
          <span>
            “{undo.book.title}” saiu de Continue lendo.
          </span>
          <button type="button" className="inline-link" onClick={onUndo}>
            Desfazer
          </button>
        </div>
      ) : null}
      <div className="result-grid">
        {shown.map((p) => {
          const pct = Math.round(progressPct(p));
          return (
            <div key={p.book.gutenbergId} className="my-book">
              <button
                type="button"
                className="result"
                onClick={() => onOpen(p.book)}
                aria-label={`Continuar ${p.book.title}, ${p.chapterLabel}, ${pct}% lido`}
              >
                <BookCover book={p.book} />
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
                <strong>{p.book.title}</strong>
                <span>
                  {p.chapterLabel} · {pct}%
                </span>
              </button>
              <button
                type="button"
                className="link-btn my-book-remove"
                onClick={() => onRemove(p)}
                aria-label={`Tirar ${p.book.title} de Continue lendo`}
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>
      {items.length > CONTINUE_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Campo de senha com o "olhinho" para mostrar ou esconder o que foi digitado. */
function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        // Mantém o cursor no campo ao mostrar/esconder.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        disabled={props.disabled}
      >
        {visible ? Icon.eyeOff : Icon.eye}
      </button>
    </span>
  );
}

/** O Supabase só deixa reenviar e-mail para o mesmo endereço depois de 60 s. */
const RESEND_COOLDOWN = 60;

function AuthModal({
  mode,
  onClose,
  onAuthenticated,
}: {
  mode: "login" | "register";
  onClose: () => void;
  onAuthenticated: (session: SupabaseSession) => void;
}) {
  const [kind, setKind] = useState<"login" | "register" | "forgot">(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  /** Depois do envio: tela de "confira seu e-mail" (link de cadastro, código ou link de senha nova). */
  const [sent, setSent] = useState<"confirm" | "code" | "reset" | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // O foco fica no livro clicado atrás do modal e deixaria o carrossel parado depois de fechar.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  function goTo(next: "login" | "register" | "forgot") {
    setKind(next);
    setSent(null);
    setError("");
    setSuccess("");
  }

  function showSent(next: "confirm" | "code" | "reset") {
    setSent(next);
    setVerificationCode("");
    setCooldown(RESEND_COOLDOWN);
  }

  async function confirmEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Digite os 6 números do código que enviamos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onAuthenticated(await verifySignupCode(normalizedEmail, verificationCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível verificar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (sent === "reset") await requestPasswordReset(normalizedEmail);
      else await resendSignupCode(normalizedEmail);
      setSuccess(sent === "code" ? "Código novo enviado." : "E-mail enviado de novo.");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar agora.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }
    if (kind !== "forgot" && (!password || (kind === "register" && password.length < 6))) {
      setError(kind === "register" ? "A senha precisa ter pelo menos 6 caracteres." : "Informe sua senha.");
      return;
    }
    if (kind === "register" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (kind === "forgot") {
        // Mesma resposta exista ou não a conta (não revela quais e-mails estão cadastrados).
        await requestPasswordReset(normalizedEmail);
        showSent("reset");
      } else if (kind === "register") {
        const result = await signUpWithPassword(normalizedEmail, password, name.trim());
        if (result) onAuthenticated(result);
        // Sem OTP, o link do e-mail volta para o app já logado.
        else showSent(EMAIL_OTP_ENABLED ? "code" : "confirm");
      } else {
        onAuthenticated(await signInWithPassword(normalizedEmail, password));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a autenticação.");
    } finally {
      setLoading(false);
    }
  }

  const feedback = (
    <>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {success ? <p className="auth-success" role="status">{success}</p> : null}
    </>
  );

  const resendButton = (
    <button type="button" className="btn auth-resend" onClick={() => void resend()} disabled={loading || cooldown > 0}>
      {cooldown > 0 ? `Reenviar em ${cooldown}s` : sent === "code" ? "Reenviar código" : "Reenviar e-mail"}
    </button>
  );

  let body: React.ReactNode;
  if (sent) {
    body = (
      <>
        <span className="auth-sent-icon" aria-hidden="true">{Icon.mail}</span>
        <h2 id="auth-title">{sent === "code" ? "Digite o código" : "Confira seu e-mail"}</h2>
        <p className="auth-subtitle">
          {sent === "code"
            ? "Enviamos um código de 6 números para"
            : sent === "confirm"
              ? "Enviamos um link de confirmação para"
              : "Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova em"}
          <strong className="auth-email">{normalizedEmail}</strong>
        </p>
        {sent === "code" ? (
          <form onSubmit={confirmEmail} className="auth-form">
            <input
              className="auth-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              aria-label="Código de verificação de seis números"
              autoFocus
              required
              disabled={loading}
            />
            {feedback}
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || verificationCode.length !== 6}>
              {loading ? "Verificando..." : "Confirmar e-mail"}
            </button>
          </form>
        ) : null}
        <p className="auth-hint">
          {sent === "confirm" ? (
            <>
              Toque em <strong>Confirmar conta</strong> no e-mail para entrar.{" "}
            </>
          ) : sent === "reset" ? (
            "O link vale por 1 hora. "
          ) : null}
          Não chegou? Veja a pasta de spam.
        </p>
        {sent !== "code" ? feedback : null}
        {resendButton}
        <p className="auth-switch">
          <button type="button" className="inline-link" onClick={() => goTo(sent === "reset" ? "login" : kind)} disabled={loading}>
            Usar outro e-mail
          </button>
          {" · "}
          <button type="button" className="inline-link" onClick={() => goTo("login")} disabled={loading}>
            Voltar para o login
          </button>
        </p>
      </>
    );
  } else {
    body = (
      <>
        <span className="eyebrow">Storyverse</span>
        <h2 id="auth-title">
          {kind === "login" ? "Entre para continuar lendo" : kind === "register" ? "Crie sua conta gratuita" : "Esqueceu a senha?"}
        </h2>
        <p className="auth-subtitle">
          {kind === "login"
            ? "Acesse seus livros, progresso e conversas com os personagens."
            : kind === "register"
              ? "Salve seu progresso e converse com os personagens no seu ritmo."
              : "Informe o e-mail da sua conta e enviaremos um link para criar uma senha nova."}
        </p>
        <form onSubmit={submit} className="auth-form">
          {kind === "register" ? (
            <label>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required disabled={loading} />
            </label>
          ) : null}
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={loading} />
          </label>
          {kind !== "forgot" ? (
            <label>
              Senha
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={kind === "login" ? "current-password" : "new-password"} minLength={kind === "register" ? 6 : undefined} required disabled={loading} />
            </label>
          ) : null}
          {kind === "login" ? (
            <button type="button" className="inline-link auth-forgot" onClick={() => goTo("forgot")} disabled={loading}>
              Esqueci minha senha
            </button>
          ) : null}
          {feedback}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "Aguarde..." : kind === "login" ? "Fazer login" : kind === "register" ? "Criar conta" : "Enviar link"}
          </button>
        </form>
        <p className="auth-switch">
          {kind === "register" ? "Já tem uma conta?" : kind === "forgot" ? "Lembrou a senha?" : "Ainda não tem conta?"}{" "}
          <button type="button" className="inline-link" onClick={() => goTo(kind === "login" ? "register" : "login")} disabled={loading}>
            {kind === "login" ? "Criar conta" : "Fazer login"}
          </button>
        </p>
      </>
    );
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar">
          {Icon.close}
        </button>
        {/* A key troca o conteúdo com um fade curto ao ir de login para cadastro etc. */}
        <div key={sent ?? kind} className={`auth-view ${sent ? "auth-view-sent" : ""}`}>
          {body}
        </div>
      </section>
    </div>
  );
}

/** Tela de senha nova, aberta pelo link de "esqueci minha senha" (já logado por ele). */
function NewPasswordModal({ session, onDone }: { session: SupabaseSession; onDone: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setLoading(true);
    setError("");
    try {
      await updatePassword(session, password);
      onDone("Senha nova salva. Você já está conectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha nova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-backdrop" role="presentation">
      <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="new-password-title">
        <span className="eyebrow">Storyverse</span>
        <h2 id="new-password-title">Crie uma senha nova</h2>
        <p className="auth-subtitle">Escolha a senha que você vai usar para entrar daqui para frente.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Senha nova
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required disabled={loading} />
          </label>
          <label>
            Repita a senha
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required disabled={loading} />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "Aguarde..." : "Salvar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="sobre-title">
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Sobre o Storyverse</span>
            <h2 id="sobre-title">Entre na história. Converse com quem vive nela.</h2>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar sobre">
            {Icon.close}
          </button>
        </header>
        <div className="about-copy">
          <p className="about-lead">
            Enquanto você lê, os personagens do livro conversam com você num chat ao lado da página.
          </p>
          <ol className="about-steps">
            <li>
              <strong>Escolha um livro</strong>
              <span>Clássicos em domínio público ou um EPUB, PDF ou TXT seu.</span>
            </li>
            <li>
              <strong>Leia no seu ritmo</strong>
              <span>O progresso fica salvo, inclusive no celular e offline.</span>
            </li>
            <li>
              <strong>Converse com quem vive nele</strong>
              <span>Pergunte a Sherlock, provoque Drácula, ouça Isaura.</span>
            </li>
          </ol>
          <div className="about-rules">
            <p>
              <strong>Sem spoilers.</strong> Os personagens só sabem o que você já leu.
            </p>
            <p>
              <strong>O livro é o original.</strong> A IA dá voz aos personagens, mas não muda a história.
            </p>
          </div>
          <p className="about-sub">Também dá para</p>
          <ul className="about-features">
            <li>Ouvir em voz alta</li>
            <li>Ler no modo noturno ou sépia</li>
            <li>Destacar trechos</li>
            <li>Ver o significado de palavras</li>
            <li>Criar metas de leitura</li>
            <li>Compartilhar citações</li>
          </ul>
        </div>
        <footer className="about-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Começar a ler
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * Aplica os escudos uma vez por carregamento da página, antes de desenhar qualquer coisa (assim o
 * quadro da sequência já mostra o dia salvo). Devolve o tamanho da sequência salva, para o aviso.
 */
let shieldNoticeCache: number | null | undefined;
function shieldNoticeOnLoad(): number | null {
  if (shieldNoticeCache === undefined) {
    const r = reconcileStreak();
    shieldNoticeCache = r.shieldsUsed > 0 && takeShieldNotice() ? r.streak : null;
  }
  return shieldNoticeCache;
}

export function App() {
  const [book, setBook] = useState<Ebook | null>(null);
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  // Sem Supabase configurado não há sessão para verificar: a tela abre direto.
  const [authLoading, setAuthLoading] = useState(authEnabled);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ text: string; ok?: boolean } | null>(null);
  const authUser: SupabaseUser | null = authSession?.user ?? null;
  /** Pode ler e importar: login desligado, conta opcional ou já entrou. */
  const canRead = !loginRequired || !!authUser;
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [communityBooks, setCommunityBooks] = useState<Ebook[]>([]);
  const [communityTick, setCommunityTick] = useState(0);
  /** Aberto pelo perfil numa marcação: o livro abre direto nesse trecho. */
  const openAtRef = useRef<{ bookId: string; chapterIndex: number; chapterLabel: string; paragraph: number } | null>(null);

  /** Chegou pelo link "esqueci minha senha": mostra a tela de senha nova. */
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        clearLegacyCredentials();
        // Veio de um link do e-mail (confirmação de cadastro ou recuperação de senha)?
        const redirect = await consumeAuthRedirect().catch((err: unknown) => ({
          error: err instanceof Error ? err.message : "Não foi possível concluir o acesso pelo link.",
        }));
        if (redirect && "error" in redirect) {
          if (!cancelled) setAuthNotice({ text: redirect.error });
        } else if (redirect) {
          if (!cancelled) {
            setAuthSession(redirect.session);
            if (redirect.type === "recovery") setPasswordReset(true);
            else if (redirect.type === "signup") setAuthNotice({ text: "E-mail confirmado. Boas-vindas ao Storyverse!", ok: true });
          }
          return;
        }
        const session = await restoreAuthSession();
        if (!cancelled) setAuthSession(session);
      } catch (err) {
        if (!cancelled) {
          setAuthSession(null);
          setAuthNotice({ text: err instanceof Error ? err.message : "Não foi possível restaurar sua sessão." });
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Muda para tentar renovar a sessão de novo (depois de uma falha de conexão). */
  const [refreshRetry, setRefreshRetry] = useState(0);
  useEffect(() => {
    if (!authSession) return;
    // Nunca menos de 30 s entre renovações: mesmo com o relógio errado, não estoura o limite do Supabase.
    const refreshIn = Math.max(30_000, authSession.expires_at * 1000 - Date.now() - 60_000);
    let retryTimer = 0;
    const onOnline = () => setRefreshRetry((n) => n + 1);
    const timer = window.setTimeout(() => {
      // Outra aba já renovou? Usa a sessão dela em vez de renovar de novo.
      const stored = storedAuthSession();
      if (stored && stored.refresh_token !== authSession.refresh_token && stored.expires_at > authSession.expires_at) {
        setAuthSession(stored);
        return;
      }
      void refreshAuthSession(authSession.refresh_token)
        .then((session) => setAuthSession(session))
        .catch((err: unknown) => {
          // Sem internet ou limite do Supabase: continua logado e tenta de novo quando a conexão
          // voltar (ou em 1 min).
          if (err instanceof AuthNetworkError) {
            window.addEventListener("online", onOnline, { once: true });
            retryTimer = window.setTimeout(onOnline, 60_000);
            return;
          }
          setAuthSession(null);
          setAuthNotice({ text: err instanceof Error ? err.message : "Sua sessão expirou. Entre novamente." });
        });
    }, refreshIn);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
    };
  }, [authSession, refreshRetry]);

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key !== "storyverse:supabase-session") return;
      if (!event.newValue) {
        setAuthSession(null);
        return;
      }
      try {
        setAuthSession(JSON.parse(event.newValue) as SupabaseSession);
      } catch {
        setAuthSession(null);
      }
    }
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const authUserId = authSession?.user.id;
  useEffect(() => {
    if (!authSession) return setIsAdmin(false);
    let alive = true;
    void checkIsAdmin(authSession).then((ok) => alive && setIsAdmin(ok));
    return () => {
      alive = false;
    };
    // Só quando troca de usuário (não a cada renovação do token).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  /**
   * Cada conta com os próprios dados de leitura neste aparelho: ao trocar de conta (ou sair), troca
   * antes de desenhar a tela, para não aparecer nada da conta anterior nem por um instante.
   */
  const [dataEpoch, setDataEpoch] = useState(0);
  const onlineCount = usePresenceCount(authEnabled ? "app" : null, authUserId);
  const bookRoomId = book?.id;
  const readingHere = usePresenceCount(authEnabled && bookRoomId ? `book:${bookRoomId}` : null, authUserId);
  useLayoutEffect(() => {
    if (!authEnabled || authLoading) return;
    if (activateDataOwner(authUserId ?? "anon")) {
      setPrefs(loadPrefs());
      setDataEpoch((n) => n + 1);
    }
  }, [authUserId, authLoading]);

  // Nuvem: ao entrar, junta os dados da conta com os do aparelho (depois da troca de dono acima).
  useEffect(() => {
    if (!authEnabled || authLoading) return;
    const session = authSessionRef.current;
    if (!session) return resetSync();
    let alive = true;
    void pullAndMerge(session)
      .then((changed) => {
        if (alive && changed) {
          setPrefs(loadPrefs());
          setDataEpoch((n) => n + 1);
        }
      })
      .catch(() => {
        // Sem a tabela ou sem internet: segue só com os dados do aparelho.
      });
    return () => {
      alive = false;
    };
  }, [authUserId, authLoading]);
  useEffect(() => (authEnabled ? startAutoPush(() => authSessionRef.current) : undefined), []);

  /** Sessão atual para o carregamento do texto (sem recarregar o livro quando o token renova). */
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;

  async function logout() {
    if (!authSession || authActionLoading) return;
    setAuthActionLoading(true);
    setAuthNotice(null);
    try {
      // Antes de sair, guarda na nuvem o que ainda não foi enviado.
      await pushIfChanged(authSession).catch(() => {});
      await signOut(authSession);
    } catch (err) {
      setAuthNotice({ text: err instanceof Error ? `Sessão encerrada neste dispositivo. ${err.message}` : "Sessão encerrada neste dispositivo." });
    } finally {
      setAuthSession(null);
      setAuthActionLoading(false);
      setProfileOpen(false);
      setModerationOpen(false);
    }
  }

  const [fullText, setFullText] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  /** Elenco do livro aberto (null enquanto a IA ainda está sugerindo). */
  const [cast, setCast] = useState<StoryCharacter[] | null>(null);
  const [activeCharId, setActiveCharId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  /** No celular o chat abre como painel por cima do texto. */
  const [chatOpen, setChatOpen] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState(messagesLeftToday);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => setCelebration(null), 4200);
    return () => window.clearTimeout(t);
  }, [celebration]);
  /** Ao abrir o app: escudos salvam a sequência de ontem, se preciso (aviso uma vez por dia). */
  const [shieldNotice, setShieldNotice] = useState<number | null>(shieldNoticeOnLoad);
  /** Capítulos já comemorados nesta visita (para não repetir a cada rolagem). */
  const finishedChaptersRef = useRef(new Set<string>());
  /** Aviso curto no rodapé da tela ("Imagem salva", "Trecho destacado"). */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Marcações, seleção de texto e significado de palavras. */
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [selection, setSelection] = useState<{
    text: string;
    /** Pedaço selecionado em cada parágrafo (a seleção pode atravessar vários). */
    parts: { block: number; text: string }[];
    block: number;
    x: number;
    top: number;
    bottom: number;
    word: string | null;
  } | null>(null);
  const [wordCard, setWordCard] = useState<{ word: string; x: number; y: number; info: WordInfo | null } | null>(
    null,
  );

  /* Leitura em voz alta. */
  const [speaking, setSpeaking] = useState(false);
  const [speakingBlock, setSpeakingBlock] = useState<number | null>(null);
  const [speechRate, setSpeechRate] = useState(savedRate);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceUri, setVoiceUri] = useState<string | undefined>(undefined);
  const speechRef = useRef<SpeechSession | null>(null);
  /** A voz chegou ao fim do capítulo e segue no próximo. */
  const continueSpeechRef = useRef(false);
  /** Ao abrir um capítulo, rola até este parágrafo (vindo de uma marcação). */
  const jumpToBlockRef = useRef<number | null>(null);
  /** Última interação no leitor: o tempo de leitura só conta com o leitor presente. */
  const lastActivityRef = useRef(Date.now());

  const [prefs, setPrefs] = useState(loadPrefs);
  /** Redesenha a página inicial quando um livro importado é removido (sai de "Continue lendo"). */
  const [, setHomeTick] = useState(0);
  useEffect(() => {
    if (!authEnabled || book) return;
    let alive = true;
    void approvedCommunityBooks(authSessionRef.current)
      .then((list) => alive && setCommunityBooks(list))
      .catch(() => alive && setCommunityBooks([]));
    return () => {
      alive = false;
    };
  }, [book, authUserId, communityTick]);
  /** Capas do acervo iguais às de "Seus livros" (envios antigos ficaram com a da Open Library). */
  useEffect(() => {
    const session = authSessionRef.current;
    if (!authEnabled || !session) return;
    let alive = true;
    void listLocalBooks()
      .then((local) => (local.length > 0 ? syncSubmissionCovers(session, local) : 0))
      .then((changed) => alive && changed > 0 && setCommunityTick((n) => n + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authUserId]);
  /** Livro que acabou de sair de "Continue lendo" (dá para desfazer por alguns segundos). */
  const [continueUndo, setContinueUndo] = useState<ReadingProgress | null>(null);
  useEffect(() => {
    if (!continueUndo) return;
    const t = window.setTimeout(() => setContinueUndo(null), 7000);
    return () => window.clearTimeout(t);
  }, [continueUndo]);
  const [importRequest, setImportRequest] = useState<BookHint | Record<string, never> | null>(null);
  const { install } = useInstallPrompt();
  const updateReady = useUpdateReady();
  const updateBanner = updateReady ? (
    <div className="update-banner" role="status">
      <span>✨ Nova versão do Storyverse disponível.</span>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        Atualizar
      </button>
    </div>
  ) : null;
  /** Dados para a notificação diária do Android (o service worker não lê o localStorage). */
  useEffect(() => {
    if (book) return;
    const recent = recentProgress()[0];
    void syncEngagementState({
      streak: readingSummary().streak,
      lastReadDay: lastReadDay(),
      book: recent
        ? { title: recent.book.title, chapterLabel: recent.chapterLabel, character: lastCharacter(recent.book.id) }
        : undefined,
    });
  }, [book]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preferência só não fica salva.
    }
  }, [prefs]);

  const readRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  /** Uma dica de “meio de capítulo” por índice de capítulo (evita várias mensagens seguidas). */
  const midChapterNudgeSentRef = useRef<Record<number, boolean>>({});
  /** Rolagem salva a reaplicar quando o capítulo onde o leitor parou for desenhado. */
  const restoreScrollRef = useRef<number | null>(null);
  /** Livro + capítulo na tela: resultados de tradução de outro capítulo são descartados. */
  const chapterKey = book ? `${book.gutenbergId}:${chapterIndex}` : "";
  const chapterKeyRef = useRef(chapterKey);
  chapterKeyRef.current = chapterKey;
  /** Trecho de tradução no topo da tela, medido junto com a rolagem. */
  const [visibleChunk, setVisibleChunk] = useState<{ key: string; chunk: number } | null>(null);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;

    setLoadState("loading");
    setLoadError(null);
    setFullText("");
    setChapterIndex(0);
    setScrollRatio(0);
    midChapterNudgeSentRef.current = {};

    (isLocalBook(book)
      ? loadLocalBookText(book.gutenbergId)
      : book.source === "community" && book.communityPath
        ? fetchCommunityText(authSessionRef.current, book.communityPath)
        : fetchBookText(book.gutenbergId))
      .then((text) => {
        if (cancelled) return;
        const saved = loadProgress(book.gutenbergId);
        const labels = splitIntoChapters(text).map((c) => c.label);
        // Procura pelo nome do capítulo: se a divisão em capítulos mudar numa versão nova do app,
        // o número salvo pode apontar para outro capítulo.
        const savedIndex = !saved
          ? -1
          : labels[saved.chapterIndex] === saved.chapterLabel
            ? saved.chapterIndex
            : labels.indexOf(saved.chapterLabel);
        const openAt = openAtRef.current?.bookId === book.id ? openAtRef.current : null;
        openAtRef.current = null;
        const openAtIndex = !openAt
          ? -1
          : labels[openAt.chapterIndex] === openAt.chapterLabel
            ? openAt.chapterIndex
            : labels.indexOf(openAt.chapterLabel);
        if (openAt && openAtIndex >= 0) {
          setChapterIndex(openAtIndex);
          jumpToBlockRef.current = openAt.paragraph;
        } else if (saved && savedIndex >= 0) {
          setChapterIndex(savedIndex);
          restoreScrollRef.current = saved.scrollRatio;
          // Quem volta para o meio do capítulo não precisa da dica de “meio de capítulo”.
          if (saved.scrollRatio >= 0.42) midChapterNudgeSentRef.current[savedIndex] = true;
        }
        setFullText(text);
        setLoadState("ready");
        // Voltou depois de dias sem abrir este livro: o personagem manda uma mensagem de saudade.
        const awayDays = saved ? Math.floor((Date.now() - saved.updatedAt) / 86_400_000) : 0;
        const awayChapter = saved?.chapterLabel;
        return loadCast(book, text.slice(0, 3000)).then((list) => {
          if (cancelled) return;
          setCast(list);
          // Conversa guardada da última vez; personagem sem conversa começa com a saudação.
          const saved = loadChat(book.id);
          const greetings = initialThreadsFor(list);
          setThreads((prev) =>
            Object.keys(prev).length > 0
              ? prev
              : Object.fromEntries(
                  list.map((c) => [c.id, saved?.threads[c.id]?.length ? saved.threads[c.id] : greetings[c.id]]),
                ),
          );
          const savedActive = saved?.activeCharId && list.some((c) => c.id === saved.activeCharId);
          const activeId = savedActive ? saved!.activeCharId : list[0]?.id;
          setActiveCharId((id) => id || activeId || "");
          if (awayDays >= 2 && awayChapter && activeId) {
            const line = missYouMessage(awayChapter, awayDays);
            setThreads((prev) => ({
              ...prev,
              [activeId]: [...(prev[activeId] ?? []), { id: uid(), role: "assistant", text: line }],
            }));
          }
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar o livro.");
      });

    return () => {
      cancelled = true;
    };
  }, [book, loadAttempt]);

  const onReadScroll = useCallback(() => {
    const el = readRef.current;
    if (!el) return;
    lastActivityRef.current = Date.now();
    setSelection(null);
    setWordCard(null);
    const max = el.scrollHeight - el.clientHeight;
    const r = max <= 0 ? 0 : el.scrollTop / max;
    setScrollRatio(r);

    // Busca binária pelo primeiro parágrafo visível (estão em ordem na página).
    const els = el.querySelectorAll<HTMLElement>("[data-chunk]");
    if (els.length === 0) return;
    const top = el.getBoundingClientRect().top;
    let lo = 0;
    let hi = els.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (els[mid].getBoundingClientRect().bottom > top) hi = mid;
      else lo = mid + 1;
    }
    const chunk = Number(els[lo].dataset.chunk);
    const key = chapterKeyRef.current;
    setVisibleChunk((v) => (v?.key === key && v.chunk === chunk ? v : { key, chunk }));
  }, []);

  const prevChapterIdxRef = useRef<number | null>(null);

  const startBook = useCallback((b: Ebook) => {
    if (authLoading) return;
    if (!canRead) {
      setAuthModal("login");
      return;
    }
    prevChapterIdxRef.current = null;
    setBook(b);
    setCast(null);
    setActiveCharId("");
    setThreads({});
    setError(null);
    setInput("");
    setChatOpen(false);
    window.scrollTo({ top: 0 });
  }, [authLoading, canRead]);

  const requestImport = useCallback(
    (hint: BookHint | Record<string, never> = {}) => {
      if (authLoading) return;
      if (!canRead) {
        setAuthModal("login");
        return;
      }
      setImportRequest(hint);
    },
    [authLoading, canRead],
  );

  const goToHomeSection = useCallback(
    (sectionId: string) => {
      if (authLoading) return;
      if (!canRead) {
        setAuthModal("login");
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [authLoading, canRead],
  );

  const stopSpeaking = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    continueSpeechRef.current = false;
    setSpeaking(false);
    setSpeakingBlock(null);
    setVoicePanelOpen(false);
  }, []);

  const leaveBook = useCallback(() => {
    stopSpeaking();
    setHighlightsOpen(false);
    setSelection(null);
    setWordCard(null);
    prevChapterIdxRef.current = null;
    setBook(null);
    setCast(null);
    setActiveCharId("");
    setThreads({});
    setError(null);
    setInput("");
    setFullText("");
    setChapterIndex(0);
    midChapterNudgeSentRef.current = {};
    setLoadState("idle");
    setLoadError(null);
    setChatOpen(false);
  }, [stopSpeaking]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const characters = cast ?? [];
  const character = useMemo(
    () => characters.find((c) => c.id === activeCharId) ?? characters[0],
    [activeCharId, characters],
  );

  const messages = character ? (threads[character.id] ?? EMPTY_THREAD) : EMPTY_THREAD;

  /** Guarda a conversa do livro para continuar na próxima vez. */
  useEffect(() => {
    if (!book || !cast || Object.keys(threads).length === 0) return;
    const t = window.setTimeout(() => saveChat(book.id, threads, activeCharId), 400);
    return () => window.clearTimeout(t);
  }, [book, cast, threads, activeCharId]);

  /** Marcações do livro aberto. */
  useEffect(() => {
    setHighlights(book ? loadHighlights(book.id) : []);
  }, [book]);

  /** Ilustrações de livro importado (guardadas no aparelho): endereços para as <img>. */
  const [bookImages, setBookImages] = useState<Record<string, string>>({});
  useEffect(() => {
    setBookImages({});
    if (!book || !isLocalBook(book)) return;
    let revoke: (() => void) | null = null;
    let alive = true;
    void loadLocalBookImages(book.gutenbergId).then((r) => {
      if (!alive) return r.revoke();
      revoke = r.revoke;
      setBookImages(r.urls);
    });
    return () => {
      alive = false;
      revoke?.();
    };
  }, [book]);

  /** Tempo de leitura (para a sequência de dias e a meta): conta de 15 em 15 s com o leitor ativo. */
  useEffect(() => {
    if (!book || loadState !== "ready") return;
    const TICK = 15;
    const t = window.setInterval(() => {
      const active = Date.now() - lastActivityRef.current < 120_000 || speechRef.current !== null;
      if (document.visibilityState === "visible" && active) celebrate(addReadingSeconds(TICK));
    }, TICK * 1000);
    return () => window.clearInterval(t);
  }, [book, loadState]);

  function celebrate(ev: ReadingEvents) {
    if (ev.dayCompleted) {
      const n = ev.streak;
      const milestone = [3, 7, 14, 30, 50, 100, 365].includes(n);
      setCelebration({
        emoji: "🔥",
        title: n === 1 ? "Sequência começou!" : `${n} dias seguidos!`,
        text: ev.shieldEarned
          ? "Você ganhou um escudo 🛡️: se um dia passar sem leitura, ele salva a sua sequência."
          : milestone
            ? "Que marca! Os personagens estão orgulhosos."
            : n === 1
              ? "Volte amanhã para manter o fogo aceso."
              : "Continue assim — volte amanhã para manter a sequência.",
      });
    } else if (ev.goalReached) {
      setCelebration({ emoji: "🎯", title: "Meta do dia cumprida!", text: "Você leu tudo o que planejou hoje." });
    }
  }

  /** Guarda com quem o leitor conversou por último (usado no texto dos lembretes). */
  useEffect(() => {
    if (book && character) rememberCharacter(book.id, character.name);
  }, [book, character]);

  /** A voz para ao sair do livro ou fechar a página. */
  useEffect(() => () => speechRef.current?.stop(), []);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activeCharId, loading, chatOpen]);

  const providerLabel = providerDisplayLabel();

  const chapters = useMemo(() => (fullText ? splitIntoChapters(fullText) : []), [fullText]);
  const currentChapter = chapters[chapterIndex] ?? chapters[0];

  useEffect(() => {
    setScrollRatio(0);
  }, [chapterIndex]);

  /** Capítulo novo começa do topo; ao reabrir o livro, volta para onde o leitor parou. */
  useEffect(() => {
    if (loadState !== "ready") return;
    const frame = requestAnimationFrame(() => {
      const el = readRef.current;
      const ratio = restoreScrollRef.current;
      restoreScrollRef.current = null;
      const jump = jumpToBlockRef.current;
      jumpToBlockRef.current = null;
      if (!el) return;
      if (jump !== null) scrollToBlock(jump);
      else el.scrollTop = ratio ? ratio * (el.scrollHeight - el.clientHeight) : 0;
      onReadScroll();
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterIndex, loadState, onReadScroll]);

  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter) return;
    if (restoreScrollRef.current !== null) return; // Ainda não voltou para a posição salva.
    // Abrir e fechar um livro sem ler nada não o coloca em “Continue lendo”.
    if (chapterIndex === 0 && scrollRatio < 0.02 && !loadProgress(book.gutenbergId)) return;
    const t = setTimeout(
      () =>
        saveProgress({
          book,
          chapterIndex,
          chapterLabel: currentChapter.label,
          chapterCount: chapters.length,
          scrollRatio,
        }),
      300,
    );
    return () => clearTimeout(t);
  }, [book, loadState, chapterIndex, currentChapter, chapters.length, scrollRatio]);

  /** Chegou ao fim do capítulo: aviso rápido; no último capítulo, comemoração de livro terminado. */
  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter || scrollRatio < 0.97) return;
    const key = `${book.gutenbergId}:${chapterIndex}`;
    if (finishedChaptersRef.current.has(key)) return;
    // Capítulo curtíssimo cabe na tela inteira: ainda não foi "lido".
    const el = readRef.current;
    if (!el || el.scrollHeight < el.clientHeight * 1.5) return;
    finishedChaptersRef.current.add(key);
    if (chapterIndex >= chapters.length - 1) {
      markBookFinished(book);
      setCelebration({ emoji: "🏆", title: `Você terminou “${book.title}”!`, text: "Que jornada. Conte para os personagens o que achou do final." });
    } else {
      setToast(`✓ ${currentChapter.label} concluído`);
    }
  }, [book, loadState, currentChapter, scrollRatio, chapterIndex, chapters.length]);

  /** Ao trocar de personagem, não dispara de novo a dica do meio se a rolagem já passou do meio. */
  useEffect(() => {
    const el = readRef.current;
    const max = el ? el.scrollHeight - el.clientHeight : 0;
    const r = !el || max <= 0 ? 0 : el.scrollTop / max;
    if (r >= 0.42) {
      midChapterNudgeSentRef.current[chapterIndex] = true;
    }
  }, [activeCharId, chapterIndex]);

  useEffect(() => {
    if (!character || loadState !== "ready" || !currentChapter) return;

    if (prevChapterIdxRef.current === null) {
      prevChapterIdxRef.current = chapterIndex;
      return;
    }
    if (prevChapterIdxRef.current === chapterIndex) return;

    prevChapterIdxRef.current = chapterIndex;
    const line = chapterTransitionMessage(currentChapter.label);
    setThreads((prev) => {
      const thread = prev[character.id] ?? [];
      // Pulando vários capítulos seguidos, sem conversa no meio: troca o aviso em vez de empilhar.
      const last = thread[thread.length - 1];
      const keep = last?.id.startsWith("capitulo-") ? thread.slice(0, -1) : thread;
      return { ...prev, [character.id]: [...keep, { id: `capitulo-${uid()}`, role: "assistant", text: line }] };
    });
  }, [chapterIndex, character, loadState, currentChapter, activeCharId]);

  useEffect(() => {
    if (!character || !currentChapter || loadState !== "ready" || loading) return;
    if (scrollRatio < 0.42) return;
    if (midChapterNudgeSentRef.current[chapterIndex]) return;
    midChapterNudgeSentRef.current[chapterIndex] = true;
    const line = midChapterReadingHint(currentChapter.label);
    setThreads((prev) => ({
      ...prev,
      [character.id]: [...(prev[character.id] ?? []), { id: uid(), role: "assistant", text: line }],
    }));
  }, [scrollRatio, character, currentChapter, loadState, loading, chapterIndex]);

  const displayedStory = currentChapter?.body ?? "";

  /** Rola até um parágrafo do capítulo aberto e o destaca por um instante. */
  function scrollToBlock(i: number) {
    const target = readRef.current?.querySelector<HTMLElement>(`[data-block="${i}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.classList.add("flash");
    window.setTimeout(() => target.classList.remove("flash"), 1800);
  }

  const blocks = useMemo(
    () => toBlocks(displayedStory, currentChapter?.label),
    [displayedStory, currentChapter],
  );
  const dropCapIndex = useMemo(
    () => blocks.findIndex((b) => b.kind === "p" && b.text.length > 80),
    [blocks],
  );

  /* ---- Tradução dos livros em inglês: trecho a trecho, conforme o leitor avança. ---- */
  const [engine, setEngine] = useState<TranslationEngine>("google");
  useEffect(() => {
    let alive = true;
    void detectTranslationEngine().then((e) => alive && setEngine(e));
    return () => {
      alive = false;
    };
  }, []);
  const canTranslate = book?.textLanguage === "en";
  const translateOn = canTranslate && prefs.translate;
  const chunks = useMemo(() => chunkRanges(blocks.map((b) => b.text)), [blocks]);
  const [translated, setTranslated] = useState<{
    key: string;
    byChunk: Record<number, (string | null)[]>;
  }>({ key: "", byChunk: {} });
  const translations = translated.key === chapterKey ? translated.byChunk : {};
  const [translatingChunk, setTranslatingChunk] = useState<number | null>(null);
  const [failedChunks, setFailedChunks] = useState<number[]>([]);

  /** Troca de capítulo: começa com o que já foi traduzido antes e está guardado. */
  useEffect(() => {
    const cached: Record<number, (string | null)[]> = {};
    if (book && canTranslate) {
      chunks.forEach((_, c) => {
        const t = cachedTranslation(book.gutenbergId, chapterIndex, c);
        if (t) cached[c] = t;
      });
    }
    setTranslated({ key: chapterKeyRef.current, byChunk: cached });
    setTranslatingChunk(null);
    setFailedChunks([]);
  }, [book, canTranslate, chapterIndex, chunks]);

  /** Traduz o trecho visível e o seguinte, um pedido por vez. */
  useEffect(() => {
    if (!book || !translateOn || loadState !== "ready" || translatingChunk !== null) return;
    // Espera o capítulo carregar o que está guardado e a rolagem ser medida.
    if (translated.key !== chapterKey || visibleChunk?.key !== chapterKey) return;
    const c = [visibleChunk.chunk, visibleChunk.chunk + 1].find(
      (n) => n < chunks.length && !translations[n] && !failedChunks.includes(n),
    );
    if (c === undefined) return;
    const key = chapterKey;
    const [start, end] = chunks[c];
    // Espera a rolagem parar: quem passa correndo pelo capítulo não dispara um pedido por trecho.
    const t = setTimeout(() => {
      setTranslatingChunk(c);
      // Ilustrações não têm o que traduzir.
      translateParagraphs(engine, blocks.slice(start, end).map((b) => (b.kind === "image" ? "" : b.text)))
        .then((result) => {
          storeTranslation(book.gutenbergId, chapterIndex, c, result);
          if (chapterKeyRef.current === key) {
            setTranslated((prev) => ({ key, byChunk: { ...prev.byChunk, [c]: result } }));
          }
        })
        .catch((err) => {
          console.warn("Falha na tradução:", err);
          if (chapterKeyRef.current === key) setFailedChunks((prev) => [...prev, c]);
        })
        .finally(() => {
          if (chapterKeyRef.current === key) setTranslatingChunk(null);
        });
    }, 700);
    return () => clearTimeout(t);
  }, [
    engine,
    book,
    translateOn,
    loadState,
    translatingChunk,
    visibleChunk,
    chunks,
    translated,
    failedChunks,
    chapterKey,
    chapterIndex,
    blocks,
  ]);

  const chunkOfBlock = useMemo(() => {
    const map: number[] = [];
    chunks.forEach(([start, end], c) => {
      for (let i = start; i < end; i++) map[i] = c;
    });
    return map;
  }, [chunks]);

  /** Texto na tela de cada parágrafo: a tradução, quando ligada e pronta, ou o original. */
  const shownTexts = useMemo(
    () =>
      blocks.map((b, i) => {
        // Ilustração: sem texto (a voz pula, a tradução ignora).
        if (b.kind === "image") return "";
        const c = chunkOfBlock[i];
        return (translateOn ? translations[c]?.[i - chunks[c][0]] : null) ?? b.text;
      }),
    [blocks, chunkOfBlock, chunks, translateOn, translations],
  );
  /** Idioma do parágrafo na tela (para a voz e o dicionário). */
  const blockLanguage = (i: number): "pt" | "en" => {
    if (!book) return "pt";
    const c = chunkOfBlock[i];
    const translatedNow = translateOn && translations[c]?.[i - (chunks[c]?.[0] ?? 0)];
    return translatedNow ? "pt" : book.textLanguage;
  };

  /* ---- Leitura em voz alta ---- */
  const canSpeak = speechSupported();
  const speakLang: "pt" | "en" = !book ? "pt" : translateOn ? "pt" : book.textLanguage;

  useEffect(() => {
    if (!voicePanelOpen) return;
    let alive = true;
    void listVoices(speakLang).then((list) => {
      if (!alive) return;
      setVoices(list);
      const saved = savedVoiceUri(speakLang);
      setVoiceUri(list.some((v) => v.uri === saved) ? saved : list[0]?.uri);
    });
    return () => {
      alive = false;
    };
  }, [voicePanelOpen, speakLang]);

  function chooseVoice(uri: string) {
    setVoiceUri(uri);
    saveVoiceUri(speakLang, uri);
    if (speaking) startSpeaking(speakingBlock ?? firstVisibleBlock());
    else speakSample(uri, speakLang, speechRate);
  }

  function chooseRate(rate: number) {
    setSpeechRate(rate);
    saveRate(rate);
    if (speaking) startSpeaking(speakingBlock ?? firstVisibleBlock(), rate);
  }

  function firstVisibleBlock(): number {
    const el = readRef.current;
    if (!el) return 0;
    const top = el.getBoundingClientRect().top;
    const els = Array.from(el.querySelectorAll<HTMLElement>("[data-block]"));
    const first = els.find((b) => b.getBoundingClientRect().bottom > top + 8);
    return first ? Number(first.dataset.block) : 0;
  }

  function startSpeaking(from: number, rate = speechRate) {
    if (!book) return;
    speechRef.current?.stop();
    const lang = speakLang;
    const hasNext = chapterIndex < chapters.length - 1;
    setSpeaking(true);
    speechRef.current = speakParagraphs(
      shownTexts,
      from,
      lang,
      rate,
      (i) => {
        setSpeakingBlock(i);
        lastActivityRef.current = Date.now();
        const target = readRef.current?.querySelector<HTMLElement>(`[data-block="${i}"]`);
        const page = readRef.current;
        if (target && page) {
          const r = target.getBoundingClientRect();
          const pr = page.getBoundingClientRect();
          if (r.top < pr.top + 40 || r.bottom > pr.bottom - 40) target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      },
      () => {
        speechRef.current = null;
        if (hasNext) {
          // Fim do capítulo: continua lendo o próximo.
          continueSpeechRef.current = true;
          setChapterIndex((n) => n + 1);
        } else {
          setSpeaking(false);
          setSpeakingBlock(null);
        }
      },
    );
  }

  /** Troca de capítulo pelo leitor (não pela voz) ou tradução ligada/desligada: a voz para. */
  useEffect(() => {
    if (!continueSpeechRef.current) stopSpeaking();
  }, [chapterIndex, translateOn, stopSpeaking]);

  /** A voz terminou um capítulo: quando o próximo estiver na tela, continua do começo. */
  useEffect(() => {
    if (!continueSpeechRef.current || loadState !== "ready" || blocks.length === 0) return;
    continueSpeechRef.current = false;
    const frame = requestAnimationFrame(() => startSpeaking(0));
    return () => cancelAnimationFrame(frame);
  }, [blocks, loadState]);

  /* ---- Seleção de texto: marcar, significado, compartilhar ---- */

  /** Lê a seleção atual no texto do livro (pode atravessar vários parágrafos). */
  function readSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setSelection(null);
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const prose = (common instanceof Element ? common : common.parentElement)?.closest(".prose");
    if (!prose) return setSelection(null);

    // Um pedaço por parágrafo tocado pela seleção (cada um é marcado no seu parágrafo).
    const parts: { block: number; text: string }[] = [];
    for (const el of Array.from(prose.querySelectorAll<HTMLElement>("p[data-block], h2[data-block]"))) {
      if (!range.intersectsNode(el)) continue;
      const piece = document.createRange();
      piece.selectNodeContents(el);
      if (el.contains(range.startContainer)) piece.setStart(range.startContainer, range.startOffset);
      if (el.contains(range.endContainer)) piece.setEnd(range.endContainer, range.endOffset);
      const text = piece.toString().replace(/\s+/g, " ").trim();
      if (text) parts.push({ block: Number(el.dataset.block), text });
      if (parts.length >= 12) break;
    }
    if (parts.length === 0) return setSelection(null);

    const text = parts.map((p) => p.text).join(" ");
    const rect = range.getBoundingClientRect();
    setSelection({
      text,
      parts,
      block: parts[0].block,
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
      word: parts.length === 1 && !/\s/.test(text) ? normalizeWord(text) : null,
    });
    setWordCard(null);
  }

  /** No celular, arrastar as alças da seleção não dispara toque: acompanha pela própria seleção. */
  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      timer = window.setTimeout(readSelection, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
    // readSelection só usa setters (estáveis) e o DOM.
  }, []);

  function handleSelection() {
    window.setTimeout(readSelection, 10);
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  function addHighlight() {
    if (!book || !selection || !currentChapter) return;
    // Trecho que atravessa parágrafos: um pedaço por parágrafo, todos do mesmo grupo.
    const group = uid();
    const createdAt = Date.now();
    const pieces: Highlight[] = selection.parts.map((p) => ({
      id: uid(),
      group,
      chapterIndex,
      chapterLabel: currentChapter.label,
      paragraph: p.block,
      text: p.text.slice(0, MAX_HIGHLIGHT_CHARS),
      createdAt,
    }));
    const next = [...highlights, ...pieces];
    setHighlights(next);
    saveHighlights(book.id, next);
    clearSelection();
    setToast("Trecho marcado");
  }

  /** Remove a marcação inteira (todos os pedaços do mesmo trecho). */
  function removeHighlight(h: Highlight) {
    if (!book) return;
    const next = highlights.filter((x) => (h.group ? x.group !== h.group : x.id !== h.id));
    setHighlights(next);
    saveHighlights(book.id, next);
  }

  /** Marcações agrupadas por trecho, na ordem do livro (para o painel). */
  const highlightGroups = useMemo(() => {
    const groups = new Map<string, { first: Highlight; text: string }>();
    for (const h of [...highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.paragraph - b.paragraph)) {
      const key = h.group ?? h.id;
      const g = groups.get(key);
      if (g) g.text = `${g.text} ${h.text}`;
      else groups.set(key, { first: h, text: h.text });
    }
    return [...groups.values()];
  }, [highlights]);

  function openHighlight(h: Highlight) {
    setHighlightsOpen(false);
    if (h.chapterIndex === chapterIndex) {
      requestAnimationFrame(() => scrollToBlock(h.paragraph));
    } else {
      jumpToBlockRef.current = h.paragraph;
      setChapterIndex(h.chapterIndex);
    }
  }

  function showMeaning() {
    if (!selection?.word) return;
    const word = selection.word;
    const lang = blockLanguage(selection.block);
    setWordCard({ word, x: selection.x, y: selection.bottom, info: null });
    clearSelection();
    void lookupWord(word, lang, engine).then((info) =>
      setWordCard((c) => (c && c.word === word ? { ...c, info } : c)),
    );
  }

  const [sharing, setSharing] = useState(false);
  async function shareCard(input: Omit<ShareCardInput, "bookTitle" | "bookAuthor" | "coverUrl">) {
    if (!book || sharing) return;
    setSharing(true);
    try {
      const blob = await renderShareCard({
        ...input,
        bookTitle: book.title,
        bookAuthor: book.author,
        coverUrl: book.coverUrl,
      });
      const slug = book.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const result = await shareOrDownload(blob, `storyverse-${slug || "livro"}.png`, `${book.title} no Storyverse`);
      if (result === "downloaded") setToast("Imagem salva — é só postar!");
    } catch (e) {
      console.warn("Falha ao gerar o card:", e);
      setToast("Não foi possível gerar a imagem.");
    } finally {
      setSharing(false);
    }
  }

  function shareMessage(m: Msg) {
    if (!character) return;
    const idx = messages.findIndex((x) => x.id === m.id);
    const question = [...messages.slice(0, idx)].reverse().find((x) => x.role === "user")?.text;
    void shareCard({
      kind: "chat",
      text: m.text,
      characterName: character.name,
      characterRole: character.role,
      characterColor: character.color,
      question,
    });
  }

  function shareQuote(text: string, chapterLabel?: string) {
    void shareCard({ kind: "quote", text, chapterLabel });
  }

  function resetConversation() {
    if (!character) return;
    if (!window.confirm(`Recomeçar a conversa com ${character.name}? As mensagens desta conversa serão apagadas.`)) {
      return;
    }
    setThreads((prev) => ({ ...prev, [character.id]: initialThreadsFor([character])[character.id] }));
  }

  /** Posição aproximada no livro inteiro (capítulos anteriores + rolagem no atual). */
  const readingProgressPct =
    chapters.length > 0 ? ((chapterIndex + scrollRatio) / chapters.length) * 100 : 0;
  const textExcerpt = useMemo(
    () => excerptNearScrollRatio(withoutImageMarkers(displayedStory), scrollRatio, 2000),
    [displayedStory, scrollRatio],
  );

  const limitApplies = detectProvider() === "live";
  const outOfMessages = limitApplies && messagesLeft <= 0;

  async function sendMessage(raw: string) {
    if (!book || !character || loadState !== "ready" || !displayedStory) return;
    const text = raw.trim();
    if (!text || loading) return;
    if (limitApplies && messagesLeftToday() <= 0) {
      setMessagesLeft(0);
      return;
    }

    setError(null);
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text };
    setThreads((prev) => ({
      ...prev,
      [character.id]: [...(prev[character.id] ?? []), userMsg],
    }));

    const prior = [...(threads[character.id] ?? []), userMsg];
    const history: ChatTurn[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    setLoading(true);
    try {
      const reply = await characterReply({
        character,
        history: history.slice(0, -1),
        userMessage: text,
        ebookTitle: book.title,
        ebookAuthor: book.author,
        textExcerpt,
        readingProgressPct,
        textLanguage: book.textLanguage,
      });
      const botMsg: Msg = { id: uid(), role: "assistant", text: reply };
      if (limitApplies) setMessagesLeft(countMessage());
      setThreads((prev) => ({
        ...prev,
        [character.id]: [...(prev[character.id] ?? []), botMsg],
      }));
    } catch (err) {
      console.warn("Falha no envio da mensagem:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir o envio. Tente de novo.",
      );
      setThreads((prev) => ({
        ...prev,
        [character.id]: [...(prev[character.id] ?? []).filter((m) => m.id !== userMsg.id)],
      }));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  // Botão voltar do celular: fecha o que estiver aberto por cima, na ordem em que foi aberto.
  useBackClose(Boolean(book), leaveBook);
  useBackClose(profileOpen, () => setProfileOpen(false));
  useBackClose(moderationOpen, () => setModerationOpen(false));
  useBackClose(authModal !== null, () => setAuthModal(null));
  useBackClose(aboutOpen, () => setAboutOpen(false));
  useBackClose(importRequest !== null, () => setImportRequest(null));
  useBackClose(chatOpen, () => setChatOpen(false));
  useBackClose(highlightsOpen, () => setHighlightsOpen(false));

  if (authLoading && !book) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <img className="auth-loading-logo" src="/icons/icon.svg" alt="" aria-hidden="true" />
        <span className="spinner" aria-hidden="true" />
        <p>Abrindo o Storyverse…</p>
      </main>
    );
  }

  if (!book) {
    // Cópia do livro guardada no progresso pode estar velha (sem a capa achada depois): usa a
    // versão atual quando o livro é do acervo fixo ou da comunidade.
    const currentBook = new Map<string, Ebook>([...featuredBooks, ...communityBooks].map((b) => [b.id, b]));
    const recent = recentProgress().map((p) => {
      const now = currentBook.get(p.book.id);
      return now && now.coverUrl !== p.book.coverUrl ? { ...p, book: { ...p.book, coverUrl: now.coverUrl } } : p;
    });
    const summary = readingSummary();
    const lastBook = recent[0]
      ? {
          title: recent[0].book.title,
          chapterLabel: recent[0].chapterLabel,
          character: lastCharacter(recent[0].book.id),
        }
      : undefined;
    const progressById = new Map(recent.map((p) => [p.book.gutenbergId, p]));
    if (moderationOpen && authSession && isAdmin) {
      return (
        <ModerationPage
          session={authSession}
          onClose={() => {
            setModerationOpen(false);
            setCommunityTick((n) => n + 1);
          }}
          onRead={startBook}
        />
      );
    }
    if (profileOpen && authSession) {
      return (
        <ProfilePage
          isAdmin={isAdmin}
          onOpenModeration={() => setModerationOpen(true)}
          session={authSession}
          onSessionChange={setAuthSession}
          onClose={() => setProfileOpen(false)}
          onLogout={() => void logout()}
          loggingOut={authActionLoading}
          onOpenBook={startBook}
          onOpenHighlight={(b, h) => {
            openAtRef.current = { bookId: b.id, chapterIndex: h.chapterIndex, chapterLabel: h.chapterLabel, paragraph: h.paragraph };
            startBook(b);
          }}
          prefs={prefs}
          setPrefs={setPrefs}
          lastBook={lastBook}
        />
      );
    }
    const heroBook = featuredBooks.find((b) => b.demo && b.characters?.length);
    const heroChar = heroBook?.characters?.[0];
    /** Já entrou e pode ler: sem a apresentação do app, direto para os livros. */
    const returning = Boolean(authUser) && canRead;
    return (
      <div className={`home ${returning ? "is-returning" : ""}`} key={dataEpoch}>
        {authModal ? (
          <AuthModal
            mode={authModal}
            onClose={() => setAuthModal(null)}
            onAuthenticated={(session) => {
              setAuthSession(session);
              setAuthNotice(null);
              setAuthModal(null);
            }}
          />
        ) : null}
        {passwordReset && authSession ? (
          <NewPasswordModal
            session={authSession}
            onDone={(message) => {
              setPasswordReset(false);
              setAuthNotice({ text: message, ok: true });
            }}
          />
        ) : null}
        <nav className="home-nav">
          <span className="wordmark">
            <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
            Storyverse
          </span>
          <div className="home-nav-actions">
            {authUser && onlineCount !== null && onlineCount > 0 ? (
              <span className="online-pill" title="Pessoas com o Storyverse aberto agora" role="status">
                <span className="online-dot" aria-hidden="true" />
                <strong>{onlineCount}</strong>
                <span className="online-label">{onlineCount === 1 ? "online" : "online agora"}</span>
              </span>
            ) : null}
            <span className="status" title="Mostra se o chat usa IA em tempo real ou respostas de demonstração.">
              <span className="status-dot" aria-hidden="true" />
              {providerLabel}
            </span>
            {install ? (
              <button type="button" className="btn nav-install" onClick={() => void install()}>
                Instalar app
              </button>
            ) : null}
            {canRead ? (
              <button
                type="button"
                className="btn nav-import"
                onClick={() => requestImport()}
                aria-label="Importar livro"
              >
                {Icon.upload}
                <span className="nav-import-long">Importar livro</span>
                <span className="nav-import-short">Importar</span>
              </button>
            ) : null}
            {!authEnabled ? null : authUser ? (
              <button type="button" className="btn nav-account" onClick={() => setProfileOpen(true)} aria-label="Abrir seu perfil">
                <UserAvatar user={authUser} className="nav-avatar" />
                <span className="nav-account-name">{displayNameOf(authUser).split(" ")[0]}</span>
              </button>
            ) : (
              <>
                <button type="button" className="btn nav-login" onClick={() => setAuthModal("login")}>Login</button>
                <button type="button" className="btn btn-primary nav-register" onClick={() => setAuthModal("register")}>Criar conta</button>
              </>
            )}
          </div>
        </nav>

        {authNotice ? (
          <p className={`auth-global-notice ${authNotice.ok ? "is-ok" : ""}`} role={authNotice.ok ? "status" : "alert"}>
            {authNotice.text}
          </p>
        ) : null}

        {aboutOpen ? <AboutDialog onClose={() => setAboutOpen(false)} /> : null}

        {install ? (
          // No celular o convite fica aqui, fora do topo (lá não cabe junto com "Importar livro").
          <div className="install-banner">
            <span>Instale o Storyverse no celular: abre em tela cheia e funciona sem internet.</span>
            <button type="button" className="btn btn-primary" onClick={() => void install()}>
              Instalar
            </button>
          </div>
        ) : null}

        {shieldNotice !== null ? (
          <div className="nudge nudge-shield" role="status">
            <span className="nudge-emoji" aria-hidden="true">
              🛡️
            </span>
            <div>
              <strong>Um escudo salvou sua sequência!</strong>
              <span>Você não leu ontem, mas a sequência de {shieldNotice} dias continua. Bora ler hoje?</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => setShieldNotice(null)} aria-label="Fechar aviso">
              {Icon.close}
            </button>
          </div>
        ) : summary.streak > 0 && !summary.readToday && recent[0] ? (
          <div className="nudge" role="status">
            <span className="nudge-emoji" aria-hidden="true">
              🔥
            </span>
            <div>
              <strong>
                Sua sequência de {summary.streak} {summary.streak === 1 ? "dia" : "dias"} termina hoje!
              </strong>
              <span>
                {lastBook?.character ? `${lastBook.character} está te esperando` : "Sua história está te esperando"} em “
                {recent[0].book.title}”. Uns minutinhos já contam.
              </span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => startBook(recent[0].book)}>
              Ler agora
            </button>
          </div>
        ) : null}

        {returning ? (
          <header className="welcome">
            <span className="eyebrow">Storyverse</span>
            <h1>
              {greetingNow()}{authUser ? `, ${displayNameOf(authUser).split(" ")[0]}` : ""} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              {recent[0]
                ? `Pronto para voltar a “${recent[0].book.title}”?`
                : "Escolha um livro e comece a conversa com os personagens."}
            </p>
            <div className="welcome-actions">
              {recent[0] ? (
                <button type="button" className="btn btn-primary" onClick={() => startBook(recent[0].book)}>
                  Continuar lendo
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => goToHomeSection("destaques")}>
                  Ver os destaques
                </button>
              )}
              <button type="button" className="btn" onClick={() => goToHomeSection("acervo")}>
                {Icon.search} Buscar no acervo
              </button>
            </div>
          </header>
        ) : (
        <>
        <header className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Leitura interativa</span>
            <h1 className="hero-title">
              Leia o livro.
              <br />
              <em>Converse com quem vive nele.</em>
            </h1>
            <p className="hero-sub">
              Enquanto você lê, os personagens acompanham o seu ritmo e respondem no chat — com a voz, o
              tom e os segredos da própria história.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => goToHomeSection("destaques")}>
                Ver os destaques
              </button>
              <button type="button" className="btn btn-lg" onClick={() => goToHomeSection("acervo")}>
                Buscar no acervo
              </button>
              <button type="button" className="btn btn-lg" onClick={() => requestImport()}>
                {Icon.upload}
                Importar meu livro
              </button>
            </div>
            <p className="hero-hint">
              Não achou o seu livro favorito? Importe o arquivo (.epub, .pdf ou .txt) e converse com os
              personagens.
            </p>
          </div>

          {heroBook?.demo && heroChar ? (
            <button
              type="button"
              className="hero-demo"
              onClick={() => startBook(heroBook)}
              aria-label={`Abrir ${heroBook.title}`}
            >
              <div className="demo-page">
                <span className="demo-chapter">{heroBook.demo.chapterLabel}</span>
                <p>
                  <span className="demo-dropcap">{heroBook.demo.pageOpening.charAt(0)}</span>
                  {heroBook.demo.pageOpening.slice(1)}
                </p>
                <div className="demo-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="demo-chat">
                <div className="demo-chat-head">
                  <Avatar character={heroChar} size="sm" bookTitle={heroBook.title} />
                  <div>
                    <strong>{heroChar.name}</strong>
                    <small>{heroBook.title}</small>
                  </div>
                </div>
                <div className="bubble user">{heroBook.demo.question}</div>
                <div className="bubble assistant">{heroBook.demo.answer}</div>
              </div>
            </button>
          ) : null}
        </header>

        <section className="steps" aria-label="Como funciona">
          <div className="step">
            <span className="step-n">1</span>
            <h3>Escolha uma história</h3>
            <p>Romances em português, terror, vampiros e mistério, qualquer livro do acervo ou um arquivo seu.</p>
          </div>
          <div className="step">
            <span className="step-n">2</span>
            <h3>Leia no seu ritmo</h3>
            <p>Capítulo a capítulo, com modo noturno ou sépia e letra do tamanho que preferir.</p>
          </div>
          <div className="step">
            <span className="step-n">3</span>
            <h3>Converse com os personagens</h3>
            <p>Pergunte, provoque, desabafe — eles sabem onde você parou e não dão spoiler.</p>
          </div>
        </section>
        </>
        )}

        {recent.length > 0 || hasAnyReading() ? <ReadingStreak lastBook={lastBook} /> : null}

        {recent.length > 0 || continueUndo ? (
          <ContinueReading
            items={recent}
            onOpen={startBook}
            onRemove={(p) => {
              removeProgress(p.book.gutenbergId);
              setContinueUndo(p);
              setHomeTick((n) => n + 1);
            }}
            undo={continueUndo}
            onUndo={() => {
              if (continueUndo) restoreProgress(continueUndo);
              setContinueUndo(null);
              setHomeTick((n) => n + 1);
            }}
          />
        ) : null}

        {communityBooks.some(isNewCommunityBook) ? (
          <ProfileShelf
            className="novidades"
            eyebrow="✨ Acabou de chegar"
            title="Novidades"
            subtitle="Livros que entraram no acervo da comunidade nesta semana."
            onOpen={startBook}
            items={communityBooks.filter(isNewCommunityBook).map((b) => ({ book: b, sub: b.author, badge: newBookLabel(b) }))}
          />
        ) : null}

        {SHELVES.map((shelf, si) => {
          const books = featuredBooks.filter((b) => (b.shelf ?? "classicos") === shelf.id);
          if (books.length === 0) return null;
          if (canRead) {
            return (
              <FeaturedRow
                key={shelf.id}
                id={si === 0 ? "destaques" : undefined}
                title={shelf.title}
                subtitle={shelf.subtitle}
                books={books}
                progressById={progressById}
                onOpen={startBook}
              />
            );
          }
          return (
            <section key={shelf.id} className="shelf" id={si === 0 ? "destaques" : undefined}>
              <div className="shelf-head">
                <h2>{shelf.title}</h2>
                <p>{shelf.subtitle}</p>
              </div>
              <div
                className={canRead ? "shelf-grid" : "book-carousel"}
                aria-label={canRead ? undefined : `${shelf.title}: carrossel de livros`}
              >
                <div className={canRead ? "shelf-grid-items" : "book-carousel-track"}>
                {(canRead ? books : [...books, ...books]).map((b, bookIndex) => {
                  const duplicate = !canRead && bookIndex >= books.length;
                  return (
                  <article key={`${b.id}-${bookIndex}`} className="book" aria-hidden={duplicate}>
                    <button
                      type="button"
                      className="book-cover-btn"
                      onClick={() => startBook(b)}
                      tabIndex={duplicate ? -1 : undefined}
                      aria-label={`Abrir ${b.title}`}
                    >
                      <BookCover book={b} />
                    </button>
                    <div className="book-info">
                      <div className="book-tags">
                        {b.genre ? <span className="genre-tag">{b.genre}</span> : null}
                        <LangBadge book={b} />
                      </div>
                      <h3>{b.title}</h3>
                      <p className="book-author">{b.author}</p>
                      {b.blurb ? <p className="book-blurb">{b.blurb}</p> : null}
                      {b.characters?.length ? (
                        <div className="book-cast">
                          <span className="avatar-stack">
                            {b.characters.map((c) => (
                              <Avatar key={c.id} character={c} size="sm" bookTitle={b.title} />
                            ))}
                          </span>
                          <span>Converse com {listNames(b.characters.map(shortNameOf))}</span>
                        </div>
                      ) : null}
                      <div className="book-actions">
                        <button type="button" className="btn btn-primary" onClick={() => startBook(b)} tabIndex={duplicate ? -1 : undefined}>
                          {progressById.has(b.gutenbergId) ? "Continuar lendo" : "Começar a ler"}
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
                </div>
              </div>
            </section>
          );
        })}

        {communityBooks.some((b) => !isNewCommunityBook(b)) ? (
          <ProfileShelf
            title="Da comunidade"
            subtitle="Livros enviados por leitores e aprovados pela curadoria."
            onOpen={startBook}
            items={communityBooks.map((b) => ({
              book: b,
              sub: b.author,
              ...(isNewCommunityBook(b) ? { badge: "Novo" } : {}),
            }))}
          />
        ) : null}

        {canRead ? (
          <>
            <MyBooks
              onOpen={startBook}
              onRemoved={() => setHomeTick((n) => n + 1)}
              session={authSession}
              onSubmitted={() =>
                setAuthNotice({ text: "Livro enviado para análise. Você acompanha em Perfil › Seus envios.", ok: true })
              }
              onRequest={() => requestImport()}
              request={importRequest}
              setRequest={setImportRequest}
            />

            <div id="recursos">
              <Explore onOpen={startBook} onImport={(hint) => requestImport(hint ?? {})} communityBooks={communityBooks} />
            </div>
          </>
        ) : null}

        {celebration ? (
          <div className="celebration" role="status" onClick={() => setCelebration(null)}>
            <div className="celebration-card">
              <span className="celebration-emoji" aria-hidden="true">
                {celebration.emoji}
              </span>
              <strong>{celebration.title}</strong>
              {celebration.text ? <span>{celebration.text}</span> : null}
            </div>
            <div className="celebration-burst" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
          </div>
        ) : null}

        {updateBanner}

        <footer className="home-foot">
          Storyverse · leitura que conversa com você · textos em domínio público do{" "}
          <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
            Project Gutenberg
          </a>
          <span className="home-credit">
            Desenvolvido por <strong>Axyon Software House</strong>
          </span>
          <button type="button" className="footer-about-link" onClick={() => setAboutOpen(true)}>
            Sobre nós
          </button>
        </footer>
      </div>
    );
  }

  const ready = loadState === "ready" && fullText.length > 0;
  const castReady = cast !== null;
  const userHasSpoken = messages.some((m) => m.role === "user");
  const hasNextChapter = chapterIndex < chapters.length - 1;

  return (
    <div className={`reader theme-${prefs.theme}`}>
      {/* Por cima de tudo, sem pegar cliques: tira o azul da tela para ler à noite. */}
      {prefs.nightLight ? <div className={`night-light night-light-${prefs.nightLight}`} aria-hidden="true" /> : null}
      <header className="reader-bar">
        <button type="button" className="icon-btn" onClick={leaveBook} aria-label="Voltar para a estante">
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
              você e mais {readingHere - 1} {readingHere - 1 === 1 ? "pessoa lendo" : "pessoas lendo"} agora
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
            <select
              className="chapter-select"
              value={chapterIndex}
              onChange={(e) => setChapterIndex(Number(e.target.value))}
              aria-label="Escolher capítulo"
            >
              {chapters.map((ch, i) => (
                <option key={ch.index} value={i}>
                  {ch.label}
                </option>
              ))}
            </select>
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
                onClick={() => (speaking ? stopSpeaking() : startSpeaking(firstVisibleBlock()))}
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
              className={`icon-btn text-btn translate-btn ${prefs.translate ? "is-active" : ""}`}
              onClick={() => {
                if (!prefs.translate && engine === "local") warmUpLocalTranslator();
                setPrefs((p) => ({ ...p, translate: !p.translate }));
              }}
              aria-pressed={prefs.translate}
              aria-label={prefs.translate ? "Ver o texto original em inglês" : "Traduzir para o português"}
              title={prefs.translate ? "Ver o original em inglês" : "Traduzir para o português"}
            >
              {prefs.translate ? "PT" : "EN"}
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
            className="icon-btn"
            onClick={() => setPrefs((p) => ({ ...p, theme: p.theme === "night" ? "sepia" : "night" }))}
            aria-label={prefs.theme === "night" ? "Mudar para modo sépia" : "Mudar para modo noturno"}
          >
            {prefs.theme === "night" ? Icon.sun : Icon.moon}
          </button>
          <button
            type="button"
            className={`icon-btn night-light-btn ${prefs.nightLight ? "is-on" : ""}`}
            onClick={() => setPrefs((p) => ({ ...p, nightLight: ((p.nightLight + 1) % 3) as NightLight }))}
            aria-label={`Luz noturna: ${NIGHT_LIGHT_LABELS[prefs.nightLight]}. Toque para mudar.`}
            title={`Luz noturna: ${NIGHT_LIGHT_LABELS[prefs.nightLight]}`}
          >
            {Icon.nightLight}
            {prefs.nightLight ? <span className="night-light-level" aria-hidden="true">{prefs.nightLight}</span> : null}
          </button>
        </div>

        <div className="progress" aria-hidden="true">
          <span style={{ width: `${readingProgressPct}%` }} />
        </div>
      </header>

      <div className="reader-layout">
        <main
          ref={readRef}
          className="page"
          onScroll={onReadScroll}
          style={{ "--read-size": `${FONT_SIZES[prefs.fontStep]}rem` } as React.CSSProperties}
        >
          {loadState === "loading" ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              {isLocalBook(book) ? "Abrindo o seu livro…" : "Buscando o livro no acervo…"}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="page-status page-status-err">
              <p>{loadError}</p>
              <button type="button" className="btn btn-primary" onClick={retryLoad}>
                Tentar de novo
              </button>
            </div>
          ) : null}

          {ready && currentChapter ? (
            <article
              className="prose"
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
                const marks = highlights
                  .filter((h) => h.chapterIndex === chapterIndex && h.paragraph === i)
                  .map((h) => h.text);
                // Com destaque, o itálico (_assim_) sai: o trecho marcado precisa bater com o texto.
                const text =
                  marks.length > 0
                    ? splitByHighlights(shownTexts[i].replace(/_/g, ""), marks).map((piece, k) =>
                        piece.marked ? <mark key={k}>{piece.text}</mark> : piece.text,
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
                {hasNextChapter ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={() => setChapterIndex((i) => i + 1)}
                  >
                    Próximo capítulo {Icon.next}
                  </button>
                ) : (
                  <p className="the-end">Fim — mas a conversa continua ao lado.</p>
                )}
                {isLocalBook(book) ? (
                  <span className="source-link">Livro importado · guardado só neste aparelho</span>
                ) : book.source === "community" ? (
                  <span className="source-link">Livro da comunidade · enviado por um leitor e aprovado pela curadoria</span>
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
          ) : null}
        </main>

        {voicePanelOpen && speaking ? (
          <>
            <div className="voice-backdrop" onClick={() => setVoicePanelOpen(false)} />
            <div className="voice-panel" role="dialog" aria-label="Voz e velocidade">
              <div className="voice-panel-head">
                <strong>Voz e velocidade</strong>
                <button type="button" className="icon-btn" onClick={() => setVoicePanelOpen(false)} aria-label="Fechar">
                  {Icon.close}
                </button>
              </div>

              <span className="voice-label">Velocidade</span>
              <div className="voice-rates" role="group" aria-label="Velocidade">
                {RATE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={r === speechRate ? "active" : undefined}
                    aria-pressed={r === speechRate}
                    onClick={() => chooseRate(r)}
                  >
                    {String(r).replace(".", ",")}x
                  </button>
                ))}
              </div>

              <span className="voice-label">Voz</span>
              {voices.length === 0 ? (
                <p className="voice-tip">Procurando as vozes deste aparelho…</p>
              ) : (
                <ul className="voice-list">
                  {voices.map((v) => (
                    <li key={v.uri}>
                      <button
                        type="button"
                        className={v.uri === voiceUri ? "active" : undefined}
                        aria-pressed={v.uri === voiceUri}
                        onClick={() => chooseVoice(v.uri)}
                      >
                        <span>{v.label}</span>
                        {v.natural ? <em>natural</em> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {voices.length > 0 && !voices.some((v) => v.natural) ? (
                <p className="voice-tip">
                  Este aparelho só tem vozes simples. Para uma voz quase humana, grátis: abra o Storyverse no{" "}
                  <strong>Microsoft Edge</strong> (vozes Francisca e Antônio) ou, no iPhone, baixe uma voz{" "}
                  <strong>Aprimorada</strong> em Ajustes › Acessibilidade › Conteúdo Falado › Vozes.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {selection ? (
          <div
            className="sel-toolbar"
            role="toolbar"
            aria-label="Ações do trecho selecionado"
            style={{
              // Metade da largura do menu (~180 px) + margem, para não sair da tela.
              left: Math.min(Math.max(selection.x, 190), window.innerWidth - 190),
              top: coarsePointer() || selection.top < 90 ? selection.bottom + 12 : selection.top - 54,
            }}
            // Clicar no menu não pode desfazer a seleção antes do clique.
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
          >
            <button type="button" onClick={addHighlight}>
              {Icon.bookmark} Marcar
            </button>
            {selection.word ? (
              <button type="button" onClick={showMeaning}>
                {Icon.book} Significado
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const text = selection.text;
                clearSelection();
                shareQuote(text, currentChapter?.label);
              }}
            >
              {Icon.share} Compartilhar
            </button>
          </div>
        ) : null}

        {wordCard ? (
          <div
            className="word-card"
            role="dialog"
            aria-label={`Significado de ${wordCard.word}`}
            style={{
              left: Math.min(Math.max(wordCard.x, 176), window.innerWidth - 176),
              top: Math.min(wordCard.y + 12, window.innerHeight - 240),
            }}
          >
            <div className="word-card-head">
              <strong>{wordCard.word}</strong>
              {wordCard.info?.kind ? <em>{wordCard.info.kind}</em> : null}
              <button type="button" className="icon-btn" onClick={() => setWordCard(null)} aria-label="Fechar">
                {Icon.close}
              </button>
            </div>
            {!wordCard.info ? (
              <p className="word-card-muted">Procurando…</p>
            ) : (
              <>
                {wordCard.info.translation ? (
                  <p className="word-card-translation">
                    <span>Em português:</span> {wordCard.info.translation}
                  </p>
                ) : null}
                {wordCard.info.definitions.length > 0 ? (
                  <ol>
                    {wordCard.info.definitions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ol>
                ) : !wordCard.info.translation ? (
                  <p className="word-card-muted">Não encontramos esta palavra no dicionário.</p>
                ) : null}
                {wordCard.info.source ? (
                  <a className="word-card-source" href={wordCard.info.source.url} target="_blank" rel="noreferrer">
                    {wordCard.info.source.label} ↗
                  </a>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {highlightsOpen ? (
          <div className="import-overlay" onClick={() => setHighlightsOpen(false)}>
            <div
              className="import-panel marks-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="marks-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="import-head">
                <h3 id="marks-title">Marcações</h3>
                <button type="button" className="icon-btn" onClick={() => setHighlightsOpen(false)} aria-label="Fechar">
                  {Icon.close}
                </button>
              </div>
              {highlightGroups.length === 0 ? (
                <p className="import-note">
                  Selecione um trecho do livro e toque em <strong>Marcar</strong> para guardar suas citações
                  favoritas aqui.
                </p>
              ) : (
                <ul className="marks-list">
                  {highlightGroups.map(({ first, text }) => (
                    <li key={first.group ?? first.id}>
                      <span className="marks-chapter">{first.chapterLabel}</span>
                      <blockquote>{text}</blockquote>
                      <div className="marks-actions">
                        <button type="button" className="link-btn" onClick={() => openHighlight(first)}>
                          Ir para o trecho
                        </button>
                        <button type="button" className="link-btn" onClick={() => shareQuote(text, first.chapterLabel)}>
                          Compartilhar
                        </button>
                        <button type="button" className="link-btn marks-remove" onClick={() => removeHighlight(first)}>
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {celebration ? (
          <div className="celebration" role="status" onClick={() => setCelebration(null)}>
            <div className="celebration-card">
              <span className="celebration-emoji" aria-hidden="true">
                {celebration.emoji}
              </span>
              <strong>{celebration.title}</strong>
              {celebration.text ? <span>{celebration.text}</span> : null}
            </div>
            <div className="celebration-burst" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
          </div>
        ) : null}

        {updateBanner}

        {toast || sharing ? (
          <div className="toast" role="status">
            {sharing ? "Gerando a imagem…" : toast}
          </div>
        ) : null}

        <aside className={`chat ${chatOpen ? "is-open" : ""}`} aria-label="Conversa com os personagens">
          {character ? (
            <div className="chat-head">
              <Avatar character={character} size="lg" bookTitle={book.title} generate />
              <div className="chat-head-text">
                <strong>{character.name}</strong>
                <span>{character.role}</span>
              </div>
              {userHasSpoken ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={resetConversation}
                  aria-label={`Recomeçar a conversa com ${character.name}`}
                  title="Recomeçar a conversa"
                >
                  {Icon.refresh}
                </button>
              ) : null}
              <button
                type="button"
                className="icon-btn chat-close"
                onClick={() => setChatOpen(false)}
                aria-label="Fechar conversa"
              >
                {Icon.close}
              </button>
            </div>
          ) : (
            <div className="chat-head chat-head-pending">
              <span className="spinner" aria-hidden="true" />
              <div className="chat-head-text">
                <strong>{ready ? "Conhecendo os personagens…" : "Abrindo o livro…"}</strong>
                <span>Em instantes eles chegam para conversar</span>
              </div>
              <button
                type="button"
                className="icon-btn chat-close"
                onClick={() => setChatOpen(false)}
                aria-label="Fechar conversa"
              >
                {Icon.close}
              </button>
            </div>
          )}

          {characters.length > 1 ? (
            <div className="cast" role="tablist" aria-label="Personagens">
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === character?.id}
                  className={`cast-chip ${c.id === character?.id ? "active" : ""}`}
                  style={{ "--c": c.color } as React.CSSProperties}
                  onClick={() => setActiveCharId(c.id)}
                >
                  <Avatar character={c} size="sm" bookTitle={book.title} generate />
                  {shortNameOf(c)}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={chatBodyRef} className="chat-body">
            {messages.map((m) =>
              m.role === "assistant" && character ? (
                <div key={m.id} className="msg msg-assistant">
                  <Avatar character={character} size="sm" bookTitle={book.title} generate />
                  <div className="bubble assistant">{m.text}</div>
                  <button
                    type="button"
                    className="msg-share"
                    onClick={() => shareMessage(m)}
                    aria-label="Compartilhar esta fala como imagem"
                    title="Compartilhar como imagem"
                  >
                    {Icon.share}
                  </button>
                </div>
              ) : (
                <div key={m.id} className="msg msg-user">
                  <div className="bubble user">{m.text}</div>
                </div>
              ),
            )}
            {loading && character ? (
              <div className="msg msg-assistant">
                <Avatar character={character} size="sm" bookTitle={book.title} generate />
                <div className="bubble assistant typing" aria-label={`${character.name} está escrevendo`}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </div>

          {error ? <div className="chat-err">{error}</div> : null}

          {!userHasSpoken && character && ready && !loading && !outOfMessages ? (
            <div className="suggestions">
              {suggestionsFor(character).map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => void sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {limitApplies && messagesLeft > 0 && messagesLeft <= 5 ? (
            <p className="limit-note">
              {messagesLeft === 1 ? "Resta 1 mensagem hoje." : `Restam ${messagesLeft} mensagens hoje.`}
            </p>
          ) : null}

          {outOfMessages ? (
            <div className="limit-out" role="status">
              <strong>Por hoje é só 💛</strong>
              <span>
                Você usou as {DAILY_MESSAGE_LIMIT} mensagens de hoje. Os personagens voltam a conversar amanhã —
                enquanto isso, a leitura continua.
              </span>
            </div>
          ) : (
          <form className="composer" onSubmit={onSend}>
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={USER_MESSAGE_MAX_CHARS}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                ready && character ? `Escreva para ${shortNameOf(character)}…` : "Aguarde um instante…"
              }
              disabled={loading || !ready || !castReady || !character}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={loading || !ready || !character || !input.trim()}
              aria-label="Enviar"
            >
              {Icon.send}
            </button>
          </form>
          )}
        </aside>

        {!chatOpen ? (
          <button
            type="button"
            className="chat-fab"
            onClick={() => {
              setChatOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            {character ? <Avatar character={character} size="sm" bookTitle={book.title} generate /> : null}
            {character ? `Conversar com ${shortNameOf(character)}` : "Conversar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
