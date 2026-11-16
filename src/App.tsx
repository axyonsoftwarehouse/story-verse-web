import { userStorage } from "./lib/dataOwner";
import { authModalFromUrl, safeLoginReturn } from "./lib/loginReturn";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BadgeIcon } from "./components/badgeIcons";
import { useConfirm } from "./components/ConfirmDialog";
import { DailySpinModal, DiamondShopPage, ProfilePage, RankingPage, RouteLoading } from "./lazyRoutes";
import { Icon } from "./components/Icon";
import { formatMinutes } from "./lib/formatMinutes";
import { ReaderCount } from "./components/ReaderCount";
import { ApiHttpError } from "./lib/backend";
import { disablePush } from "./lib/push";
import { sanctionMessage, warningMessage } from "./features/auth/sanctionNotice";
import { featuredBooks, suggestedBooks } from "./data/ebooks";
import type { Ebook, StoryCharacter } from "./data/types";
import {
  characterReply,
  detectProvider,
  refreshAiQuota,
  USER_MESSAGE_MAX_CHARS,
  type ChatTurn,
} from "./lib/ai";
import { castFromNames, forgetCast, knownCast, loadCast } from "./lib/cast";
import {
  characterTalks,
  forgetChat,
  loadChat,
  saveChat,
  type ChatMsg,
} from "./lib/chatHistory";
import { achievements, takeNewAchievements, type Achievement } from "./lib/achievements";
import { quoteOfTheDay } from "./data/dailyQuotes";
import { applyAppTheme } from "./lib/appTheme";
import {
  dismissNaturalOffer,
  downloadNaturalVoice,
  naturalOfferDismissed,
  naturalVoicesFor,
  naturalVoiceSupported,
  naturalVoiceUri,
  storedNaturalVoices,
} from "./lib/naturalVoice";
import { activateDataOwner, clearAccountStorage, currentDataOwner, dataOwnerReady } from "./lib/dataOwner";
import { startAutoSync, syncNow } from "./lib/cloudSync";
import { syncBooks } from "./lib/bookSync";
import {
  catalogBookToEbook,
  catalogNumericId,
  fetchCatalogBookText,
  getCatalogBook,
  searchCatalog,
} from "./lib/catalog";
import { finishedBooks, markBookFinished } from "./lib/finished";
import { useAccountFeatures } from "./features/auth/useAccountFeatures";
import { isStaff } from "./features/admin/adminSections";
import { BookStatusControl } from "./features/library/BookStatusControl";
import { FinishBookDialog } from "./features/library/FinishBookDialog";
import { LibraryPage } from "./features/library/LibraryPage";
import { hasFeature } from "./lib/accountFeatures";
import { GROUPS_AVAILABLE, PENDING_INVITE_KEY } from "./lib/groups";
import { GoldDust } from "./components/GoldDust";
import { publishShowcase } from "./lib/social";
import { useGroupsUnread } from "./features/groups/useGroupsUnread";
import { NavMore, type NavMoreItem } from "./features/notifications/NavMore";
import { useNavCrowded } from "./lib/useNavCrowded";
import { metadataProblem } from "./lib/submissionMetadata";
import { NotificationBell } from "./features/notifications/NotificationBell";
import { bookKeyOf } from "./lib/library";
import {
  recordFinished,
  recordOpened,
  recordProgress,
  shelfEnabled,
  shelfEntry,
  type LocalShelfEntry,
} from "./lib/libraryStore";
import { useFinishPrompt } from "./features/library/useFinishPrompt";
import { connectShelf } from "./lib/libraryWiring";
import { BILLING_UI_ENABLED, billingDate, billingStatusLabel, type SubscriptionSnapshot } from "./lib/billing";
import { BillingBlocked } from "./features/billing/BillingBlocked";
import { watchPresence } from "./lib/presence";
import { holdSplash, releaseSplash } from "./lib/splash";
import {
  flyEmoji,
  haptic,
  installCoverTilt,
  openBookWithTransition,
  prefersReducedMotion,
  useReveal,
} from "./lib/motion";
import { readerUrl, rememberOpenBook, takeReaderParam } from "./lib/readerUrl";
import { blobToDataUrl, dataUrlToBlob, prepareImage, uploadBookCover } from "./lib/profileMedia";
import {
  approvedCommunityBooks,
  communityIdOf,
  fetchCommunityBookText,
  isNewCommunityBook,
  matchesCommunitySearch,
  newBookLabel,
  normalizeText,
  RIGHTS_OPTIONS,
  submitBook,
  syncSubmissionCovers,
  type Rights,
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
  deleteAllLocalRecords,
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
import { missYouMessage, tidyAmbientMessages } from "./lib/readingAmbient";
import { dismissNudge, homeNudge, NUDGE_AFTER_DAYS, nudgeText, voiceFor, type HomeNudge } from "./lib/characterNudge";
import { withOfflineCopy } from "./lib/offlineText";
import { searchOutsideCatalog, type BookHint } from "./lib/openLibrary";
import { excerptNearScrollRatio } from "./lib/readingContext";
import { addSeenBlocks, countWords, type SeenBlock } from "./lib/readingPages";
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
  type ReadingEvents,
  dayKey,
} from "./lib/readingStats";
import {
  checkStreakFreeze,
  claimReadingRewards,
  fetchSpinStatus,
  rescueStreak,
  takeSpinOffer,
  type FreezeOutcome,
} from "./lib/diamonds";
import { PLACE_MEDALS, reportReading, readingHeartbeat, takeWeeklyAwards } from "./lib/ranking";
import { lastCharacter, rememberCharacter, syncEngagementState } from "./lib/reminders";
import { installPlatform, storeLinks, useAppInstall, useUpdateReady, type InstallPlatform } from "./lib/pwa";
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
import { countMessage, extraMessages, messagesLeftToday } from "./lib/usageLimit";
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthNetworkError,
  AuthSessionError,
  authEnabled,
  clearLegacyCredentials,
  loginRequired,
  consumeAuthRedirect,
  EMAIL_OTP_ENABLED,
  refreshAuthSession,
  refreshProfile,
  storedAuthSession,
  resendSignupCode,
  requestPasswordReset,
  resetPasswordWithToken,
  validateResetToken,
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
  grantRemoteTranslationConsent,
  hasRemoteTranslationConsent,
  storeTranslation,
  translateParagraphs,
  warmUpLocalTranslator,
  type TranslationEngine,
} from "./lib/translate";
import { LEGAL_HOLDER_NAME } from "./features/legal/holder";
import "./App.css";
import { installNudgeReady, noteBookOpened, noteVisit } from "./lib/installNudge";
import { FONT_SIZES, PREFS_KEY, NightLight, NIGHT_LIGHT_LABELS, loadPrefs } from "./lib/readingPrefs";
import { shortNameOf } from "./lib/characterName";
import { displayNameOf } from "./lib/userMeta";
import { savedLabel } from "./lib/streakLabels";
import { useBackClose } from "./lib/useBackClose";
import { shelfAchievements } from "./lib/shelfAchievements";
import { CONTINUE_PREVIEW } from "./lib/homePreviews";
import { Avatar } from "./components/Avatar";
import { BookCover } from "./components/BookCover";
import { UserAvatar } from "./components/UserAvatar";
import { CountUp } from "./components/CountUp";
import { PasswordInput } from "./components/PasswordInput";
import { LastBook, ReminderSetup } from "./features/home/ReminderSetup";
import { ProfileShelf } from "./features/home/ProfileShelf";


type Msg = ChatMsg;

const EMPTY_THREAD: Msg[] = [];
/** Capítulo sem tradução carregada: a mesma referência sempre, para não refazer o texto da tela. */
const NO_TRANSLATIONS: Record<number, (string | null)[]> = {};

type LoadState = "idle" | "loading" | "ready" | "error";

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

/** Toque (celular): o menu da seleção vai abaixo do trecho, longe do menu nativo do sistema. */
function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
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
type BookSearchHit = {
  chapterIndex: number;
  chapterLabel: string;
  paragraph: number;
  start: number;
  before: string;
  match: string;
  after: string;
};

/** Até 60 trechos onde o termo aparece (sem diferenciar maiúsculas nem acentos). */
function searchBook(
  blocksByChapter: Block[][],
  chapters: { label: string }[],
  term: string,
): { hits: BookSearchHit[]; total: number } {
  const plainText = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = plainText(term.trim());
  if (needle.length < 2) return { hits: [], total: 0 };
  const hits: BookSearchHit[] = [];
  let total = 0;
  blocksByChapter.forEach((blocks, chapterIndex) => {
    blocks.forEach((b, paragraph) => {
      if (b.kind === "image") return;
      const text = b.text.replace(/_/g, "");
      // A normalização mantém o tamanho do texto (só tira os acentos combinados depois de NFD).
      const hay = plainText(text);
      let at = hay.indexOf(needle);
      while (at !== -1) {
        total++;
        if (hits.length < 60) {
          const from = Math.max(0, at - 50);
          const to = Math.min(text.length, at + needle.length + 70);
          hits.push({
            chapterIndex,
            chapterLabel: chapters[chapterIndex]?.label ?? "",
            paragraph,
            start: at,
            before: `${from > 0 ? "…" : ""}${text.slice(from, at)}`,
            match: text.slice(at, at + needle.length),
            after: `${text.slice(at + needle.length, to)}${to < text.length ? "…" : ""}`,
          });
        }
        at = hay.indexOf(needle, at + needle.length);
      }
    });
  });
  return { hits, total };
}

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

function LangBadge({ book }: { book: Ebook }) {
  return (
    <span className={`lang-badge lang-${book.textLanguage}`}>
      {book.textLanguage === "pt" ? "Em português" : "Texto em inglês"}
    </span>
  );
}

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
        <PrivacyNote
          details={
            <>
              O Storyverse não guarda o que você busca nem mostra para ninguém. O termo vai, por conexão
              criptografada (HTTPS), só até os catálogos de livros para trazer os resultados. Veja tudo em
              Perfil › Ajustes › Privacidade.
            </>
          }
        >
          Suas buscas são privadas e não ficam salvas.
        </PrivacyNote>
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

      {/* Em "Todo o acervo", os da comunidade só entram no topo quando há busca: sem busca, a estante
          "Da comunidade" logo acima já mostra os mesmos livros (U2). */}
      {!onlyCommunity && searching && communityShown.length > 0 ? (
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
          Nenhum livro encontrado para “{term}”. A busca cobre os clássicos do Project Gutenberg e os
          livros da comunidade; se você tem o arquivo do livro,{" "}
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

/** Livros do próprio leitor (.epub, .pdf, .txt): com conta, vão para os outros aparelhos dela. */
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
    // Para o acervo público, título e autor de verdade (U1); na estante pessoal vale qualquer um.
    const shareProblem = share ? metadataProblem(title, author) : null;
    if (shareProblem) return setError(`${shareProblem} Ele aparece assim para todo mundo no acervo.`);
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
    const where = session ? "de todos os aparelhos da sua conta" : "deste aparelho";
    if (!window.confirm(`Remover “${b.title}” ${where}? O progresso de leitura também será apagado.`)) {
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

            <label
              className={`file-drop ${parsed ? "is-ready" : ""} ${parsing ? "is-loading" : ""}`}
              aria-busy={parsing}
            >
              <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={onFile} disabled={parsing || saving} />
              {parsing ? <span className="spinner file-drop-spinner" aria-hidden="true" /> : null}
              <strong>
                {parsing ? "Lendo o arquivo…" : fileName || "Escolher arquivo"}
              </strong>
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
              <button type="submit" className="btn btn-primary" disabled={!parsed || saving} aria-busy={saving}>
                {saving ? <span className="spinner btn-spinner" aria-hidden="true" /> : null}
                {saving ? (share ? "Enviando…" : "Guardando…") : share ? "Enviar e ler" : "Importar e ler"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

/** Aviso na tela inicial: a sequência quebrou (oferta) ou foi salva com diamantes. */
function FreezeNudge({
  outcome,
  busy,
  onSave,
  onOpenShop,
  onClose,
}: {
  outcome: FreezeOutcome;
  busy: boolean;
  onSave: () => void;
  onOpenShop: () => void;
  onClose: () => void;
}) {
  const close = (
    <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar aviso">
      {Icon.close}
    </button>
  );
  if (outcome.kind === "saved") {
    return (
      <div className="nudge nudge-diamond" role="status">
        <span className="nudge-emoji" aria-hidden="true">
          🧊
        </span>
        <div>
          <strong>
            Sequência salva: {outcome.streak} {outcome.streak === 1 ? "dia" : "dias"}
          </strong>
          <span>Salva-ofensiva usado · −{outcome.spent} 💎</span>
        </div>
        {close}
      </div>
    );
  }
  const { rescue, wallet, reason } = outcome;
  const cost = rescue.paidDays.length * wallet.freeze_price;
  return (
    <div className="nudge nudge-diamond" role="status">
      <span className="nudge-emoji" aria-hidden="true">
        💔
      </span>
      <div>
        <strong>
          Sua sequência de {rescue.streak} {rescue.streak === 1 ? "dia" : "dias"} quebrou
        </strong>
        <span>
          {reason === "manual"
            ? "Dá para salvar com o Salva-ofensiva."
            : reason === "limit"
              ? "Limite da semana atingido."
              : `Faltam ${Math.max(0, cost - wallet.balance)} 💎 para salvar.`}
        </span>
      </div>
      {reason === "manual" ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>
          {busy ? "Salvando…" : `Salvar · ${cost} 💎`}
        </button>
      ) : reason === "no-balance" ? (
        <button type="button" className="btn" onClick={onOpenShop}>
          Loja
        </button>
      ) : null}
      {close}
    </div>
  );
}

/** Convite na tela inicial para abrir o ranking. */
function RankingTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="ranking-teaser" onClick={onOpen}>
      <span className="ranking-teaser-icon" aria-hidden="true">
        🏆
      </span>
      <span className="ranking-teaser-text">
        <strong>Ranking de leitores</strong>
        <span>Veja quem mais leu, no geral e na semana, e em que lugar você está. O pódio da semana ganha diamantes.</span>
      </span>
      <span className="ranking-teaser-go" aria-hidden="true">
        {Icon.next}
      </span>
    </button>
  );
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

/** Status e nota deste livro na estante, para o chat (só com a estante ligada). */
function shelfContextFor(book: Ebook) {
  if (!shelfEnabled()) return undefined;
  const key = bookKeyOf(book);
  const entry = key ? shelfEntry(key) : null;
  return entry ? { status: entry.status, rating: entry.rating } : undefined;
}

/** Conquistas da conta agora (sem presentes: esses dependem do servidor e só contam no perfil). */
function currentAchievements(): Achievement[] {
  const talks = characterTalks();
  const markGroups = new Set(allHighlights().flatMap(({ bookId, highlights }) => highlights.map((h) => `${bookId}:${h.group ?? h.id}`)));
  const totals = readingTotals();
  return achievements({
    totalMinutes: totals.totalMinutes,
    bestStreak: totals.bestStreak,
    finishedBooks: finishedBooks().length,
    marks: markGroups.size,
    messagesSent: talks.reduce((n, t) => n + t.sent, 0),
    charactersTalked: talks.length,
    giftsReceived: null,
    shelf: shelfAchievements(),
  });
}

/** Aviso pequeno no topo quando sai uma conquista nova; some sozinho e não cobre a leitura. */
function AchievementToast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  const medal = useRef<HTMLSpanElement>(null);
  /** Ao sair, a medalha voa até o avatar do topo (é lá que as conquistas ficam guardadas). */
  const leave = useCallback(() => {
    flyEmoji(achievement.emoji, medal.current, document.querySelector(".nav-account .nav-avatar") ?? document.querySelector(".nav-account"));
    onDone();
  }, [achievement, onDone]);
  useEffect(() => {
    haptic([20, 40, 20]);
    const t = window.setTimeout(leave, 3600);
    return () => window.clearTimeout(t);
  }, [leave]);
  return createPortal(
    <div className="achievement-toast" role="status" onClick={leave}>
      <span className="achievement-toast-medal" aria-hidden="true" ref={medal}>
        <BadgeIcon id={achievement.id} size={22} />
      </span>
      <span>
        <small>Conquista desbloqueada</small>
        <strong>{achievement.title}</strong>
      </span>
    </div>,
    document.body,
  );
}

/**
 * Recado do personagem na tela inicial: o leitor sumiu do livro há alguns dias e quem estava
 * conversando com ele manda uma mensagem na própria voz. Responder abre o livro já na conversa.
 */
function CharacterNudgeCard({
  nudge,
  onContinue,
  onReply,
  onDismiss,
}: {
  nudge: HomeNudge;
  onContinue: () => void;
  onReply: () => void;
  onDismiss: () => void;
}) {
  const { progress, character, text } = nudge;
  const avatar: StoryCharacter = { id: character.id ?? character.name, name: character.name, role: "", color: character.color, systemHint: "" };
  return (
    <section className="character-nudge" aria-label={`Mensagem de ${character.name}`}>
      <Avatar character={avatar} bookTitle={progress.book.title} />
      <div className="character-nudge-body">
        <span className="eyebrow">
          {character.name} · {progress.book.title}
        </span>
        <p className="character-nudge-text">“{text}”</p>
        <span className="character-nudge-where">Você parou em {progress.chapterLabel}</span>
        <div className="character-nudge-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onReply}>
            {Icon.chat} Responder
          </button>
          <button type="button" className="link-btn" onClick={onContinue}>
            Continuar lendo
          </button>
        </div>
      </div>
      <button type="button" className="icon-btn character-nudge-close" onClick={onDismiss} aria-label={`Fechar a mensagem de ${character.name}`}>
        {Icon.close}
      </button>
    </section>
  );
}

/** Frase do dia: um trecho conhecido; tocar revela de qual livro é. */
function DailyQuote({ books }: { books: Ebook[] }) {
  const quote = useMemo(() => quoteOfTheDay(), []);
  const book = books.find((b) => b.title === quote.bookTitle);
  const [revealed, setRevealed] = useState(false);
  if (!book) return null;
  return (
    <section className="daily-quote" aria-label="Frase do dia">
      <span className="eyebrow">✦ Frase do dia</span>
      <blockquote>“{quote.text}”</blockquote>
      {revealed ? (
        <p className="daily-quote-book">
          <strong>{book.title}</strong> · {book.author}
        </p>
      ) : (
        <button type="button" className="btn daily-quote-guess" onClick={() => setRevealed(true)}>
          De qual livro é?
        </button>
      )}
    </section>
  );
}

function greetingNow(d = new Date()): string {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/** O que o personagem manda para chamar o leitor de volta (texto fixo: não gasta IA). */
function welcomeCallLine(hasCharacter: boolean, pick: number, d = new Date()): string {
  if (!hasCharacter) return "Sua história está te esperando. Os personagens também.";
  const h = d.getHours();
  const lines =
    h >= 22 || h < 5
      ? ["Ainda por aqui a essa hora? Dá tempo de mais um capítulo comigo.", "Noite boa pra ler, né? Vem, eu te conto o resto."]
      : h < 12
        ? ["Bom dia! Que tal começar o dia com a nossa história?", "Bom dia! Quero saber o que você vai achar do que vem agora."]
        : [
            "Oi! Fiquei pensando em você e na nossa história.",
            "Senti sua falta. Vamos continuar de onde paramos?",
            "Tenho uma coisa pra te contar sobre o que vem depois… mas só se você continuar lendo.",
          ];
  return lines[Math.floor(pick * lines.length)];
}

/**
 * Boas-vindas de quem está lendo: a capa do livro e o personagem "digitando" (só o nome, sem a
 * foto) até chegar o balão chamando de volta. A capa daqui é a que cresce e abre ao tocar em
 * "Continuar lendo".
 */
/**
 * Situação da assinatura em destaque na tela inicial, com o atalho para "Minha assinatura".
 * Quem está sem acesso nem chega aqui (vê a tela de bloqueio), então só sobram estes casos.
 */
function PlanCard({ status }: { status: SubscriptionSnapshot }) {
  const until = billingDate(status.accessUntil);
  // O motivo vem antes do status: acesso grátis e Pix não têm assinatura no cartão por trás.
  const reason = status.reason ?? status.status;
  const view =
    reason === "past_due"
      ? { tone: "is-warning", icon: "⚠️", title: "Pagamento pendente", sub: "Atualize o cartão para não perder o acesso.", cta: "Resolver agora" }
      : reason === "trial" || reason === "trialing"
        ? { tone: "is-trial", icon: "✨", title: "Você está no teste grátis", sub: `Acesso liberado até ${until}.`, cta: "Ver assinatura" }
        : reason === "pix"
          ? { tone: "", icon: "💠", title: "Pago com Pix", sub: `Acesso até ${until}. Não renova sozinho.`, cta: "Pagar mais dias" }
          : reason === "grant" || reason === "staff"
            ? {
                tone: "",
                icon: "🎁",
                title: billingStatusLabel(reason),
                sub: status.accessUntil ? `Liberado pela equipe até ${until}.` : "Seu acesso foi liberado pela equipe.",
                cta: "Ver detalhes",
              }
            : {
                tone: "",
                icon: "👑",
                title: `Assinante ${status.plan || "Storyverse"}`,
                sub: status.cancelAtPeriodEnd ? `Cancelada: acesso até ${until}.` : `Renova em ${until}.`,
                cta: "Minha assinatura",
              };
  return (
    <Link className={`plan-card ${view.tone}`} to="/conta/assinatura">
      <span className="plan-card-icon" aria-hidden="true">
        {view.icon}
      </span>
      <span className="plan-card-text">
        <strong>{view.title}</strong>
        <span>{view.sub}</span>
      </span>
      <span className="plan-card-cta">
        {view.cta}
        {Icon.next}
      </span>
    </Link>
  );
}

function WelcomeCall({ book, onOpen }: { book: Ebook; onOpen: () => void }) {
  const character = useMemo(() => {
    const cast = knownCast(book);
    if (!cast) return null;
    const last = lastCharacter(book.id);
    return cast.find((c) => c.name === last) ?? cast[0];
  }, [book]);
  // Sorteia uma vez só; a frase acompanha o personagem quando ele aparece depois do primeiro desenho.
  const [pick] = useState(() => Math.random());
  const line = welcomeCallLine(Boolean(character), pick);
  const [phase, setPhase] = useState<"waiting" | "typing" | "said">(() => (prefersReducedMotion() ? "said" : "waiting"));
  useEffect(() => {
    if (phase === "said") return;
    const typing = window.setTimeout(() => setPhase("typing"), 450);
    const said = window.setTimeout(() => setPhase("said"), 1900);
    return () => {
      window.clearTimeout(typing);
      window.clearTimeout(said);
    };
    // Só na primeira vez que a tela aparece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="welcome-call" onClick={onOpen} aria-label={`Continuar lendo ${book.title}`}>
      <span className="welcome-call-book">
        <BookCover book={book} />
      </span>
      <span className="welcome-call-talk" aria-hidden="true">
        <span className="welcome-call-name">{character ? shortNameOf(character) : book.title}</span>
        {phase === "said" ? (
          <span className="welcome-call-bubble">{line}</span>
        ) : phase === "typing" ? (
          <span className="welcome-call-bubble is-typing typing">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </span>
    </button>
  );
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
              <ReaderCount bookKey={bookKeyOf(b)} />
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

/**
 * Aviso curto de privacidade nas telas de conversa e busca: o que acontece com o que a pessoa
 * digita, com o detalhe a um toque. A lista completa fica na Central de Privacidade (Ajustes).
 */
function PrivacyNote({ children, details }: { children: React.ReactNode; details: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="privacy-note">
      <p>
        {Icon.lock}
        <span>
          {children}{" "}
          <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Saiba mais"}
          </button>
        </span>
      </p>
      {open ? <p className="privacy-note-more">{details}</p> : null}
    </div>
  );
}

/** Sequência de dias lendo, semana, escudos, meta diária de minutos e lembrete. */
function ReadingStreak({ lastBook }: { lastBook?: LastBook }) {
  const [summary, setSummary] = useState(readingSummary);
  const [reminderOpen, setReminderOpen] = useState(false);
  /** Cada toque na chama solta faíscas e um recado (o número muda a key e reinicia a animação). */
  const [flare, setFlare] = useState(0);
  const flameRef = useRef<HTMLButtonElement>(null);
  function poke() {
    setFlare((n) => n + 1);
    haptic(15);
    if (prefersReducedMotion()) return;
    flameRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.45) rotate(-8deg)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }],
      { duration: 550, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }
  const pct = Math.min(100, (summary.todayMinutes / summary.goalMinutes) * 100);
  const goalDone = summary.todayMinutes >= summary.goalMinutes;
  return (
    <section className="streak" aria-label="Sua leitura">
      <div className="streak-main">
        <button
          ref={flameRef}
          type="button"
          className={`streak-flame ${summary.readToday ? "is-lit" : ""}`}
          onClick={poke}
          aria-label={`Sequência: ${summary.streak} ${summary.streak === 1 ? "dia" : "dias"}`}
        >
          <span aria-hidden="true">🔥</span>
          {flare > 0 ? (
            <span key={flare} className="flame-burst" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
              <b className="flame-tip">
                {summary.readToday
                  ? summary.streak > 1
                    ? `${summary.streak} dias! Volte amanhã 🔥`
                    : "Começou! Volte amanhã 🔥"
                  : "Leia hoje para acender"}
              </b>
            </span>
          ) : null}
        </button>
        <div>
          <strong>
            <CountUp value={summary.streak} /> {summary.streak === 1 ? "dia seguido" : "dias seguidos"}
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
            aria-label={`${d.today ? "Hoje" : d.label}: ${d.state === "read" ? "leu" : d.state === "frozen" ? savedLabel(d) : "não leu"}`}
          >
            {d.state === "frozen" ? (d.bought ? "💎" : "🛡️") : d.label}
          </li>
        ))}
      </ol>

      <div className="streak-goal">
        <div className="streak-goal-text">
          <span>Meta de hoje</span>
          <strong>
            {goalDone ? "Meta cumprida! " : ""}
            <CountUp value={summary.todayMinutes} /> de {summary.goalMinutes} min
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

/**
 * Exemplo do topo da página "acontecendo": a pergunta chega, o personagem escreve e a resposta
 * vai sendo digitada; depois recomeça. Os balões guardam o espaço desde o início (nada pula).
 */
function DemoConversation({ question, answer }: { question: string; answer: string }) {
  const [step, setStep] = useState(() => (prefersReducedMotion() ? 3 : 0));
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? answer.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    void (async () => {
      while (alive) {
        setStep(0);
        setTyped(0);
        await wait(700);
        if (!alive) return;
        setStep(1);
        await wait(1100);
        if (!alive) return;
        setStep(2);
        await wait(1600);
        if (!alive) return;
        setStep(3);
        for (let i = 2; i < answer.length && alive; i += 2) {
          setTyped(i);
          await wait(26);
        }
        setTyped(answer.length);
        await wait(7000);
      }
    })();
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [answer]);
  return (
    <>
      <div className={`bubble user demo-bubble ${step >= 1 ? "is-shown" : ""}`}>{question}</div>
      <div className={`bubble assistant demo-bubble ${step >= 2 ? "is-shown" : ""}`}>
        {answer.slice(0, step >= 3 ? typed : 0)}
        <span className="demo-rest">{answer.slice(step >= 3 ? typed : 0)}</span>
        {step === 2 ? (
          <span className="demo-typing typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>
    </>
  );
}

/** Comemoração no centro da tela (meta do dia, sequência, livro terminado). */
type Celebration = {
  emoji: string;
  title: string;
  text?: string;
  /** Livro terminado: a capa aparece no lugar do emoji, com brilho dourado. */
  book?: Ebook;
  /** Sequência que subiu: o número antigo sai e o novo entra. */
  roll?: { from: number; to: number; suffix: string };
};

function CelebrationOverlay({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  useEffect(() => {
    haptic(celebration.book ? [30, 60, 30, 60, 90] : [25, 50, 40]);
  }, [celebration]);
  const { book, roll } = celebration;
  const pieces = book ? 24 : 14;
  return (
    <div className={`celebration ${book ? "is-book" : ""} ${roll ? "is-streak" : ""}`} role="status" onClick={onClose}>
      <div className="celebration-card">
        {book ? (
          <div className="celebration-cover" aria-hidden="true">
            <BookCover book={book} />
          </div>
        ) : (
          <span className="celebration-emoji" aria-hidden="true">
            {celebration.emoji}
          </span>
        )}
        {roll ? (
          <strong>
            <span className="sr-only">{celebration.title}</span>
            <span className="roll-title" aria-hidden="true">
              <span className="roll">
                <span className="roll-old">{roll.from}</span>
                <span className="roll-new">{roll.to}</span>
              </span>{" "}
              {roll.suffix}
            </span>
          </strong>
        ) : (
          <strong>{celebration.title}</strong>
        )}
        {celebration.text ? <span>{celebration.text}</span> : null}
      </div>
      <div className="celebration-burst" aria-hidden="true" style={{ "--step": `${360 / pieces}deg` } as React.CSSProperties}>
        {Array.from({ length: pieces }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/**
 * O livro ainda pode ser aberto por esta conta? Importado: precisa estar em "Seus livros" neste
 * aparelho. Da comunidade: precisa continuar aprovado no acervo. Do Gutenberg: sempre.
 * Enquanto a lista ainda não chegou (ou falhou, sem internet), não esconde o da comunidade;
 * o importado só aparece depois de conferido (o navegador responde na hora).
 */
function bookAvailable(b: Ebook, known: { localIds: Set<number> | null; communityIds: Set<string> | null }): boolean {
  if (isLocalBook(b)) return known.localIds?.has(b.gutenbergId) ?? false;
  if (b.source === "community") return known.communityIds?.has(b.id) ?? true;
  return true;
}
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
            <strong>{undo.book.title}</strong> saiu da lista
          </span>
          <button type="button" className="btn continue-undo-btn" onClick={onUndo}>
            {Icon.refresh}
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
    if (kind !== "forgot" && (!password || (kind === "register" && password.length < 8))) {
      setError(kind === "register" ? "A senha precisa ter pelo menos 8 caracteres." : "Informe sua senha.");
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
      if (err instanceof ApiHttpError && err.code === "ACCOUNT_SANCTIONED") {
        setError(sanctionMessage(err.body));
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível concluir a autenticação.");
      }
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
              ? "Se este e-mail puder ser usado, enviamos as instruções para"
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
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={kind === "login" ? "current-password" : "new-password"} minLength={kind === "register" ? 8 : undefined} required disabled={loading} />
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
          {kind === "register" ? (
            <p className="auth-legal">
              Ao criar a conta, você concorda com os <Link to="/termos">Termos de uso</Link> e a{" "}
              <Link to="/privacidade">Política de privacidade</Link>.
            </p>
          ) : null}
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
function NewPasswordModal({
  session,
  token,
  onDone,
  onCancel,
}: {
  session?: SupabaseSession;
  token?: string;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /** O link do e-mail é conferido antes de pedir a senha: não adianta digitar se ele já venceu. */
  const [link, setLink] = useState<"checking" | "valid" | "expired">(token ? "checking" : "valid");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void validateResetToken(token).then((valid) => {
      if (alive) setLink(valid ? "valid" : "expired");
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setLoading(true);
    setError("");
    try {
      if (token) {
        await resetPasswordWithToken(token, password);
        onDone("Senha nova salva. Entre com a senha nova.");
        return;
      }
      if (!session) throw new Error("Link de recupera\u00e7\u00e3o inv\u00e1lido.");
      await updatePassword(session, "", password);
      onDone("Senha nova salva. Você já está conectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha nova.");
    } finally {
      setLoading(false);
    }
  }

  if (link !== "valid") {
    const expired = link === "expired";
    return (
      <div className="auth-backdrop" role="presentation">
        <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="new-password-title">
          <span className="eyebrow">Storyverse</span>
          <h2 id="new-password-title">{expired ? "Link inválido ou expirado" : "Conferindo o link…"}</h2>
          <p className="auth-subtitle">
            {expired
              ? "Este link de recuperação já foi usado ou passou do prazo. Peça um novo em “Esqueci minha senha”."
              : "Só um instante enquanto confirmamos o seu link."}
          </p>
          {expired && onCancel ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={onCancel}>
              Voltar para o login
            </button>
          ) : null}
        </section>
      </div>
    );
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
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required disabled={loading} />
          </label>
          <label>
            Repita a senha
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required disabled={loading} />
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

/** Passo a passo para instalar o site como app, por aparelho. */
const INSTALL_STEPS: Record<InstallPlatform, { label: string; steps: React.ReactNode[] }> = {
  ios: {
    label: "iPhone e iPad",
    steps: [
      <>
        No Safari, toque em <strong>Compartilhar</strong> {Icon.share}
      </>,
      <>
        Escolha <strong>Adicionar à Tela de Início</strong>
      </>,
      <>
        Toque em <strong>Adicionar</strong>
      </>,
    ],
  },
  android: {
    label: "Android",
    steps: [
      <>
        Toque no menu <strong>⋮</strong> do navegador
      </>,
      <>
        Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
      </>,
      <>
        Confirme em <strong>Instalar</strong>
      </>,
    ],
  },
  desktop: {
    label: "Computador (Chrome ou Edge)",
    steps: [
      <>
        Clique no ícone de instalar, no fim da barra de endereço
      </>,
      <>
        Ou abra o menu <strong>⋮</strong> / <strong>···</strong> e procure <strong>Instalar Storyverse</strong>
      </>,
    ],
  },
  "mac-safari": {
    label: "Mac (Safari)",
    steps: [
      <>
        No menu <strong>Arquivo</strong>, escolha <strong>Adicionar ao Dock</strong>
      </>,
    ],
  },
  "firefox-desktop": {
    label: "Firefox no computador",
    steps: [
      <>O Firefox no computador não instala sites como app.</>,
      <>
        Abra o Storyverse no <strong>Chrome</strong> ou no <strong>Edge</strong>, ou instale no celular
      </>,
    ],
  },
};

/** "Baixar app": lojas (se houver), o botão nativo do navegador ou o passo a passo do aparelho. */
function InstallAppDialog({ install, onClose }: { install: (() => Promise<void>) | null; onClose: () => void }) {
  const platform = useMemo(() => installPlatform(), []);
  const stores = useMemo(() => storeLinks(), []);
  const [copied, setCopied] = useState(false);
  const here = INSTALL_STEPS[platform];
  const others = (Object.keys(INSTALL_STEPS) as InstallPlatform[]).filter(
    (p) => p !== platform && p !== "firefox-desktop" && !(platform === "firefox-desktop" && p === "desktop"),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="spin-dialog install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className="auth-close spin-close" onClick={onClose} aria-label="Fechar">
          {Icon.close}
        </button>
        <img className="install-icon" src="/icons/icon-192.png" alt="" width={64} height={64} />
        <h2 id="install-title">Baixe o Storyverse</h2>
        <p className="spin-sub">Grátis. Abre em tela cheia e funciona sem internet.</p>

        {stores.android || stores.ios ? (
          <div className="install-stores">
            {stores.android && platform !== "ios" ? (
              <a className="btn btn-primary" href={stores.android} target="_blank" rel="noopener noreferrer">
                Google Play
              </a>
            ) : null}
            {stores.ios && platform !== "android" ? (
              <a className="btn btn-primary" href={stores.ios} target="_blank" rel="noopener noreferrer">
                App Store
              </a>
            ) : null}
          </div>
        ) : null}

        {install ? (
          <button
            type="button"
            className="btn btn-primary install-now"
            onClick={() => {
              void install().finally(onClose);
            }}
          >
            {Icon.download} Instalar agora
          </button>
        ) : (
          <div className="install-steps">
            <span className="shop-section-title">{here.label}</span>
            <ol>
              {here.steps.map((step, i) => (
                <li key={i}>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <details className="install-other">
          <summary>Instalar em outro aparelho</summary>
          {others.map((p) => (
            <div key={p} className="install-steps">
              <span className="shop-section-title">{INSTALL_STEPS[p].label}</span>
              <ol>
                {INSTALL_STEPS[p].steps.map((step, i) => (
                  <li key={i}>
                  <span>{step}</span>
                </li>
                ))}
              </ol>
            </div>
          ))}
          <button type="button" className="btn install-copy" onClick={() => void copyLink()}>
            {copied ? "Link copiado ✓" : "Copiar link do site"}
          </button>
        </details>
      </section>
    </div>
  );
}

const INSTALL_BANNER_KEY = "storyverse:install-banner-hidden";
/** Fechado no celular, o convite volta depois de 14 dias (o botão do topo continua lá). */
const INSTALL_BANNER_PAUSE = 14 * 24 * 60 * 60 * 1000;

function installBannerHidden(): boolean {
  try {
    return Date.now() - Number(userStorage.getItem(INSTALL_BANNER_KEY) ?? 0) < INSTALL_BANNER_PAUSE;
  } catch {
    return false;
  }
}

function hideInstallBanner() {
  try {
    userStorage.setItem(INSTALL_BANNER_KEY, String(Date.now()));
  } catch {
    // Sem armazenamento: some só nesta visita.
  }
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
              <span>Um livro do acervo ou um EPUB, PDF ou TXT seu.</span>
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

/** Quantos livros curados entram em "Novidades da biblioteca" na home. */
const CATALOG_NEW_LIMIT = 6;

export function App() {
  const [book, setBook] = useState<Ebook | null>(null);
  const currentBookRef = useRef(book);
  const readerGeneration = useRef(0);
  currentBookRef.current = book;
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  // Sem Supabase configurado não há sessão para verificar: a tela abre direto.
  const [authLoading, setAuthLoading] = useState(authEnabled);
  // A tela de abertura espera o login carregar (no primeiro desenho, antes de ela poder sair).
  useState(() => holdSplash());
  useEffect(() => {
    if (!authLoading) releaseSplash();
  }, [authLoading]);
  useEffect(() => () => releaseSplash(), []);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ text: string; ok?: boolean } | null>(null);
  const [sanctionNotice, setSanctionNotice] = useState<string | null>(null);
  const authUser: SupabaseUser | null = authSession?.user ?? null;
  const [readyOwner, setReadyOwner] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const dataIsReady = !authEnabled || (!authLoading && readyOwner === (authUser?.id ?? "anon"));
  /** Pode ler e importar: login desligado, conta opcional ou já entrou. */
  const canRead = dataIsReady && (!loginRequired || !!authUser);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  /** Estante (biblioteca pessoal): só para contas com a feature `library`. */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shelfPanelOpen, setShelfPanelOpen] = useState(false);
  const { capabilities } = useAccountFeatures(authSession);
  const subscription = capabilities?.subscription;
  const authScreen =
    window.location.pathname === "/confirmar-email" || window.location.pathname === "/redefinir-senha";
  const billingBlocked =
    BILLING_UI_ENABLED && !authScreen && Boolean(authUser) && subscription !== undefined && !subscription.active;
  /**
   * `/?login=1` ou `/?cadastro=1` (links "Entrar"/"Criar conta" das subpáginas e da assinatura): abre
   * a janela certa uma vez. Tira só esse parâmetro da URL; o `retorno` fica para depois do login.
   */
  useEffect(() => {
    if (authLoading || authUser) return;
    const mode = authModalFromUrl(window.location.search);
    if (!mode) return;
    setAuthModal(mode);
    const params = new URLSearchParams(window.location.search);
    params.delete("login");
    params.delete("cadastro");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, [authLoading, authUser]);
  /** Voltou do login pedindo uma página conhecida (assinatura, audiolivro): continua de onde parou. */
  useEffect(() => {
    if (!authUser) return;
    const retorno = safeLoginReturn(new URLSearchParams(window.location.search).get("retorno"));
    if (retorno) window.location.assign(retorno);
  }, [authUser]);
  const shelfOn = hasFeature(capabilities, "library");
  const canModerate = (capabilities?.roles ?? []).some(
    (role) => role === "superadmin" || role === "moderator",
  );
  const staffOn = isStaff(capabilities?.roles ?? []);
  const groupsOn = GROUPS_AVAILABLE && hasFeature(capabilities, "groups");
  const groupsActivity = useGroupsUnread(groupsOn && authUser ? authUser.id : "");
  const groupsUnread = groupsActivity.total;
  /** Abriu um convite de grupo sem conta: depois de entrar, volta para ele. */
  useEffect(() => {
    if (!authUser) return;
    try {
      const code = localStorage.getItem(PENDING_INVITE_KEY);
      if (code && /^[A-Za-z0-9_-]{16,64}$/.test(code)) window.location.assign(`/g/${code}`);
    } catch {
      // Sem armazenamento.
    }
  }, [authUser]);
  // A estante só liga com os dados do aparelho já na conta da sessão (troca de conta terminada).
  useEffect(() => connectShelf(dataIsReady ? authSession : null, shelfOn), [authSession, shelfOn, dataIsReady]);
  /** Sequência quebrada ao abrir o app: salva com diamantes ou a oferta para salvar. */
  const [freezeOutcome, setFreezeOutcome] = useState<FreezeOutcome | null>(null);
  const [freezeBusy, setFreezeBusy] = useState(false);
  /** Roleta diária aberta (sozinha na primeira visita do dia, se ainda não girou). */
  const [spinOpen, setSpinOpen] = useState(false);
  const [communityBooks, setCommunityBooks] = useState<Ebook[]>([]);
  const [communityTick, setCommunityTick] = useState(0);
  /** Novidades do catálogo público (a biblioteca completa fica em /biblioteca). */
  const [catalogNew, setCatalogNew] = useState<Ebook[]>([]);
  /** Aberto pelo perfil numa marcação: o livro abre direto nesse trecho. */
  const openAtRef = useRef<{ bookId: string; chapterIndex: number; chapterLabel: string; paragraph: number } | null>(null);

  /** Chegou pelo link "esqueci minha senha": mostra a tela de senha nova. */
  const [passwordReset, setPasswordReset] = useState(false);
  /** Link de recuperação da API própria (token sem sessão). */
  const [resetToken, setResetToken] = useState<string | null>(null);

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
            if ("resetToken" in redirect) {
              setResetToken(redirect.resetToken);
            } else {
              setAuthSession(redirect.session);
              if (redirect.type === "recovery") setPasswordReset(true);
              else if (redirect.type === "signup") {
                setAuthNotice({ text: "E-mail confirmado. Boas-vindas ao Storyverse!", ok: true });
              }
            }
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
    let alive = true;
    const onOnline = () => setRefreshRetry((n) => n + 1);
    const timer = window.setTimeout(() => {
      void refreshAuthSession()
        .then((session) => { if (alive) setAuthSession(session); })
        .catch((err: unknown) => {
          if (!alive) return;
          if (err instanceof AuthSessionError) {
            // Cookie inválido/expirado ou sessão encerrada: não há access token novo.
            setAuthSession(null);
            setAuthNotice({ text: "Sua sessão expirou. Entre novamente." });
            return;
          }
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
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, [authSession, refreshRetry]);

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key !== AUTH_SESSION_STORAGE_KEY) return;
      if (!event.newValue) {
        setAuthSession(null);
        return;
      }
      // O cookie HttpOnly é compartilhado entre abas; força uma renovação para esta aba.
      void refreshAuthSession(true)
        .then((next) => setAuthSession(next))
        .catch((err: unknown) => setAuthSession(err instanceof AuthSessionError ? null : storedAuthSession()));
    }
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const authUserId = authSession?.user.id;

  /**
   * Cada conta com os próprios dados de leitura neste aparelho: ao trocar de conta (ou sair), troca
   * antes de desenhar a tela, para não aparecer nada da conta anterior nem por um instante.
   */
  const [dataEpoch, setDataEpoch] = useState(0);
  // Cor do app da conta: ao entrar, trocar de conta ou chegar do outro aparelho.
  useEffect(() => {
    if (dataIsReady) applyAppTheme();
  }, [dataIsReady, dataEpoch]);
  const onlineCount = usePresenceCount(authEnabled ? "app" : null, authUserId);
  const bookRoomId = book?.id;
  const readingHere = usePresenceCount(authEnabled && bookRoomId ? `book:${bookRoomId}` : null, authUserId);
  useLayoutEffect(() => {
    if (!authEnabled || authLoading) return;
    let alive = true;
    setReadyOwner(null);
    readerGeneration.current++;
    setOwnerError(null);
    setBook(null);
    setThreads({});
    void activateDataOwner(authUserId ?? "anon").then((changed) => {
      if (!alive) return;
      setReadyOwner(authUserId ?? "anon");
      if (changed) {
        setPrefs(loadPrefs());
        setDataEpoch((n) => n + 1);
      }
    }).catch(() => {
      if (alive) setOwnerError("Não foi possível abrir os dados desta conta. Libere espaço no navegador e recarregue a página.");
    });
    return () => {
      alive = false;
    };
  }, [authUserId, authLoading]);

  /**
   * Nuvem: a mesma conta na Web e no app instalado. Ao entrar (depois da troca de dono acima),
   * ao voltar para o app e de tempos em tempos, junta os dados da conta com os do aparelho, envia
   * e baixa os livros importados e atualiza o perfil.
   */
  const syncAccount = useCallback(async (session: SupabaseSession, opts: { keepalive: boolean; resume: boolean }) => {
    let changed = await syncNow(session, { keepalive: opts.keepalive });
    // A conta pode ter trocado durante o await: não mistura os dados locais de uma com a sessão da outra.
    if (currentDataOwner() !== session.user.id) return false;
    // Minutos da semana para o ranking (sem o ranking configurado no Supabase, segue sem ele).
    const reported = await reportReading(session, { keepalive: opts.keepalive }).catch(() => false);
    if (opts.keepalive) return changed;
    if (currentDataOwner() !== session.user.id) return false;
    // Leitura do dia que rende diamantes: pede a recompensa e avisa.
    if (reported) {
      const gained = await claimReadingRewards(session).catch(() => 0);
      if (gained > 0) setToast(`+${gained} 💎 pela leitura de hoje`);
    }
    const books = await syncBooks(session).catch(() => ({ local: false, library: false }));
    // A lista da conta mudou (livro enviado ou removido): manda já para os outros aparelhos.
    if (books.library) changed = (await syncNow(session).catch(() => false)) || changed;
    if (opts.resume) {
      void refreshProfile(session)
        .then((next) => next !== session && authSessionRef.current?.user.id === next.user.id && setAuthSession(next))
        .catch(() => {});
    }
    return changed || books.local;
  }, []);
  const applyRemoteData = useCallback(() => {
    setPrefs(loadPrefs());
    // A tela inicial é redesenhada com os dados novos: sem pular para o topo.
    const y = window.scrollY;
    setDataEpoch((n) => n + 1);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, []);
  useEffect(() => {
    if (!authEnabled || authLoading) return;
    const session = authSessionRef.current;
    if (!session) return;
    let alive = true;
    void dataOwnerReady()
      .then(() => {
        if (!alive) return false;
        return syncAccount(session, { keepalive: false, resume: true });
      })
      .then(async (changed) => {
        if (!alive) return;
        if (changed) applyRemoteData();
        const outcome = await checkStreakFreeze(session).catch(() => null);
        if (!alive) return;
        if (outcome) {
          setFreezeOutcome(outcome);
          if (outcome.kind === "saved") setDataEpoch((n) => n + 1);
        }
        const spin = await fetchSpinStatus(session).catch(() => null);
        if (alive && spin && !spin.spun_today && takeSpinOffer(dayKey())) setSpinOpen(true);
      })
      .catch(() => {
        // Sem a tabela ou sem internet: segue só com os dados do aparelho.
      });
    return () => {
      alive = false;
    };
  }, [authUserId, authLoading, syncAccount, applyRemoteData]);
  useEffect(
    () => (authEnabled ? startAutoSync(() => authSessionRef.current, syncAccount, applyRemoteData) : undefined),
    [syncAccount, applyRemoteData],
  );

  /** Sessão atual para o carregamento do texto (sem recarregar o livro quando o token renova). */
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;

  const { confirm: confirmApp, dialog: appConfirmDialog } = useConfirm();

  /** "Sair da conta" do menu ⋯: mesma confirmação dos Ajustes e da tela de assinatura. */
  async function askLogout() {
    if (
      await confirmApp({
        title: "Sair da conta?",
        message: "Você precisará entrar de novo para continuar lendo neste aparelho.",
        confirmLabel: "Sair",
        danger: true,
      })
    ) {
      void logout();
    }
  }

  async function logout() {
    if (!authSession || authActionLoading) return;
    setAuthActionLoading(true);
    setAuthNotice(null);
    setSanctionNotice(null);
    try {
      // Antes de sair, guarda na nuvem o que ainda não foi enviado.
      await syncNow(authSession).catch(() => {});
      // Este aparelho para de receber as notificações da conta que saiu.
      await disablePush(authSession).catch(() => {});
      await signOut(authSession);
    } catch (err) {
      setAuthNotice({ text: err instanceof Error ? `Sessão encerrada neste dispositivo. ${err.message}` : "Sessão encerrada neste dispositivo." });
    } finally {
      setAuthSession(null);
      setAuthActionLoading(false);
      setProfileOpen(false);
    }
  }

  const [fullText, setFullText] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  /** Para que lado o capítulo novo entra: avançando vem da direita, voltando vem da esquerda. */
  const shownChapterRef = useRef(chapterIndex);
  const chapterDirRef = useRef<"next" | "prev">("next");
  if (shownChapterRef.current !== chapterIndex) {
    chapterDirRef.current = chapterIndex > shownChapterRef.current ? "next" : "prev";
    shownChapterRef.current = chapterIndex;
  }
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
  const [extraMessagesLeft, setExtraMessagesLeft] = useState(extraMessages);
  useEffect(() => {
    if (!authEnabled || !authSession) return;
    let alive = true;
    void refreshAiQuota().then(() => {
      if (!alive) return;
      setMessagesLeft(messagesLeftToday());
      setExtraMessagesLeft(extraMessages());
    });
    return () => {
      alive = false;
    };
  }, [authSession]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  /** Conquistas novas na fila do aviso (uma por vez). */
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const noticeAchievements = useCallback(() => {
    const now = currentAchievements();
    const fresh = takeNewAchievements(now, userStorage);
    // Conquista nova: atualiza a vitrine do perfil público (só manda se mudou).
    const owner = storedAuthSession()?.user.id;
    if (fresh.length > 0 && owner) {
      const totals = readingTotals();
      void publishShowcase(owner, now, {
        totalMinutes: totals.totalMinutes,
        bestStreak: totals.bestStreak,
        finishedBooks: finishedBooks().length,
        messagesSent: characterTalks().reduce((n, t) => n + t.sent, 0),
      });
    }
    // Várias de uma vez é dado chegando de outro aparelho (já avisado lá): só registra.
    if (fresh.length > 0 && fresh.length <= 2) setAchievementQueue((q) => [...q, ...fresh]);
  }, []);
  const nextAchievement = useCallback(() => setAchievementQueue((q) => q.slice(1)), []);
  /** Meta do dia batida durante a leitura: a barra do topo brilha (a chave recomeça a animação). */
  const [goalFlash, setGoalFlash] = useState<number | null>(null);
  useEffect(() => {
    if (goalFlash === null) return;
    const t = window.setTimeout(() => setGoalFlash(null), 3600);
    return () => window.clearTimeout(t);
  }, [goalFlash]);
  /** Fechou o livro: a fita do marcador desce na página inicial, mostrando que o ponto ficou guardado. */
  const [bookmarkDrop, setBookmarkDrop] = useState<{ id: number; label: string } | null>(null);
  useEffect(() => {
    if (!bookmarkDrop) return;
    const t = window.setTimeout(() => setBookmarkDrop(null), 2800);
    return () => window.clearTimeout(t);
  }, [bookmarkDrop]);
  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => setCelebration(null), celebration.book ? 6500 : 4200);
    return () => window.clearTimeout(t);
  }, [celebration]);
  /** Semana do ranking fechada: parabéns para quem ficou no pódio (uma vez só, ao abrir o app). */
  useEffect(() => {
    if (!authEnabled || !authSession) return;
    let alive = true;
    const session = authSession;
    // Depois da sincronização de abertura, que envia os minutos do fim da semana.
    const t = window.setTimeout(() => {
      void takeWeeklyAwards(session)
        .then((awards) => {
          const last = awards[awards.length - 1];
          if (!alive || !last) return;
          const total = awards.reduce((sum, a) => sum + a.diamonds, 0);
          setCelebration({
            emoji: PLACE_MEDALS[last.place],
            title: `Você ficou em ${last.place}º lugar no ranking da semana!`,
            text: `${formatMinutes(last.minutes)} de leitura. Você ganhou ${total} 💎. Parabéns!`,
          });
        })
        .catch(() => {
          // Sem o ranking no Supabase ou sem internet: tenta de novo na próxima abertura.
        });
    }, 3000);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // Só quando troca de usuário (não a cada renovação do token).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);
  /** Ao abrir o app: escudos salvam a sequência de ontem, se preciso (aviso uma vez por dia). */
  const [shieldNotice, setShieldNotice] = useState<number | null>(shieldNoticeOnLoad);
  /** Capítulos já comemorados nesta visita (para não repetir a cada rolagem). */
  const finishedChaptersRef = useRef(new Set<string>());
  /** Aviso curto no rodapé da tela ("Imagem salva", "Trecho destacado"). */
  const [toast, setToast] = useState<string | null>(null);
  /**
   * Fim de capítulo: cartão no rodapé do próprio capítulo (onde o leitor está olhando), com o
   * progresso do livro. Some sozinho ao trocar de capítulo (a chave deixa de bater).
   */
  const [chapterDone, setChapterDone] = useState<{ key: string; label: string; done: number; total: number } | null>(null);
  /** O personagem "ouviu": o avatar do topo do chat pula; quando ele reage à mensagem, solta o emoji. */
  const [chatReaction, setChatReaction] = useState<{ id: string; emoji: string | null } | null>(null);
  const chatAvatarRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!chatReaction || prefersReducedMotion()) return;
    chatAvatarRef.current?.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-7px) scale(1.06)" }, { transform: "translateY(0)" }],
      { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }, [chatReaction]);
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
  /** Conta as palavras na tela para as páginas lidas (definida junto dos parágrafos, mais abaixo). */
  const countVisibleWordsRef = useRef<() => void>(() => {});
  const scrollIdleRef = useRef<number | undefined>(undefined);

  const [prefs, setPrefs] = useState(loadPrefs);
  /** Ajustes de leitura no celular: fonte, tema, luz noturna e tela cheia. */
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  /** Fallback de tela cheia para navegadores sem Fullscreen API (iOS). */
  const [immersive, setImmersive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  /** Redesenha a página inicial quando um livro importado é removido (sai de "Continue lendo"). */
  const [homeTick, setHomeTick] = useState(0);
  /** Página inicial: estantes entram ao aparecer na tela; a barra do topo encolhe ao rolar. */
  const homeRef = useRef<HTMLDivElement>(null);
  useEffect(() => installCoverTilt(), []);
  useReveal(homeRef, ".shelf, .steps", [book, dataEpoch, canRead, homeTick, communityBooks.length, catalogNew.length]);
  const [navScrolled, setNavScrolled] = useState(false);
  const [navRef, navFit] = useNavCrowded();
  useEffect(() => {
    if (book) return;
    // Margem entre ligar e desligar: perto do limite a barra não fica alternando.
    const onScroll = () => setNavScrolled((on) => (on ? window.scrollY > 8 : window.scrollY > 40));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [book]);
  /** Ids da comunidade aprovados agora (`null`: lista ainda não veio ou falhou — não esconde nada). */
  const [communityIds, setCommunityIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!authEnabled || book) return;
    let alive = true;
    void approvedCommunityBooks(authSessionRef.current)
      .then((list) => {
        if (!alive) return;
        setCommunityBooks(list);
        setCommunityIds(new Set(list.map((b) => b.id)));
      })
      .catch(() => {
        if (!alive) return;
        setCommunityBooks([]);
        setCommunityIds(null);
      });
    return () => {
      alive = false;
    };
  }, [book, authUserId, communityTick]);
  /** Novidades da biblioteca pública: metadados abertos, sem sessão. */
  useEffect(() => {
    if (book) return;
    let alive = true;
    // O catálogo também lista os envios da comunidade (cm:), que já têm a estante "Da comunidade";
    // aqui ficam só os curados. Pede mais que 6 para sobrar curado depois do filtro.
    void searchCatalog({ sort: "new", limit: 30 })
      .then((page) => {
        if (!alive) return;
        setCatalogNew(
          page.items
            .filter((item) => item.book_key.startsWith("cat:"))
            .slice(0, CATALOG_NEW_LIMIT)
            .map(catalogBookToEbook),
        );
      })
      .catch(() => {
        if (alive) setCatalogNew([]);
      });
    return () => {
      alive = false;
    };
  }, [book, homeTick]);
  /** Livros importados que estão neste aparelho (`null`: ainda lendo do navegador). */
  const [localIds, setLocalIds] = useState<Set<number> | null>(null);
  const [localBookList, setLocalBookList] = useState<Ebook[]>([]);
  useEffect(() => {
    // O livro aberto agora existe: ao voltar para o início ele não some nem por um instante.
    if (book && isLocalBook(book)) setLocalIds((prev) => (prev?.has(book.gutenbergId) ? prev : new Set([...(prev ?? []), book.gutenbergId])));
    if (book) return;
    let alive = true;
    void listLocalBooks()
      .then((list) => {
        if (!alive) return;
        setLocalIds(new Set(list.map((b) => b.gutenbergId)));
        setLocalBookList(list);
      })
      .catch(() => alive && setLocalIds(new Set()));
    return () => {
      alive = false;
    };
  }, [book, authUserId, dataEpoch, homeTick]);
  const isAvailable = useCallback(
    (b: Ebook) => bookAvailable(b, { localIds, communityIds }),
    [localIds, communityIds],
  );
  /** Estante: o livro da entrada ainda abre aqui? (mesma regra de bookAvailable, pela chave) */
  const shelfAvailable = useCallback(
    (bookKey: string) => {
      if (bookKey.startsWith("local:")) return localIds?.has(Number(bookKey.slice(6))) ?? false;
      if (bookKey.startsWith("cm:")) return communityIds?.has(`cm-${bookKey.slice(3)}`) ?? true;
      return true;
    },
    [localIds, communityIds],
  );
  /** Estante: o Ebook completo da entrada (os conhecidos aqui ou um do Gutenberg montado da entrada). */
  const shelfBookFor = useCallback(
    (entry: LocalShelfEntry): Ebook => {
      const known = [
        ...localBookList,
        ...communityBooks,
        ...recentProgress().map((p) => p.book),
        ...finishedBooks().map((f) => f.book),
      ].find((b) => bookKeyOf(b) === entry.bookKey);
      if (known) return known;
      if (entry.bookKey.startsWith("cat:")) {
        const uuid = entry.bookKey.slice(4);
        return {
          id: `cat-${uuid}`,
          gutenbergId: catalogNumericId(entry.bookKey),
          title: entry.title,
          author: entry.author ?? "",
          genre: entry.genre ?? undefined,
          coverUrl: entry.coverUrl ?? undefined,
          textLanguage: entry.language ?? "pt",
          source: "catalog",
          catalogKey: entry.bookKey,
        };
      }
      const id = entry.bookKey.slice(entry.bookKey.indexOf(":") + 1);
      return {
        id: entry.bookKey.replace(":", "-"),
        gutenbergId: Number(id) || 0,
        title: entry.title,
        author: entry.author ?? "",
        genre: entry.genre ?? undefined,
        coverUrl: entry.coverUrl ?? undefined,
        textLanguage: entry.language ?? "pt",
        source: entry.source,
      };
    },
    [localBookList, communityBooks],
  );
  /** Nota/resenha do livro terminado: abre quando a comemoração some (toque ou timer). */
  const finishPrompt = useFinishPrompt(celebration !== null);
  const queueFinishPrompt = finishPrompt.queue;
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
  const { install, installed } = useAppInstall();
  /** Janela "Baixar app" (passo a passo quando o navegador não tem o botão de instalar). */
  const [installOpen, setInstallOpen] = useState(false);
  const [installBannerOff, setInstallBannerOff] = useState(installBannerHidden);
  /** U6: o convite espera a pessoa abrir um livro ou voltar outro dia (conta esta visita uma vez). */
  const [installNudgeOn, setInstallNudgeOn] = useState(() => {
    noteVisit();
    return installNudgeReady();
  });
  const installBannerShown = !installed && !installBannerOff && installNudgeOn;
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
    const recent = recentProgress().find((p) => isAvailable(p.book));
    // O recado sai na voz do personagem; quem decide se já é hora de avisar é o service worker.
    const voice = recent ? voiceFor(recent.book) : undefined;
    void syncEngagementState({
      streak: readingSummary().streak,
      lastReadDay: lastReadDay(),
      book: recent
        ? {
            title: recent.book.title,
            chapterLabel: recent.chapterLabel,
            character: voice?.name ?? lastCharacter(recent.book.id),
            nudge: voice ? nudgeText(recent.book, voice, recent.chapterLabel, NUDGE_AFTER_DAYS) : undefined,
          }
        : undefined,
    });
  }, [book, isAvailable]);
  useEffect(() => {
    try {
      userStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preferência só não fica salva.
    }
  }, [prefs]);

  const readRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  /**
   * Capítulo a que a rolagem medida pertence. Fica vazio ao trocar de capítulo até o novo ser
   * posicionado: antes disso a rolagem ainda é a do capítulo anterior (e, terminado o 2, o 3
   * seria dado como concluído).
   */
  const ratioKeyRef = useRef<string | null>(null);
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

    (isLocalBook(book)
      ? loadLocalBookText(book.gutenbergId)
      : book.source === "community" && (book.communityPath || communityIdOf(book))
        ? // A chave pelo caminho preserva as cópias offline gravadas antes do S9.
          withOfflineCopy(`community:${book.communityPath ?? communityIdOf(book)}`, () =>
            fetchCommunityBookText(authSessionRef.current, book),
          )
        : book.source === "catalog" && book.catalogKey
          ? withOfflineCopy(`catalog:${book.catalogKey}`, () =>
              fetchCatalogBookText(authSessionRef.current, book.catalogKey!),
            )
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
          if (awayDays >= NUDGE_AFTER_DAYS && awayChapter && activeId) {
            // O mesmo recado da tela inicial, de quem o mandou (sem ele, a saudade genérica).
            const voice = voiceFor(book);
            const from = list.find((c) => c.id === voice?.id || c.name === voice?.name)?.id ?? activeId;
            const line = voice ? nudgeText(book, voice, awayChapter, awayDays) : missYouMessage(awayChapter, awayDays);
            setThreads((prev) => ({
              ...prev,
              // Uma saudade só: se a anterior ficou sem resposta, a nova toma o lugar dela.
              [from]: tidyAmbientMessages([...(prev[from] ?? []), { id: uid(), role: "assistant", text: line }]),
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
    // Páginas lidas: conta o que está na tela quando a rolagem para por 1 s.
    window.clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = window.setTimeout(() => countVisibleWordsRef.current(), 1000);
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

  /** Abre o livro; `opts` abre direto a conversa com um personagem (ex.: responder o recado dele). */
  const startBook = useCallback((b: Ebook, opts?: { characterId?: string; chat?: boolean }) => {
    if (authLoading) return;
    if (!canRead) {
      setAuthModal("login");
      return;
    }
    // O texto do catálogo exige sessão mesmo quando o login é opcional para o resto do app.
    if (b.source === "catalog" && !authUser) {
      setAuthModal("login");
      return;
    }
    recordOpened(b);
    noteBookOpened();
    setInstallNudgeOn(true);
    readerGeneration.current++;
    openBookWithTransition(() => {
      setBook(b);
      setLoading(false);
      setCast(null);
      setActiveCharId(opts?.characterId ?? "");
      setThreads({});
      setError(null);
      setInput("");
      setChatOpen(opts?.chat ?? false);
      window.scrollTo({ top: 0 });
    });
  }, [authLoading, authUser, canRead]);

  /**
   * Link direto para um livro da biblioteca (`/?abrir=cat:<uuid>`). Se a pessoa ainda não entrou,
   * abre o login e tenta de novo quando a sessão chegar; o parâmetro fica na URL até abrir.
   */
  const openedFromUrlRef = useRef(false);
  useEffect(() => {
    if (openedFromUrlRef.current || authLoading) return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get("abrir");
    if (!key || !/^cat:[0-9a-fA-F-]{36}$/.test(key)) return;
    if (!canRead || !authUser) {
      setAuthModal("login");
      return;
    }
    openedFromUrlRef.current = true;
    const chat = params.get("chat") === "1";
    getCatalogBook(key)
      .then((loaded) => {
        window.history.replaceState({}, "", window.location.pathname);
        startBook(catalogBookToEbook(loaded));
        if (chat) setChatOpen(true);
      })
      .catch((err: unknown) => {
        openedFromUrlRef.current = false;
        setAuthNotice({
          text: err instanceof Error ? err.message : "Não foi possível abrir o livro.",
        });
      });
  }, [authLoading, authUser, canRead, startBook]);

  /**
   * Recarregou com o livro aberto (`?ler=`): abre o mesmo livro quando a conta estiver pronta.
   * Lido no primeiro desenho, antes de o efeito abaixo apagar a cópia guardada do livro.
   */
  const [reopen, setReopen] = useState(takeReaderParam);
  useEffect(() => rememberOpenBook(book), [book]);
  useEffect(() => {
    if (!reopen || authLoading || !dataIsReady) return;
    setReopen(null);
    if (!canRead) return;
    const found =
      reopen.book ??
      recentProgress().find((p) => p.book.id === reopen.id)?.book ??
      [...featuredBooks, ...communityBooks].find((b) => b.id === reopen.id);
    if (found) startBook(found);
  }, [reopen, authLoading, dataIsReady, canRead, communityBooks, startBook]);

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

  /** Livro aberto e já carregado: ao sair, a fita do marcador lembra que o ponto ficou guardado. */
  const leavingTitleRef = useRef<string | null>(null);
  const leaveBook = useCallback(() => {
    readerGeneration.current++;
    if (leavingTitleRef.current) setBookmarkDrop({ id: Date.now(), label: leavingTitleRef.current });
    stopSpeaking();
    setHighlightsOpen(false);
    setReaderSettingsOpen(false);
    setImmersive(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setSelection(null);
    setWordCard(null);
    setBook(null);
    setLoading(false);
    setCast(null);
    setActiveCharId("");
    setThreads({});
    setError(null);
    setInput("");
    setFullText("");
    setChapterIndex(0);
    setLoadState("idle");
    setLoadError(null);
    setChatOpen(false);
  }, [stopSpeaking]);

  const toggleReadingFullscreen = useCallback(async () => {
    setReaderSettingsOpen(false);
    if (immersive) {
      setImmersive(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setImmersive(true);
      }
    } catch {
      // iOS/Safari pode negar a Fullscreen API; usa o modo imersivo.
      setImmersive(true);
    }
  }, [immersive]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const characters = useMemo(() => cast ?? [], [cast]);
  const character = useMemo(
    () => characters.find((c) => c.id === activeCharId) ?? characters[0],
    [activeCharId, characters],
  );

  const messages = character ? (threads[character.id] ?? EMPTY_THREAD) : EMPTY_THREAD;

  /** Guarda a conversa do livro para continuar na próxima vez. */
  useEffect(() => {
    if (!book || !cast || Object.keys(threads).length === 0) return;
    const owner = currentDataOwner();
    const t = window.setTimeout(() => saveChat(book.id, threads, activeCharId, owner), 400);
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

  /** Avisa da sequência de dias e da meta do dia batidas durante a leitura. */
  const celebrate = useCallback(
    (ev: ReadingEvents) => {
      noticeAchievements();
      if (ev.dayCompleted) {
        const n = ev.streak;
        const milestone = [3, 7, 14, 30, 50, 100, 365].includes(n);
        setCelebration({
          emoji: "🔥",
          title: n === 1 ? "Sequência começou!" : `${n} dias seguidos!`,
          roll: n > 1 ? { from: n - 1, to: n, suffix: "dias seguidos!" } : undefined,
          text: ev.shieldEarned
            ? "Você ganhou um escudo 🛡️: se um dia passar sem leitura, ele salva a sua sequência."
            : milestone
              ? "Que marca! Os personagens estão orgulhosos."
              : n === 1
                ? "Volte amanhã para manter o fogo aceso."
                : "Continue assim — volte amanhã para manter a sequência.",
        });
      } else if (ev.goalReached) {
        // Sem janela por cima do texto: a barra do topo brilha e um aviso pequeno some sozinho.
        haptic([20, 40, 20]);
        setGoalFlash(Date.now());
      }
    },
    [noticeAchievements],
  );

  /** Tempo de leitura (para a sequência de dias e a meta): conta de 15 em 15 s com o leitor ativo. */
  useEffect(() => {
    if (!book || loadState !== "ready") return;
    const TICK = 15;
    const session = authSessionRef.current;
    if (session) void readingHeartbeat(session, true).catch(() => {});
    const t = window.setInterval(() => {
      const active = Date.now() - lastActivityRef.current < 120_000 || speechRef.current !== null;
      const reading = document.visibilityState === "visible" && active;
      if (reading) {
        celebrate(addReadingSeconds(TICK));
        countVisibleWordsRef.current();
      }
      if (session && authSessionRef.current?.user.id === session.user.id)
        void readingHeartbeat(authSessionRef.current, reading).catch(() => {});
    }, TICK * 1000);
    return () => {
      window.clearInterval(t);
      if (session) void readingHeartbeat(session, false).catch(() => {});
    };
  }, [book, loadState, celebrate]);

  // Conquista nova ao conversar, marcar um trecho ou ao abrir o app com os dados prontos.
  useEffect(() => {
    if (dataIsReady) noticeAchievements();
  }, [dataIsReady, threads, highlights, noticeAchievements]);

  /** Trocou de personagem no chat: o retrato do topo gira como uma moeda. */
  const flippedForRef = useRef<string | null>(null);
  useEffect(() => {
    const id = character?.id ?? null;
    const before = flippedForRef.current;
    flippedForRef.current = id;
    if (!id || !before || before === id || prefersReducedMotion()) return;
    chatAvatarRef.current?.animate(
      [{ transform: "perspective(400px) rotateY(0)" }, { transform: "perspective(400px) rotateY(180deg) scale(0.9)" }, { transform: "perspective(400px) rotateY(360deg)" }],
      { duration: 520, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
    );
  }, [character?.id]);

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

  const chapters = useMemo(() => (fullText ? splitIntoChapters(fullText) : []), [fullText]);
  const currentChapter = chapters[chapterIndex] ?? chapters[0];
  leavingTitleRef.current = book && loadState === "ready" ? book.title : null;

  useEffect(() => {
    ratioKeyRef.current = null;
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
      ratioKeyRef.current = chapterKeyRef.current;
      onReadScroll();
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterIndex, loadState, onReadScroll]);

  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter) return;
    if (restoreScrollRef.current !== null) return; // Ainda não voltou para a posição salva.
    // Abrir e fechar um livro sem ler nada não o coloca em “Continue lendo”.
    if (chapterIndex === 0 && scrollRatio < 0.02 && !loadProgress(book.gutenbergId)) return;
    const owner = currentDataOwner();
    const t = setTimeout(() => {
      saveProgress(
        {
          book,
          chapterIndex,
          chapterLabel: currentChapter.label,
          chapterCount: chapters.length,
          scrollRatio,
        },
        owner,
      );
      if (owner === currentDataOwner()) {
        recordProgress(book, ((chapterIndex + scrollRatio) / Math.max(1, chapters.length)) * 100, currentChapter.label);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [book, loadState, chapterIndex, currentChapter, chapters.length, scrollRatio]);

  /** Chegou ao fim do capítulo: aviso rápido; no último capítulo, comemoração de livro terminado. */
  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter || scrollRatio < 0.97) return;
    const key = `${book.gutenbergId}:${chapterIndex}`;
    if (ratioKeyRef.current !== key) return; // Rolagem ainda é a do capítulo anterior.
    if (finishedChaptersRef.current.has(key)) return;
    // Capítulo curtíssimo cabe na tela inteira: ainda não foi "lido".
    const el = readRef.current;
    if (!el || el.scrollHeight < el.clientHeight * 1.5) return;
    finishedChaptersRef.current.add(key);
    if (chapterIndex >= chapters.length - 1) {
      markBookFinished(book);
      recordFinished(book);
      if (shelfEnabled()) queueFinishPrompt(book);
      setCelebration({
        emoji: "🏆",
        title: `Você terminou “${book.title}”!`,
        text: "Que jornada. Conte para os personagens o que achou do final.",
        book,
      });
    } else {
      setChapterDone({ key, label: currentChapter.label, done: chapterIndex + 1, total: chapters.length });
      haptic(20);
    }
  }, [book, loadState, currentChapter, scrollRatio, chapterIndex, chapters.length, queueFinishPrompt]);

  const displayedStory = currentChapter?.body ?? "";

  /** Buscar no livro: palavra ou nome em todos os capítulos, com o trecho e o salto até lá. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredTerm = useDeferredValue(searchTerm);
  const bookBlocks = useMemo(
    () => (searchOpen ? chapters.map((ch) => toBlocks(ch.body, ch.label)) : []),
    [searchOpen, chapters],
  );
  const searchResults = useMemo(() => searchBook(bookBlocks, chapters, deferredTerm), [bookBlocks, chapters, deferredTerm]);
  function openSearchResult(r: BookSearchHit) {
    setSearchOpen(false);
    if (r.chapterIndex === chapterIndex) {
      requestAnimationFrame(() => scrollToBlock(r.paragraph));
    } else {
      jumpToBlockRef.current = r.paragraph;
      setChapterIndex(r.chapterIndex);
    }
  }

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

  /**
   * Páginas lidas (1 página = 250 palavras; a regra completa está em readingPages.ts): soma os
   * parágrafos que estão pelo menos pela metade na tela, ou que ocupam metade dela.
   */
  useEffect(() => {
    countVisibleWordsRef.current = () => {
      const el = readRef.current;
      if (!el || !book || loadState !== "ready" || document.visibilityState !== "visible") return;
      // Capítulo ainda não posicionado: a tela ainda é a do anterior.
      if (ratioKeyRef.current !== `${book.gutenbergId}:${chapterIndex}`) return;
      const view = el.getBoundingClientRect();
      const seen: SeenBlock[] = [];
      for (const node of el.querySelectorAll<HTMLElement>("[data-block]")) {
        const r = node.getBoundingClientRect();
        const shown = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
        if (shown <= 0 || (shown < r.height / 2 && shown < view.height / 2)) continue;
        const i = Number(node.dataset.block);
        const b = blocks[i];
        if (b && b.kind !== "image") seen.push({ key: `${book.gutenbergId}:${chapterIndex}:${i}`, words: countWords(b.text) });
      }
      addSeenBlocks(seen);
    };
  }, [book, loadState, chapterIndex, blocks]);
  useEffect(() => () => window.clearTimeout(scrollIdleRef.current), []);

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
  // Livros locais/importados podem ser privados: o tradutor remoto só roda com consentimento.
  const [translateConsent, setTranslateConsent] = useState(() => hasRemoteTranslationConsent());
  const remoteTranslationNeedsConsent =
    book?.source === "local" && engine !== "local" && !translateConsent;
  const translateOn = canTranslate && prefs.translate && !remoteTranslationNeedsConsent;
  const chunks = useMemo(() => chunkRanges(blocks.map((b) => b.text)), [blocks]);
  /** Traduções do capítulo; `chunks` diz para quais trechos o guardado no aparelho já foi carregado. */
  const [translated, setTranslated] = useState<{
    key: string;
    chunks: [number, number][] | null;
    byChunk: Record<number, (string | null)[]>;
  }>({ key: "", chunks: null, byChunk: {} });
  const translations = useMemo(
    () => (translated.key === chapterKey ? translated.byChunk : NO_TRANSLATIONS),
    [translated, chapterKey],
  );
  const [translatingChunk, setTranslatingChunk] = useState<number | null>(null);
  const [failedChunks, setFailedChunks] = useState<number[]>([]);

  async function toggleTranslation() {
    const active = prefs.translate && !remoteTranslationNeedsConsent;
    if (active) {
      setPrefs((p) => ({ ...p, translate: false }));
      return;
    }
    const detected = await detectTranslationEngine();
    if (detected !== "local" && book?.source === "local" && !hasRemoteTranslationConsent()) {
      const ok = window.confirm(
        "Para traduzir este livro local, trechos do texto serão enviados ao Google Tradutor/MyMemory. " +
          "Se o livro for privado, cancele e use o tradutor do próprio navegador quando disponível. Continuar?",
      );
      if (!ok) {
        setPrefs((p) => ({ ...p, translate: false }));
        return;
      }
      grantRemoteTranslationConsent();
    }
    if (detected === "local") {
      warmUpLocalTranslator();
      setEngine("local");
      setTranslateConsent(true);
    } else if (hasRemoteTranslationConsent()) {
      setTranslateConsent(true);
    }
    setPrefs((p) => ({ ...p, translate: true }));
  }

  /** Troca de capítulo: começa com o que já foi traduzido antes e está guardado. */
  useEffect(() => {
    const cached: Record<number, (string | null)[]> = {};
    if (book && canTranslate) {
      chunks.forEach((_, c) => {
        const t = cachedTranslation(book.gutenbergId, chapterIndex, c);
        if (t) cached[c] = t;
      });
    }
    setTranslated({ key: chapterKeyRef.current, chunks, byChunk: cached });
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
      translateParagraphs(
        engine,
        blocks.slice(start, end).map((b) => (b.kind === "image" ? "" : b.text)),
        book.source !== "local" || translateConsent,
      )
        .then((result) => {
          storeTranslation(book.gutenbergId, chapterIndex, c, result);
          if (chapterKeyRef.current === key) {
            setTranslated((prev) => ({ ...prev, key, byChunk: { ...prev.byChunk, [c]: result } }));
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
    translateConsent,
    loadState,
    translatingChunk,
    visibleChunk,
    chunks,
    translated,
    translations,
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

  /** Vozes naturais (Piper) do idioma já baixadas (null = conferindo), a que está baixando e a que falhou. */
  const [storedNatural, setStoredNatural] = useState<string[] | null>(null);
  const [naturalDownload, setNaturalDownload] = useState<{ id: string; pct: number } | null>(null);
  const [naturalError, setNaturalError] = useState<string | null>(null);
  useEffect(() => {
    if (!voicePanelOpen || !naturalVoiceSupported()) return;
    let alive = true;
    setStoredNatural(null);
    void storedNaturalVoices(speakLang).then((ids) => {
      if (alive) setStoredNatural(ids);
    });
    return () => {
      alive = false;
    };
  }, [voicePanelOpen, speakLang]);
  const missingNatural = storedNatural ? naturalVoicesFor(speakLang).filter((v) => !storedNatural.includes(v.id)) : [];

  /** Começa a ler e, enquanto a voz natural não foi baixada (nem recusada), já mostra a oferta. */
  function listenAloud() {
    startSpeaking(firstVisibleBlock());
    if (!naturalVoiceSupported() || naturalOfferDismissed()) return;
    void storedNaturalVoices(speakLang).then((ids) => {
      if (ids.length === 0) setVoicePanelOpen(true);
    });
  }

  function declineNaturalVoice() {
    dismissNaturalOffer();
    setVoicePanelOpen(false);
  }

  async function getNaturalVoice(id: string) {
    const lang = speakLang;
    setNaturalDownload({ id, pct: 0 });
    setNaturalError(null);
    try {
      await downloadNaturalVoice(id, (pct) => setNaturalDownload({ id, pct }));
      setStoredNatural(await storedNaturalVoices(lang));
      setVoices(await listVoices(lang));
      chooseVoice(naturalVoiceUri(id));
    } catch (e) {
      console.warn("Falha ao baixar a voz natural:", e);
      setNaturalError(id);
    } finally {
      setNaturalDownload(null);
    }
  }

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

  /** Lê do começo com o texto mais recente na tela (não o do render em que o efeito foi marcado). */
  const continueSpeaking = useEffectEvent(() => startSpeaking(0));
  /**
   * A voz terminou um capítulo: quando o próximo estiver na tela, continua do começo. Com a
   * tradução ligada, espera as traduções guardadas do capítulo entrarem; senão a voz em português
   * começaria pelo texto original.
   */
  const chapterTextReady =
    loadState === "ready" && blocks.length > 0 && (!translateOn || translated.chunks === chunks);
  useEffect(() => {
    if (!continueSpeechRef.current || !chapterTextReady) return;
    const frame = requestAnimationFrame(() => {
      continueSpeechRef.current = false;
      continueSpeaking();
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterTextReady, blocks, translated.chunks]);

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
  const outOfMessages = limitApplies && messagesLeft + extraMessagesLeft <= 0;

  async function sendMessage(raw: string) {
    if (!book || !character || loadState !== "ready" || !displayedStory) return;
    const text = raw.trim();
    if (!text || loading) return;
    if (limitApplies && messagesLeftToday() + extraMessages() <= 0) {
      setMessagesLeft(0);
      setExtraMessagesLeft(0);
      return;
    }

    setError(null);
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text };
    setChatReaction({ id: userMsg.id, emoji: null });
    setThreads((prev) => ({
      ...prev,
      [character.id]: [...(prev[character.id] ?? []), userMsg],
    }));

    const prior = [...(threads[character.id] ?? []), userMsg];
    const history: ChatTurn[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    setLoading(true);
    const requestBook = book;
    const requestOwner = authSessionRef.current?.user.id;
    const generation = readerGeneration.current;
    const stillCurrent = () => readerGeneration.current === generation && currentBookRef.current === requestBook && authSessionRef.current?.user.id === requestOwner;
    try {
      const { text: reply, reaction } = await characterReply({
        character,
        history: history.slice(0, -1),
        userMessage: text,
        ebookTitle: book.title,
        ebookAuthor: book.author,
        textExcerpt,
        readingProgressPct,
        textLanguage: book.textLanguage,
        shelf: shelfContextFor(book),
      });
      if (!stillCurrent()) return;
      const botMsg: Msg = { id: uid(), role: "assistant", text: reply };
      if (limitApplies) {
        setMessagesLeft(countMessage());
        setExtraMessagesLeft(extraMessages());
      }
      // Achou a mensagem fofa ou engraçada: o emoji fica preso nela (e sobe do avatar).
      if (reaction) setChatReaction({ id: botMsg.id, emoji: reaction });
      setThreads((prev) => ({
        ...prev,
        [character.id]: [
          ...(prev[character.id] ?? []).map((m) => (m.id === userMsg.id && reaction ? { ...m, reaction } : m)),
          botMsg,
        ],
      }));
    } catch (err) {
      if (!stillCurrent()) return;
      console.warn("Falha no envio da mensagem:", err);
      if (err instanceof AuthNetworkError && err.code === "AI_QUOTA_EXHAUSTED") {
        setMessagesLeft(0);
        setExtraMessagesLeft(0);
      }
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
      if (stillCurrent()) setLoading(false);
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  // Botão voltar do celular: fecha o que estiver aberto por cima, na ordem em que foi aberto.
  useBackClose(Boolean(book), leaveBook, book ? readerUrl(book.id) : undefined);
  useBackClose(profileOpen, () => setProfileOpen(false));
  useBackClose(rankingOpen, () => setRankingOpen(false));
  useBackClose(libraryOpen, () => setLibraryOpen(false));
  useBackClose(shopOpen, () => setShopOpen(false));
  useBackClose(spinOpen, () => setSpinOpen(false));
  useBackClose(authModal !== null, () => setAuthModal(null));
  useBackClose(aboutOpen, () => setAboutOpen(false));
  useBackClose(installOpen, () => setInstallOpen(false));
  useBackClose(importRequest !== null, () => setImportRequest(null));
  useBackClose(chatOpen, () => setChatOpen(false));
  useBackClose(highlightsOpen, () => setHighlightsOpen(false));

  if (ownerError) return <main className="auth-loading" role="alert"><p>{ownerError}</p><button onClick={() => window.location.reload()}>Tentar novamente</button></main>;
  if (authLoading || !dataIsReady) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <img className="auth-loading-logo" src="/icons/logo.svg" alt="" aria-hidden="true" />
        <span className="spinner" aria-hidden="true" />
        <p>Abrindo o Storyverse…</p>
      </main>
    );
  }

  if (billingBlocked && subscription) {
    return <BillingBlocked status={subscription} onLogout={() => void logout()} />;
  }

  if (!book) {
    // Cópia do livro guardada no progresso pode estar velha (sem a capa achada depois): usa a
    // versão atual quando o livro é do acervo fixo ou da comunidade.
    const currentBook = new Map<string, Ebook>([...featuredBooks, ...communityBooks].map((b) => [b.id, b]));
    // Só livros que ainda dá para abrir: removido de "Seus livros" ou tirado do acervo sai daqui.
    const recent = recentProgress().filter((p) => isAvailable(p.book)).map((p) => {
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
    // Sumiu do livro há alguns dias: o personagem manda um recado (ver characterNudge.ts).
    const nudge = homeNudge(recent);
    const progressById = new Map(recent.map((p) => [p.book.gutenbergId, p]));
    if (shopOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <DiamondShopPage
            session={authSession}
            onClose={() => setShopOpen(false)}
            onStreakSaved={() => {
              setFreezeOutcome(null);
              setDataEpoch((n) => n + 1);
            }}
          />
        </Suspense>
      );
    }
    if (libraryOpen && authSession && shelfOn) {
      return (
        <LibraryPage
          onClose={() => setLibraryOpen(false)}
          onOpenBook={(b) => {
            setLibraryOpen(false);
            setProfileOpen(false);
            startBook(b);
          }}
          available={shelfAvailable}
          bookFor={shelfBookFor}
        />
      );
    }
    if (rankingOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <RankingPage session={authSession} onClose={() => setRankingOpen(false)} onOpenShop={() => setShopOpen(true)} />
        </Suspense>
      );
    }
    if (profileOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ProfilePage
            isStaff={staffOn}
            canModerate={canModerate}
            onOpenShop={() => setShopOpen(true)}
            onOpenShelf={shelfOn ? () => setLibraryOpen(true) : undefined}
            session={authSession}
            onSessionChange={setAuthSession}
            onClose={() => setProfileOpen(false)}
            onLogout={() => void logout()}
            onAccountDeleted={() => {
              const owner = authSession?.user.id;
              if (owner) {
                clearAccountStorage(owner);
                void deleteAllLocalRecords(owner).catch(() => {});
              }
              if (authSession) void signOut(authSession).catch(() => {});
              setAuthSession(null);
              setProfileOpen(false);
              setAuthNotice({ text: "Conta excluída.", ok: true });
            }}
            loggingOut={authActionLoading}
            onOpenBook={startBook}
            onOpenHighlight={(b, h) => {
              openAtRef.current = { bookId: b.id, chapterIndex: h.chapterIndex, chapterLabel: h.chapterLabel, paragraph: h.paragraph };
              startBook(b);
            }}
            prefs={prefs}
            setPrefs={setPrefs}
            lastBook={lastBook}
            isAvailable={isAvailable}
          />
        </Suspense>
      );
    }
    const heroBook = featuredBooks.find((b) => b.demo && b.characters?.length);
    const heroChar = heroBook?.characters?.[0];
    /** Já entrou e pode ler: sem a apresentação do app, direto para os livros. */
    const returning = Boolean(authUser) && canRead;
    return (
      <div className={`home ${returning ? "is-returning" : ""}`} key={dataEpoch} ref={homeRef}>
        {authModal ? (
          <AuthModal
            mode={authModal}
            onClose={() => setAuthModal(null)}
            onAuthenticated={(session) => {
              setAuthSession(session);
              setAuthNotice(null);
              setSanctionNotice(session.warning ? warningMessage(session.warning.reason) : null);
              setAuthModal(null);
            }}
          />
        ) : null}
        {resetToken ? (
          <NewPasswordModal
            token={resetToken}
            onDone={(message) => {
              setResetToken(null);
              setAuthNotice({ text: message, ok: true });
              if (!authSession) setAuthModal("login");
            }}
            onCancel={() => {
              setResetToken(null);
              setAuthNotice(null);
              setAuthModal("login");
            }}
          />
        ) : passwordReset && authSession ? (
          <NewPasswordModal
            session={authSession}
            onDone={(message) => {
              setPasswordReset(false);
              setAuthNotice({ text: message, ok: true });
            }}
            onCancel={() => setPasswordReset(false)}
          />
        ) : null}
        <nav ref={navRef} className={`home-nav home-nav-main ${navScrolled ? "is-scrolled" : ""} ${navFit !== "full" ? "is-crowded" : "is-crowded"}`}>
          <span className="wordmark">
            <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
            <span className="wordmark-text">Storyverse</span>
          </span>
          <div className="home-nav-actions">
            {authUser && onlineCount !== null && onlineCount > 0 ? (
              <span className="online-pill" title="Pessoas com o Storyverse aberto agora" role="status">
                <span className="online-dot" aria-hidden="true" />
                <strong>{onlineCount}</strong>
                <span className="online-label">{onlineCount === 1 ? "online" : "online agora"}</span>
              </span>
            ) : null}
            <div className="nav-secondary">
            {!installed ? (
              <button
                type="button"
                className={`btn nav-install ${installBannerShown ? "has-banner" : ""}`}
                onClick={() => setInstallOpen(true)}
                aria-label="Baixar app"
                title="Baixar app"
              >
                {Icon.download}
                <span className="nav-install-label">Baixar app</span>
              </button>
            ) : null}
            <Link className="btn nav-library" to="/biblioteca" aria-label="Abrir a biblioteca pública">
              <span className="nav-library-long">Biblioteca</span>
              <span className="nav-library-short">Livros</span>
            </Link>
            <Link className="btn nav-audio" to="/ouvir" aria-label="Abrir os audiolivros">
              <span className="nav-audio-long">Audiolivros</span>
              <span className="nav-audio-short">Áudio</span>
            </Link>
            {staffOn ? (
              <Link className="btn nav-admin" to="/admin" aria-label="Abrir painel administrativo">
                Admin
              </Link>
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
            </div>
            {groupsOn ? (
              <Link
                className="btn nav-groups"
                to="/grupos"
                aria-label={groupsUnread > 0 ? `Abrir os grupos, ${groupsUnread} mensagens não lidas` : "Abrir os grupos"}
              >
                {Icon.chat}
                <span className="nav-groups-label">Grupos</span>
                {groupsUnread > 0 ? (
                  <span className="nav-groups-badge" aria-hidden="true" key={groupsUnread}>
                    {groupsUnread > 99 ? "99+" : groupsUnread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {groupsOn && authUser ? <NotificationBell groups={groupsActivity.groups} activity={groupsActivity.activity} /> : null}
            <NavMore
              items={[
                ...(!installed ? [{ key: "install", label: "Baixar app", icon: Icon.download, onClick: () => setInstallOpen(true) }] : []),
                { key: "library", label: "Biblioteca", icon: Icon.book, to: "/biblioteca" },
                { key: "audio", label: "Audiolivros", icon: Icon.speaker, to: "/ouvir" },
                ...(groupsOn && authUser ? [{ key: "people", label: "Pessoas", icon: Icon.chat, to: "/pessoas" }] : []),
                ...(canRead ? [{ key: "import", label: "Importar livro", icon: Icon.upload, onClick: () => requestImport() }] : []),
                ...(staffOn ? [{ key: "admin", label: "Painel admin", icon: Icon.settings, to: "/admin" }] : []),
                ...(authUser ? [{ key: "logout", label: "Sair da conta", icon: Icon.logout, onClick: () => void askLogout() }] : []),
              ] satisfies NavMoreItem[]}
            />
            {!authEnabled ? null : authUser ? (
              <button type="button" className="btn nav-account" onClick={() => setProfileOpen(true)} aria-label="Abrir seu perfil" title="Abrir seu perfil">
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

        {sanctionNotice ? (
          <div className="auth-global-notice auth-sanction-notice" role="status">
            <span>{sanctionNotice}</span>
            <button type="button" className="btn" onClick={() => setSanctionNotice(null)}>
              Fechar
            </button>
          </div>
        ) : null}

        {appConfirmDialog}
        {aboutOpen ? <AboutDialog onClose={() => setAboutOpen(false)} /> : null}
        {spinOpen && authSession ? (
          <Suspense fallback={null}>
            <DailySpinModal
              session={authSession}
              onClose={() => setSpinOpen(false)}
              onWon={(r) => r.is_new && setToast(`+${r.prize} 💎 na roleta`)}
            />
          </Suspense>
        ) : null}

        {installOpen ? <InstallAppDialog install={install} onClose={() => setInstallOpen(false)} /> : null}

        {installBannerShown ? (
          // No celular o convite fica aqui, fora do topo (lá não cabe junto com "Importar livro").
          <div className="install-banner">
            <span>Baixe o app do Storyverse: abre em tela cheia e funciona sem internet.</span>
            <button type="button" className="btn btn-primary" onClick={() => setInstallOpen(true)}>
              Baixar
            </button>
            <button
              type="button"
              className="icon-btn install-banner-close"
              onClick={() => {
                hideInstallBanner();
                setInstallBannerOff(true);
              }}
              aria-label="Fechar convite"
            >
              {Icon.close}
            </button>
          </div>
        ) : null}

        {freezeOutcome && authSession ? (
          <FreezeNudge
            outcome={freezeOutcome}
            busy={freezeBusy}
            onClose={() => setFreezeOutcome(null)}
            onOpenShop={() => setShopOpen(true)}
            onSave={() => {
              if (freezeOutcome.kind !== "offer") return;
              const { rescue, wallet } = freezeOutcome;
              setFreezeBusy(true);
              rescueStreak(authSession, rescue)
                .then((r) => {
                  setFreezeOutcome({ kind: "saved", streak: r.streak, spent: rescue.paidDays.length * wallet.freeze_price, balance: r.balance });
                  setDataEpoch((n) => n + 1);
                })
                .catch((err: unknown) => setToast(err instanceof Error ? err.message : "Não foi possível salvar a sequência."))
                .finally(() => setFreezeBusy(false));
            }}
          />
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
            <GoldDust density={30} />
            <span className="eyebrow">Storyverse</span>
            <h1>
              {greetingNow()}{authUser ? `, ${displayNameOf(authUser).split(" ")[0]}` : ""} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              {recent[0]
                ? `Pronto para voltar a “${recent[0].book.title}”?`
                : "Escolha um livro e comece a conversa com os personagens."}
            </p>
            {recent[0] ? (
              <WelcomeCall
                book={recent[0].book}
                onOpen={() => startBook(recent[0].book)}
              />
            ) : null}
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
              {/* No celular o "Importar" do topo some; aqui ele fica à mão (e dá para sugerir à comunidade). */}
              {canRead ? (
                <button type="button" className="btn" onClick={() => requestImport()}>
                  {Icon.upload} Importar livro
                </button>
              ) : null}
            </div>
            {BILLING_UI_ENABLED && subscription?.active ? <PlanCard status={subscription} /> : null}
          </header>
        ) : (
        <>
        <header className="hero">
          <GoldDust />
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
                <DemoConversation question={heroBook.demo.question} answer={heroBook.demo.answer} />
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

        {canRead && nudge ? (
          <CharacterNudgeCard
            nudge={nudge}
            onContinue={() => startBook(nudge.progress.book)}
            onReply={() => startBook(nudge.progress.book, { characterId: nudge.character.id, chat: true })}
            onDismiss={() => {
              dismissNudge(nudge.progress);
              setHomeTick((n) => n + 1);
            }}
          />
        ) : null}

        {recent.length > 0 || hasAnyReading() ? <ReadingStreak lastBook={lastBook} /> : null}

        {authSession ? <RankingTeaser onOpen={() => setRankingOpen(true)} /> : null}

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

        {/* A estante da pessoa logo depois do "Continue lendo": no celular ela ficava 6 telas abaixo. */}
        {canRead ? (
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
        ) : null}

        {canRead ? <DailyQuote books={featuredBooks} /> : null}

        {catalogNew.length > 0 ? (
          <ProfileShelf
            eyebrow="📚 Biblioteca pública"
            title="Novidades da biblioteca"
            subtitle="Livros que acabaram de entrar no catálogo curado."
            items={catalogNew.map((b) => ({ book: b, sub: b.author }))}
            onOpen={startBook}
            action={
              <Link className="btn" to="/biblioteca">
                Ver a biblioteca
              </Link>
            }
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

        {/* Uma estante só para a comunidade (U2): os recém-aprovados vêm primeiro, com o selo "Novo". */}
        {communityBooks.length > 0 ? (
          <ProfileShelf
            title="Da comunidade"
            subtitle="Livros enviados por leitores e aprovados pela curadoria."
            onOpen={startBook}
            items={communityBooks.map((b) => ({
              book: b,
              sub: b.author,
              ...(isNewCommunityBook(b) ? { badge: newBookLabel(b) } : {}),
            }))}
          />
        ) : null}

        {canRead ? (
          <div id="recursos">
            <Explore onOpen={startBook} onImport={(hint) => requestImport(hint ?? {})} communityBooks={communityBooks} />
          </div>
        ) : null}

        {celebration ? <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} /> : null}
        {finishPrompt.open ? <FinishBookDialog book={finishPrompt.open} onClose={finishPrompt.close} /> : null}
        {achievementQueue[0] ? <AchievementToast key={achievementQueue[0].id} achievement={achievementQueue[0]} onDone={nextAchievement} /> : null}

        {bookmarkDrop ? (
          <div key={bookmarkDrop.id} className="bookmark-drop" role="status">
            <span className="bookmark-ribbon" aria-hidden="true" />
            <span className="bookmark-label">
              <strong>Marcamos onde você parou</strong>
              <span>{bookmarkDrop.label}</span>
            </span>
          </div>
        ) : null}

        {updateBanner}

        <footer className="home-foot">
          <div className="foot-brand">
            <span className="wordmark foot-wordmark">
              <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
              Storyverse
            </span>
            <p>
              Leitura que conversa com você. Clássicos do{" "}
              <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
                Project Gutenberg
              </a>
              , livros da curadoria e da comunidade.
            </p>
          </div>
          <nav className="foot-cols" aria-label="Links do rodapé">
            <div className="foot-col">
              <h2 className="foot-col-title">Storyverse</h2>
              <button type="button" className="foot-link" onClick={() => setAboutOpen(true)}>
                Sobre nós
              </button>
              <Link className="foot-link" to="/biblioteca">
                Biblioteca pública
              </Link>
              {BILLING_UI_ENABLED && authUser ? (
                <Link className="foot-link" to="/conta/assinatura">
                  Minha assinatura
                </Link>
              ) : null}
            </div>
            <div className="foot-col">
              <h2 className="foot-col-title">Legal</h2>
              <Link className="foot-link" to="/termos">
                Termos de uso
              </Link>
              <Link className="foot-link" to="/privacidade">
                Privacidade
              </Link>
              <Link className="foot-link" to="/cancelamento">
                Cancelamento e reembolso
              </Link>
            </div>
          </nav>
          <div className="home-credit">
            <span>© {new Date().getFullYear()} Storyverse</span>
            <span>
              Desenvolvido por <strong>Axyon Software House</strong>
              <span className="home-credit-sep" aria-hidden="true"> · </span>
              <span className="home-credit-holder">{LEGAL_HOLDER_NAME}</span>
            </span>
          </div>
        </footer>
      </div>
    );
  }

  const ready = loadState === "ready" && fullText.length > 0;
  const castReady = cast !== null;
  const userHasSpoken = messages.some((m) => m.role === "user");
  const hasNextChapter = chapterIndex < chapters.length - 1;

  return (
    <div className={`reader theme-${prefs.theme}${immersive ? " is-immersive" : ""}`}>
      {immersive || isFullscreen ? (
        <button type="button" className="reader-immersive-exit" onClick={() => void toggleReadingFullscreen()}>
          Sair da tela cheia
        </button>
      ) : null}
      {/* Por cima de tudo, sem pegar cliques: tira o azul da tela para ler à noite. */}
      {prefs.nightLight ? <div className={`night-light night-light-${prefs.nightLight}`} aria-hidden="true" /> : null}
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
          {shelfOn && shelfPanelOpen ? <BookStatusControl book={book} onClose={() => setShelfPanelOpen(false)} /> : null}
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
              aria-label={translateOn ? "Ver o texto original em inglês" : "Traduzir para o português"}
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
          <div className="reader-settings" role="dialog" aria-label="Ajustes de leitura">
            <div className="reader-settings-head">
              <strong>Ajustes de leitura</strong>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReaderSettingsOpen(false)}
                aria-label="Fechar ajustes"
              >
                {Icon.close}
              </button>
            </div>
            <div className="reader-settings-row">
              <span>Tamanho da letra</span>
              <div className="reader-settings-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={prefs.fontStep <= 0}
                  onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep - 1 }))}
                  aria-label="Diminuir letra"
                >
                  A−
                </button>
                <strong>{Math.round(FONT_SIZES[prefs.fontStep] * 16)}px</strong>
                <button
                  type="button"
                  className="btn"
                  disabled={prefs.fontStep >= FONT_SIZES.length - 1}
                  onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep + 1 }))}
                  aria-label="Aumentar letra"
                >
                  A+
                </button>
              </div>
            </div>
            <div className="reader-settings-row">
              <span>Tema</span>
              <div className="segmented">
                <button
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === "night"}
                  className={prefs.theme === "night" ? "is-on" : ""}
                  onClick={() => setPrefs((p) => ({ ...p, theme: "night" }))}
                >
                  Noturno
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === "sepia"}
                  className={prefs.theme === "sepia" ? "is-on" : ""}
                  onClick={() => setPrefs((p) => ({ ...p, theme: "sepia" }))}
                >
                  Sépia
                </button>
              </div>
            </div>
            <div className="reader-settings-row">
              <span>Luz noturna</span>
              <button
                type="button"
                className="btn"
                onClick={() => setPrefs((p) => ({ ...p, nightLight: ((p.nightLight + 1) % 3) as NightLight }))}
              >
                {NIGHT_LIGHT_LABELS[prefs.nightLight]}
              </button>
            </div>
            <div className="reader-settings-row">
              <span>Tela cheia</span>
              <button type="button" className="btn" onClick={() => void toggleReadingFullscreen()}>
                {isFullscreen || immersive ? "Sair" : "Entrar"}
              </button>
            </div>
          </div>
        ) : null}

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
                const fresh = new Set(here.filter((h) => Date.now() - h.createdAt < 4000).map((h) => h.text));
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
                  <span className="source-link">Livro importado · {authSession ? "guardado na sua conta" : "guardado só neste aparelho"}</span>
                ) : book.source === "community" ? (
                  <span className="source-link">Livro da comunidade · enviado por um leitor e aprovado pela curadoria</span>
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
              {naturalVoiceSupported() && missingNatural.length > 0 ? (
                <div className="voice-natural">
                  {storedNatural?.length ? (
                    <>
                      <strong>✨ Mais vozes naturais</strong>
                      <span>Cada uma baixa uma vez (cerca de 60 MB) e fica guardada aqui; prefira usar o Wi-Fi.</span>
                    </>
                  ) : (
                    <>
                      <strong>✨ Voz natural</strong>
                      <span>
                        Bem mais humana que as vozes do aparelho. Escolha uma: ela baixa uma vez (cerca de 60 MB) e
                        fica guardada aqui; prefira usar o Wi-Fi.
                      </span>
                    </>
                  )}
                  <ul className="voice-natural-options">
                    {missingNatural.map((v) => (
                      <li key={v.id}>
                        <span className="voice-natural-name">{v.name}</span>
                        {naturalDownload?.id === v.id ? (
                          <span className="voice-natural-progress">
                            <span
                              className="voice-natural-bar"
                              role="progressbar"
                              aria-label={`Baixando a voz ${v.name}`}
                              aria-valuenow={naturalDownload.pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={{ width: `${Math.max(3, naturalDownload.pct)}%` }} />
                            </span>
                            <small>{naturalDownload.pct}%</small>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={naturalDownload !== null}
                            aria-label={`Baixar a voz ${v.name}`}
                            onClick={() => void getNaturalVoice(v.id)}
                          >
                            {naturalError === v.id ? "Tentar de novo" : "Baixar"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {naturalError ? <small>Não deu para baixar agora. Confira a internet e tente de novo.</small> : null}
                  {!storedNatural?.length && !naturalDownload ? (
                    <button type="button" className="link-btn voice-natural-later" onClick={declineNaturalVoice}>
                      Agora não
                    </button>
                  ) : null}
                </div>
              ) : null}
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

        {searchOpen ? (
          <div className="import-overlay" onClick={() => setSearchOpen(false)}>
            <div
              className="import-panel marks-panel search-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="search-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="import-head">
                <h3 id="search-title">Buscar no livro</h3>
                <button type="button" className="icon-btn" onClick={() => setSearchOpen(false)} aria-label="Fechar">
                  {Icon.close}
                </button>
              </div>
              <label className="search-field">
                {Icon.search}
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Uma palavra ou um nome"
                  aria-label="O que buscar no livro"
                  autoFocus
                />
              </label>
              {deferredTerm.trim().length < 2 ? (
                <>
                  <p className="import-note">Digite pelo menos 2 letras. A busca olha o livro inteiro, no texto original.</p>
                  <PrivacyNote details="O livro já está aberto aqui, então a busca roda no seu aparelho: o que você digita não vai para a internet nem fica salvo.">
                    Busca privada: acontece só neste aparelho.
                  </PrivacyNote>
                </>
              ) : searchResults.hits.length === 0 ? (
                <p className="import-note">Nada encontrado para “{deferredTerm.trim()}”.</p>
              ) : (
                <>
                  <p className="search-count">
                    {searchResults.total} {searchResults.total === 1 ? "trecho" : "trechos"}
                    {searchResults.total > searchResults.hits.length ? ` (mostrando os ${searchResults.hits.length} primeiros)` : ""}
                  </p>
                  <ul className="marks-list search-list">
                    {searchResults.hits.map((r) => (
                      <li key={`${r.chapterIndex}-${r.paragraph}-${r.start}`}>
                        <button type="button" className="search-hit" onClick={() => openSearchResult(r)}>
                          <span className="marks-chapter">{r.chapterLabel}</span>
                          <span className="search-snippet">
                            {r.before}
                            <mark>{r.match}</mark>
                            {r.after}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
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

        {celebration ? <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} /> : null}
        {finishPrompt.open ? <FinishBookDialog book={finishPrompt.open} onClose={finishPrompt.close} /> : null}
        {achievementQueue[0] ? <AchievementToast key={achievementQueue[0].id} achievement={achievementQueue[0]} onDone={nextAchievement} /> : null}

        {updateBanner}

        {toast || sharing ? (
          <div className="toast" role="status">
            {sharing ? "Gerando a imagem…" : toast}
          </div>
        ) : null}

        <aside className={`chat ${chatOpen ? "is-open" : ""}`} aria-label="Conversa com os personagens">
          {character ? (
            <div className="chat-head" style={{ "--c": character.color } as React.CSSProperties}>
              <span className="chat-head-avatar" ref={chatAvatarRef}>
                <Avatar character={character} size="lg" bookTitle={book.title} generate />
                {chatReaction?.emoji ? (
                  <span key={chatReaction.id} className="chat-reaction" aria-hidden="true">
                    {chatReaction.emoji}
                  </span>
                ) : null}
              </span>
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

          <PrivacyNote
            details={
              <>
                Ninguém da comunidade vê suas conversas. Cada mensagem vai por conexão criptografada (HTTPS) até a
                IA que dá voz ao personagem, só para ele responder, e o histórico fica no seu aparelho e na sua conta, para continuar de
                onde parou. Você pode apagar tudo em Perfil › Ajustes › Privacidade.
              </>
            }
          >
            Conversa privada: só você vê.
          </PrivacyNote>

          <div ref={chatBodyRef} className="chat-body">
            {character ? (
              // Sempre no começo da conversa: deixa claro que é ficção feita por IA.
              <p className="chat-ai-notice" role="note">
                <span aria-hidden="true">🤖</span>
                <span>
                  <strong>Conversa fictícia criada por inteligência artificial.</strong> {character.name} é um personagem, não uma pessoa
                  real: as respostas são geradas por IA e podem conter erros.
                </span>
              </p>
            ) : null}
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
                <div key={m.id} className={`msg msg-user ${m.reaction ? "has-reaction" : ""}`}>
                  <div className="bubble user">
                    {m.text}
                    {m.reaction ? (
                      <span className="bubble-reaction" role="img" aria-label={`${character?.name ?? "O personagem"} reagiu com ${m.reaction}`}>
                        {m.reaction}
                      </span>
                    ) : null}
                  </div>
                  {loading && messages[messages.length - 1]?.id === m.id ? (
                    <span className="msg-seen" aria-label={`${character?.name ?? "O personagem"} viu a mensagem`}>
                      Visto
                    </span>
                  ) : null}
                </div>
              ),
            )}
            {loading && character ? (
              <div className="msg msg-assistant is-typing">
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
          {limitApplies && messagesLeft === 0 && extraMessagesLeft > 0 ? (
            <p className="limit-note">
              {extraMessagesLeft === 1
                ? "Usando 1 mensagem extra."
                : `Usando mensagens extras: ${extraMessagesLeft} restantes.`}
            </p>
          ) : null}

          {outOfMessages ? (
            <div className="limit-out" role="status">
              <strong>Por hoje é só 💛</strong>
              <span>
                Você usou as mensagens gratuitas e extras de hoje. Os personagens voltam a conversar amanhã —
                enquanto isso, a leitura continua.
              </span>
              <button type="button" className="btn btn-primary" onClick={() => setShopOpen(true)}>
                Comprar mensagens extras
              </button>
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
